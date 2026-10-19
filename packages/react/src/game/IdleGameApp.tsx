import { useEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createIdleEngine } from './engine';
import type { IdleGameDefinition, IdleGameState, GameBattleEvent, GameOfflineReport } from './types';
import { GameShell, GameBattleStage, GameMapPanel, GameEquipmentPanel, GamePetPanel, GameDialog, GameSavePanel, GameButton, GameEquipmentComparison } from './components';
import { GameLoadoutPanel } from './LoadoutPanel';
import { gameAbilities } from './hex-rules';
import type { GameAction, GamePage } from './components';
/** 完整放置游戏宿主的属性；业务无需定义页面组件。 */
export interface IdleGameAppProps {
    /** 题材、素材和数值配置，挂载期间必须保持引用稳定；更换游戏应重新挂载。 */ definition: IdleGameDefinition;
    /** 容器附加类；默认无。游戏皮肤本身由框架维护。 */ className?: string;
    /** 覆盖已公开的主题 CSS 变量，优先于默认皮肤。 */ style?: CSSProperties;
    /** 每次操作或有效回合后同步通知最新状态；只读观察，不应修改对象，不包含异步等待。 */ onStateChange?: (state: Readonly<IdleGameState>) => void;
}
/**
 * 提供三栏 UI、挂机时钟、离线结算及存档导入导出的完整游戏宿主。
 * 在线按 turnDurationMs 推进一回合（默认 1000 毫秒），后台隐藏暂停时钟；重新显示时补算普通战斗，卸载清理监听与定时器。
 * 浏览器存储不可用时保留内存玩法并提示导出；文件导入校验后必须确认替换。
 */
export function IdleGameApp({ definition, className = '', style, onStateChange }: IdleGameAppProps) {
    const engineRef = useRef<ReturnType<typeof createIdleEngine>>();
    if (!engineRef.current)
        engineRef.current = createIdleEngine(definition);
    const engine = engineRef.current;
    const stateRef = useRef<IdleGameState>();
    if (!stateRef.current)
        stateRef.current = engine.freshState();
    const s = stateRef.current;
    const [, refresh] = useReducer(n => n + 1, 0);
    const [page, setPage] = useState<GamePage>('battle'), [dialog, setDialog] = useState(''), [message, setMessage] = useState('');
    const [event, setEvent] = useState<GameBattleEvent | null>(null), [sequence, setSequence] = useState(0);
    const [report, setReport] = useState<GameOfflineReport | null>(null), [pending, setPending] = useState<IdleGameState | null>(null), [itemId, setItemId] = useState('');
    const host = useRef<HTMLDivElement>(null), lastTick = useRef(Date.now()), initialized = useRef(false), saveWarning = useRef(false);
    const observe = useRef(onStateChange);
    observe.current = onStateChange;
    function save() { const current = stateRef.current!; try {
        current.savedAt = Date.now();
        localStorage.setItem(definition.saveKey, engine.serialize(current, current.savedAt));
        saveWarning.current = false;
    }
    catch {
        if (!saveWarning.current) {
            setMessage('浏览器未能保存进度，请在设置中导出存档。');
            saveWarning.current = true;
        }
    } }
    function changed() { save(); refresh(); observe.current?.(stateRef.current!); }
    // 成功提示与棋盘掉落衔接，事件切换或卸载时取消，避免旧首领消息污染新战斗。
    useEffect(() => {
        if (!event?.bossWin) return;
        const timer=setTimeout(()=>setMessage(event.first?`首通成功！${event.reward}已收入行囊。`:'首领挑战成功！'),(definition.turnDurationMs??1000)*.93);
        return ()=>clearTimeout(timer);
    },[event,definition]);
    useEffect(() => { if (message) {
        const timer = setTimeout(() => setMessage(''), 3200);
        return () => clearTimeout(timer);
    } }, [message]);
    useEffect(() => {
        if (!initialized.current) {
            try {
                const raw = localStorage.getItem(definition.saveKey);
                if (raw) {
                    stateRef.current = engine.hydrate(JSON.parse(raw));
                    const result = engine.settleOffline(stateRef.current);
                    if (result) {
                        setReport(result);
                        setDialog('offline');
                    }
                }
            }
            catch {
                setMessage('存档读取失败，当前以内存新档运行；可在设置中导入备份。');
            }
            engine.addLog(stateRef.current!, '欢迎归来，点击开始挂机继续历练。');
            initialized.current = true;
            lastTick.current = Date.now();
            refresh();
        }
        // 在线与离线共用回合间隔，预留完整的移动、出手、命中和拾取播放窗口。
        const roundMs = definition.turnDurationMs ?? 1000;
        const timer = setInterval(() => {
            if (document.hidden)
                return;
            const now = Date.now(), elapsed = Math.floor((now - lastTick.current) / roundMs);
            if (elapsed < 1)
                return;
            const current = stateRef.current!;
            // 长时间节流先结算已有时间，再推进新回合，避免同一秒被重复计入收益。
            if (elapsed > 15 && current.idle) {
                current.savedAt = lastTick.current;
                engine.settleOffline(current, now);
                setEvent(null);
            }
            else {
                const next = engine.tick(current);
                // 休整期间保留最后一帧的战利品，下一波开始才清除，避免掉落一闪而过。
                if (next) setEvent(next);
                else if (!current.fight || current.fight.status === 'active') setEvent(null);
                if (next) {
                    setSequence(n => n + 1);
                    // 首领结算提示由下方播放时钟延迟到掉落出现之后。
                }
            }
            lastTick.current = now;
            changed();
        }, roundMs);
        const visibility = () => { if (document.hidden) {
            save();
            lastTick.current = Date.now();
        }
        else {
            const result = engine.settleOffline(stateRef.current!);
            if (result) {
                setReport(result);
                setDialog('offline');
            }
            lastTick.current = Date.now();
            setEvent(null);
            changed();
        } };
        window.addEventListener('pagehide', save);
        document.addEventListener('visibilitychange', visibility);
        return () => { clearInterval(timer); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', visibility); save(); };
    }, [engine, definition]);
    function action({ type, id = '' }: GameAction) {
        const current = stateRef.current!, locked = Boolean(current.fight?.boss && current.fight.status === 'active');
        if (type === 'page') {
            if (['battle', 'maps', 'gear', 'pets'].includes(id))
                setPage(id as GamePage);
            return;
        }
        if (type === 'settings' || type === 'help' || type === 'loadout') {
            setDialog(type);
            return;
        }
        if (type === 'inspect') {
            setItemId(id);
            setDialog('compare');
            return;
        }
        if (locked) {
            setMessage('首领挑战中，请等待战斗结束。');
            return;
        }
        let success = true;
        // 只接受可信配置表中的能力，首领战锁定更换，普通战重新生成波次。
        if (type === 'configure') {
            const ability=gameAbilities(definition).find(a=>a.id===id);
            if(!ability)return;
            current.loadout[ability.kind]=ability.id;
            current.fight=null;
            setMessage(`已装配${ability.name}，下次出手生效。`);
        }
        setEvent(null);
        lastTick.current=Date.now();
        if (type === 'idle') {
            current.idle = !current.idle;
            if (!current.idle)
                current.fight = null;
            engine.addLog(current, current.idle ? '开始挂机修行。' : '暂停挂机，静心整备。');
        }
        if (type === 'boss') {
            engine.beginFight(current, true);
            setPage('battle');
        }
        if (type === 'map') {
            const index = Number(id);
            if (!Number.isInteger(index) || index < 0 || index > current.unlocked)
                return;
            current.map = index;
            current.fight = null;
            setPage('battle');
            engine.addLog(current, `来到${definition.maps[index].name}。`);
        }
        if (type === 'equip') {
            success = engine.equip(current, id);
            if (success) {
                current.fight = null;
                setDialog('');
                setMessage('装备成功，战力已更新。');
            }
        }
        if (type === 'upgrade') {
            success = engine.upgrade(current, id);
            if (success) {
                current.fight = null;
                setMessage('部位强化成功。');
            }
        }
        if (type === 'dismantle')
            success = engine.dismantle(current, id);
        if (type === 'forge')
            success = engine.forge(current);
        if (type === 'train') {
            success = engine.trainPet(current, id);
            if (success)
                current.fight = null;
        }
        if (type === 'unlock')
            success = engine.unlockPet(current, id);
        if (type === 'deploy' && current.pets[id]) {
            current.pet = id;
            current.fight = null;
        }
        if (type === 'lock') {
            const item = current.inventory.find(i => i.id === id);
            if (item)
                item.locked = !item.locked;
        }
        if (!success)
            setMessage('当前条件不足，操作未执行。');
        setEvent(null);
        changed();
    }
    async function importFile(file: File) { try {
        if (file.size > 1000000)
            throw new Error('文件过大');
        const loaded = engine.hydrate(JSON.parse(await file.text()));
        setPending(loaded);
        setDialog('import');
    }
    catch {
        setMessage('导入失败，请选择有效的游戏 JSON 存档。');
    } }
    function exportFile() { save(); const url = URL.createObjectURL(new Blob([engine.serialize(stateRef.current!)], { type: 'application/json;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${definition.title}-修行存档.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    const view = { engine, state: s, onAction: action };
    const titles: Record<string, string> = { loadout: '自动战斗 · 能力配置', settings: '修行设置 · 存档', help: '修行入门', compare: '装备对比', offline: '久别归来，修行未歇', import: '确认导入存档' };
    return <div ref={host} className={`sia-game ${className}`} style={style} data-sia-theme="dark"><GameShell {...view} page={page}>{page === 'battle' ? <GameBattleStage {...view} event={event} sequence={sequence}/> : page === 'maps' ? <GameMapPanel {...view}/> : page === 'gear' ? <GameEquipmentPanel {...view}/> : <GamePetPanel {...view}/>}</GameShell>
  <GameDialog open={Boolean(dialog)} title={titles[dialog] || ''} onClose={() => setDialog('')} container={() => host.current!}>
  {dialog === 'loadout' && <GameLoadoutPanel {...view}/>}
  {dialog === 'settings' && <GameSavePanel onExport={exportFile} onImport={importFile}/>}
  {dialog === 'compare' && <GameEquipmentComparison {...view} itemId={itemId}/>}
  {dialog === 'help' && <div className="help-content"><p>开始挂机后，按所配置的回合间隔自动寻敌、移动、出手并拾取奖励。关闭页面后，下次进入结算最多 {(definition.offlineCapSeconds ?? 43200) / 3600} 小时的普通战斗收益。</p><ol><li>挂机获得经验、铜钱、装备和灵蕴。</li><li>更换装备，强化部位；强化不会随换装丢失。</li><li>结缘并培养伙伴，改变追击、治疗与减伤效果。</li><li>挑战首领，首通获得装备并解锁下一章。</li></ol><p>挑战失败不扣资源。首领战期间暂时不能换装、培养或切换地图。</p></div>}
  {dialog === 'offline' && report && <><p>离开 {Math.floor(report.seconds / 3600)} 小时 {Math.floor(report.seconds % 3600 / 60)} 分钟，收益已自动入账。</p><div className="offline-grid">{[['经验', report.xp], ['铜钱', report.gold], ['灵蕴', report.essence], ['装备掉落', report.drops]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div><p>击败 {report.kills} 个敌人，背包溢出掉落已转为锻材。</p><GameButton className="primary-button full" onClick={() => setDialog('')}>继续历练</GameButton></>}
  {dialog === 'import' && pending && <><p>即将载入 Lv.{pending.level} 的角色，已解锁 {pending.unlocked + 1} 章。确认后将替换当前存档。</p><GameButton className="primary-button full" disabled={Boolean(s.fight?.boss && s.fight.status === 'active')} onClick={() => { stateRef.current = pending; setPending(null); setDialog(''); setEvent(null); lastTick.current = Date.now(); changed(); setMessage('存档已导入。'); }}>确认替换当前存档</GameButton></>}
  </GameDialog><div className={`game-toast ${message ? 'visible' : ''}`} role="status">{message}</div></div>;
}
