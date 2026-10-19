import { useEffect, useRef, useState } from 'react';
import type { GameBattleStageProps } from './components';
import type { GameHexCell, GameHexUnit, GameUnitAsset } from './types';
import { gameHexCells, hexDistance } from './hex-rules';
import { sampleHexPlayback } from './hex-playback';

/** 六边形战场输入；共享宿主状态和回合事件，不单独结算伤害或奖励。 */
export interface GameHexBattlefieldProps extends GameBattleStageProps {}

const images = new Map<string, HTMLImageElement>();
// 图片只解码一次；网络失败显示单位缩写，保留文字与气血以保证仍可辨认。
function bitmap(src: string) {
    let img = images.get(src);
    if (!img) { img = new Image(); img.src = src; images.set(src, img); }
    return img.complete && img.naturalWidth ? img : null;
}
const tilt = Math.SQRT1_2;
const point = (cell: GameHexCell) => ({ x: 450 + 78 * cell.q, y: 304 + Math.sqrt(3) * 52 * (cell.r + cell.q / 2) * tilt });
function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius * tilt; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath();
}
function polygon(ctx: CanvasRenderingContext2D, points: number[][], color: string, stroke = '#101a27') {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
}
// 侧面只有两级平涂色，没有光照材质、渐变或立体模型。厚度是棋子的浅挤出边。
function tile(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, depth: number, top: string, border: string) {
    const dy = radius * Math.sqrt(3) / 2 * tilt;
    polygon(ctx, [[x-radius,y],[x-radius/2,y+dy],[x-radius/2,y+dy+depth],[x-radius,y+depth]], '#182433');
    polygon(ctx, [[x-radius/2,y+dy],[x+radius/2,y+dy],[x+radius/2,y+dy+depth],[x-radius/2,y+dy+depth]], '#223348');
    polygon(ctx, [[x+radius/2,y+dy],[x+radius,y],[x+radius,y+depth],[x+radius/2,y+dy+depth]], '#2b4054');
    hexPath(ctx,x,y,radius); ctx.fillStyle=top;ctx.fill();ctx.strokeStyle=border;ctx.lineWidth=1.5;ctx.stroke();
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color = '#dce9f4', size = 13) {
    ctx.font = `600 ${size}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(value,x,y);
}
function plate(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string) {
    ctx.font='12px "Microsoft YaHei",sans-serif'; const w=ctx.measureText(value).width+16;
    ctx.fillStyle='#111d2eef';ctx.fillRect(x-w/2,y-10,w,20);ctx.strokeStyle='#435971';ctx.strokeRect(x-w/2,y-10,w,20);text(ctx,value,x,y,color,12);
}

/** 45° 俯视六边形棋盘；地图 scene 位图铺在半透明地格下方，PNG/WebP 单位贴在棋子顶面。背景加载失败时保留暗色底板，所有动效作用于整枚棋子。 */
export function GameHexBattlefield({ engine, state, event, sequence = 0 }: GameHexBattlefieldProps) {
    const canvas = useRef<HTMLCanvasElement>(null), [phase, setPhase] = useState('等待出发'), [assetFailed, setAssetFailed] = useState(false), [visibleEnemies, setVisibleEnemies] = useState(0);
    const map = engine.definition.maps[state.map], pet = engine.definition.pets.find(p => p.id === state.pet)!;
    const fight = state.fight, boss = Boolean(fight?.boss), duration = engine.definition.turnDurationMs ?? 1000;
    const reduced = useRef(false);
    useEffect(() => {
        const media = matchMedia('(prefers-reduced-motion: reduce)'); reduced.current = media.matches;
        const change = () => { reduced.current = media.matches; }; media.addEventListener('change',change);return () => media.removeEventListener('change',change);
    }, []);
    useEffect(() => {
        const element = canvas.current, ctx = element?.getContext('2d'); if (!element || !ctx) return;
        let frame = 0, disposed = false, lastPhase = '', lastCount = -1, started = performance.now();
        const replay = event?.playback;
        const idleUnits: GameHexUnit[] = fight?.units.map(u=>({...u})) ?? [{id:'hero',side:'hero',q:0,r:0,hp:engine.stats(state).hp,maxHp:engine.stats(state).hp},{id:'pet',side:'pet',q:-1,r:1,hp:1,maxHp:1}];
        const roster = (unit: GameHexUnit): {name:string;asset:GameUnitAsset;color:string} => unit.side==='hero' ? {name:state.name,asset:engine.definition.hero,color:'#8bdcff'} : unit.side==='pet' ? {name:pet.name,asset:pet.art,color:'#8ae2b9'} : {name:boss?map.boss:map.enemy,asset:boss?map.bossArt:map.enemyArt,color:boss?'#efb779':'#e69386'};
        // 背景也加入加载队列，静止或暂停时解码完成仍会绘制，不依赖下一回合。
        const assets = [map.scene,engine.definition.hero.src,pet.art.src,(boss?map.bossArt:map.enemyArt).src]; assets.forEach(bitmap);
        const fit = () => { const dpr = Math.min(devicePixelRatio || 1,2);element.width=900*dpr;element.height=580*dpr;ctx.setTransform(dpr,0,0,dpr,0,0); };
        fit();
        const draw = (now: number) => {
            if (disposed) return;
            const t = replay ? Math.min(1,(now-started)/duration) : 1, visual = replay ? sampleHexPlayback(replay,t) : {units:idleUnits,progress:t};
            const cues = replay?.cues ?? [], active = cues.filter(c=>t>=c.at && t<c.at+.17);
            // 状态栏也读取播放时刻，不能在命中前提前宣告敌人已经死亡。
            const count=visual.units.filter(u=>u.side==='enemy'&&u.hp>0).length;
            if(count!==lastCount){lastCount=count;setVisibleEnemies(count);}
            const phaseLabel = !fight ? '等待出发 · 自动寻敌' : !replay ? fight.status==='won'?'清理战场 · 下一波即将来袭':fight.status==='lost'?'暂作休整':'妖气来袭' : t<.18?'逐格接近 · 自动寻敌':t<.35?'准备出手':t<.55?'命中 · 追击':t<.78?replay.move==='charge'?`${map.boss}正在蓄力`:replay.move==='recover'?'首领喘息':'敌方行动':t<.88?'灵宠支援':replay.gold?'拾取战利品':'回合结束';
            if (phaseLabel!==lastPhase) { lastPhase=phaseLabel;setPhase(phaseLabel); }
            ctx.clearRect(0,0,900,580);ctx.fillStyle='#111d2a';ctx.fillRect(0,0,900,580);
            // 场景已经按俯视地面构图绘制，不再二次压扁；完整映射构图以保留六向入口。
            const scene=bitmap(map.scene);
            if(scene)ctx.drawImage(scene,0,0,900,580);
            const cells=gameHexCells().sort((a,b)=>point(a).y-point(b).y);
            for(const cell of cells) {
                const p=point(cell), edge=hexDistance(cell,{q:0,r:0})===3, occupied=visual.units.find(u=>u.hp>0&&hexDistance(u,cell)<.1);
                // 普通地格透出地图底色；降低厚度让棋盘像嵌在地面，单位仍保留独立浅立体侧边。
                const color=occupied?.side==='hero'?'#314b61d9':occupied?.side==='enemy'?'#493b3bd9':((cell.q-cell.r+12)%3===0?'#30455480':'#2a3c4b70');
                tile(ctx,p.x,p.y,50,3,color,edge?'#82918b':'#637579');
                if(edge){text(ctx,'·',p.x,p.y,'#9caa91',20);}
            }
            // 回合轨迹显示实际寻路经过的相邻格，而不是自由飞行。
            for(const cue of cues.filter(c=>c.kind==='move'&&c.from&&c.to&&t>=c.at&&t<c.at+.2)) {
                const a=point(cue.from!),b=point(cue.to!);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=cue.actor.startsWith('enemy')?'#bd766b':'#6bbddd';ctx.lineWidth=3;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
            }
            const ordered=[...visual.units].sort((a,b)=>point(a).y-point(b).y);
            for(const unit of ordered) {
                const spawn=cues.find(c=>c.kind==='spawn'&&c.actor===unit.id);if(spawn&&t<spawn.at)continue;
                const dead=cues.find(c=>c.kind==='death'&&c.actor===unit.id);
                if(unit.hp===0&&(!dead||t>dead.at+.10))continue;
                const p=point(unit), info=roster(unit), hit=active.find(c=>c.kind==='hit'&&c.target===unit.id), cast=active.find(c=>c.kind==='cast'&&c.actor===unit.id), heal=active.find(c=>c.kind==='heal'&&c.target===unit.id);
                let x=p.x,y=p.y-15;
                if(!reduced.current&&hit)x+=Math.sin((t-hit.at)*110)*5;
                if(!reduced.current&&cast)y-=Math.sin(Math.min(1,(t-cast.at)/.15)*Math.PI)*8;
                ctx.save();if(dead&&t>=dead.at)ctx.globalAlpha=Math.max(0,1-(t-dead.at)/.1);
                const radius=boss&&unit.side==='enemy'?50:44;
                tile(ctx,x,y,radius,15,unit.side==='hero'?'#355771':unit.side==='pet'?'#2f554b':'#674b42',heal?'#96f5c2':hit?'#ffe2be':info.color);
                // 顶面作相同 45° 投影：角色被裁进六边形，绝不直立在棋子上。
                ctx.save();hexPath(ctx,x,y,radius-4);ctx.clip();ctx.translate(x,y);ctx.scale(info.asset.flip?-1:1,tilt);
                const img=bitmap(info.asset.src);
                if(img) { const crop=Math.min(img.naturalWidth,img.naturalHeight*.76);ctx.drawImage(img,(img.naturalWidth-crop)/2,0,crop,crop,-radius,-radius,radius*2,radius*2); }
                else {text(ctx,info.name.slice(0,2),0,0,info.color,20);if(images.get(info.asset.src)?.complete)setAssetFailed(true);}
                ctx.restore();hexPath(ctx,x,y,radius-3);ctx.strokeStyle=info.color;ctx.lineWidth=2;ctx.stroke();
                if(hit){hexPath(ctx,x,y,radius);ctx.strokeStyle='#fff3c4';ctx.lineWidth=4;ctx.stroke();for(let ray=0;ray<6;ray++){const angle=ray*Math.PI/3;ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*(radius+3),y+Math.sin(angle)*(radius+3)*tilt);ctx.lineTo(x+Math.cos(angle)*(radius+12),y+Math.sin(angle)*(radius+12)*tilt);ctx.stroke();}}
                if(heal){hexPath(ctx,x,y,radius+5);ctx.strokeStyle='#8ee9b2';ctx.lineWidth=3;ctx.stroke();}
                if(replay?.guarded&&unit.side==='hero'){hexPath(ctx,x,y,radius+5);ctx.strokeStyle='#97bde5';ctx.lineWidth=2;ctx.stroke();}
                if(boss&&unit.side==='enemy'&&replay?.move==='charge'){hexPath(ctx,x,y,radius+8);ctx.strokeStyle='#f3aa68';ctx.lineWidth=3;ctx.stroke();}
                const nameY=p.y+43;
                plate(ctx,info.name,x,nameY,info.color);
                if(unit.side!=='pet') {ctx.fillStyle='#101723';ctx.fillRect(x-31,nameY+14,62,5);ctx.fillStyle=unit.side==='hero'?'#7ac7d9':'#d58270';ctx.fillRect(x-31,nameY+14,62*Math.max(0,unit.hp/unit.maxHp),5);text(ctx,`${unit.hp}/${unit.maxHp}`,x,nameY+29,'#c5d4e4',10);}
                ctx.restore();
            }
            // 符箓和治疗沿两枚棋子之间的连线运动，受击与血条变化使用同一个 cue 时刻。
            for(const cue of active) {
                const source=visual.units.find(u=>u.id===cue.actor),target=visual.units.find(u=>u.id===cue.target);if(!source)continue;
                const a=point(source),b=target?point(target):a;
                if(cue.kind==='cast'&&target){const impact=cues.find(c=>c.kind==='hit'&&c.actor===cue.actor&&c.target===cue.target&&c.at>cue.at);const p=Math.min(1,(t-cue.at)/Math.max(.02,(impact?.at??cue.at+.14)-cue.at));const x=a.x+(b.x-a.x)*p,y=a.y+(b.y-a.y)*p-25;tile(ctx,x,y,9,3,cue.actor.startsWith('enemy')?'#d19a75':'#e3c37e','#f4e3b7');plate(ctx,cue.label??'出手',a.x,a.y-69,cue.actor.startsWith('enemy')?'#f1ba91':'#ead694');}
                if(cue.kind==='heal'&&target){ctx.strokeStyle='#7ce3ad';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y-20);ctx.lineTo(b.x,b.y-20);ctx.stroke();hexPath(ctx,b.x,b.y-15,53);ctx.stroke();}
                if(cue.kind==='shield'){hexPath(ctx,a.x,a.y-15,55);ctx.strokeStyle='#a7d7fa';ctx.lineWidth=3;ctx.stroke();}
                if(cue.kind==='hit'||cue.kind==='heal'){const y=b.y-63-(reduced.current?0:(t-cue.at)*70);ctx.strokeStyle='#102034';ctx.lineWidth=4;ctx.font='bold 20px sans-serif';ctx.textAlign='center';const label=`${cue.kind==='heal'?'+':'−'}${cue.value}`;ctx.strokeText(label,b.x,y);text(ctx,label,b.x,y,cue.kind==='heal'?'#9bffd0':cue.actor.startsWith('enemy')?'#ffc0a3':'#ffe39c',20);}
            }
            for(const cue of cues.filter(c=>c.kind==='loot'&&t>=c.at)) {
                const unit=visual.units.find(u=>u.id===cue.actor);if(!unit)continue;const p=point(unit);
                tile(ctx,p.x,p.y-9,15,5,'#d8b65e','#ffdf92');text(ctx,'钱',p.x,p.y-9,'#49391d',11);
                plate(ctx,`+${cue.value} 铜钱`,p.x,p.y+25,'#f4d18c');text(ctx,cue.label??'',p.x,p.y+47,'#d6dbe0',11);
            }
            // 字牌使用实色底，保证在屋檐、竹林等不同底图上都可阅读。
            plate(ctx,`${map.name} · 棋境`,100,31,'#e1d4b3');plate(ctx,'六方来敌 · 自动迎战',777,31,'#bad2df');
            // 页面不可见或回合结束时停止绘制；新事件、图片载入和页面恢复会重绘。
            if(t<1||assets.some(src=>!images.get(src)?.complete)) frame=requestAnimationFrame(draw);
        };
        frame=requestAnimationFrame(draw);
        const resume=()=>{if(!document.hidden){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}};
        document.addEventListener('visibilitychange',resume);
        return()=>{disposed=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);};
    },[engine,state,event,sequence,fight,map,pet,duration,boss]);
    return <section className="hex-battlefield" aria-label="六边形自动战场">
        <div className="hex-stage-head"><span>{boss?'首领现身 · 小妖已清退':'六方来敌 · 逐格接近'}</span><span>第 {fight?.turn ?? 0} 回合 · 敌方 {visibleEnemies}</span></div>
        <canvas ref={canvas} className="hex-canvas" role="img" aria-label={`${map.name}，45度俯视六边形棋盘，${state.name}与${pet.name}自动迎战${boss?map.boss:'四方小妖'}`}/>
        {boss && <div className={`hex-boss-intent ${event?.playback?.move==='charge'?'charging':''}`}><span>{map.boss}</span><b>{event?.playback?.move==='charge'?`蓄力 · 下回合${map.bossSkillName??'重击'}`:event?.playback?.move==='heavy'?map.bossSkillName??'重击':event?.playback?.move==='recover'?'喘息 · 本回合不攻击':'逼近 · 近身挥砍'}</b><span>挥砍 → 蓄力 → 重斩 → 喘息</span></div>}
        <div className="hex-stage-foot"><span>{phase}</span><span>青 · 玩家　绿 · 灵宠　赤 · 妖怪</span></div>
        {assetFailed && <p className="hex-asset-warning">部分贴图加载失败，暂以单位名标识棋子。</p>}
    </section>;
}
