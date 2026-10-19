import { GameButton } from './components';
import type { GameViewProps } from './components';
import type { GameAbilityKind } from './types';
import { gameAbilities } from './hex-rules';

/** 能力装配面板；每类单选，选择后通过 configure 命令提交，首领战中只读。 */
export function GameLoadoutPanel({ engine, state, onAction }: GameViewProps) {
    const groups: [GameAbilityKind,string][]=[['attack','攻击'],['skill','技能'],['power','神通'],['treasure','法宝']];
    const locked=Boolean(state.fight?.boss&&state.fight.status==='active');
    return <div className="hex-loadout"><p>自动寻敌、逐格移动。攻击每回合施放；技能与法宝同回合可用时，优先使用法宝；神通独立生效。更换配置后从新一波开始。</p>
        {groups.map(([kind,label])=><section key={kind}><h3>{label}</h3><div className="hex-ability-options">{gameAbilities(engine.definition).filter(a=>a.kind===kind).map(a=><GameButton key={a.id} className={`hex-ability ${state.loadout[kind]===a.id?'selected':''}`} aria-pressed={state.loadout[kind]===a.id} disabled={locked} onClick={()=>onAction({type:'configure',id:a.id})}><strong>{a.name}</strong><small>{a.kind==='attack'?`射程 ${a.range} 格`:`每 ${a.cooldown} 回合`}</small><span>{a.description}</span></GameButton>)}</div></section>)}
        {locked&&<p>首领挑战期间不能更换配置，结束后可调整。</p>}
    </div>;
}
