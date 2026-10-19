import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../components/Button';
import type { ButtonProps } from '../components/Button';
import { GameHexBattlefield } from './HexBattlefield';
import { gameAbilities } from './hex-rules';
import { Modal } from '../components/Modal';
import type { IdleEngine, IdleGameState, GameUnitAsset, GameBattleEvent, GameEquipment } from './types';
/** 框架页面标识；默认进入 battle，分别代表战场、地图、装备和伙伴。 */
export type GamePage = 'battle' | 'maps' | 'gear' | 'pets';
/** 同步游戏命令标识；宿主根据命令更新状态，组件不直接修改受控状态。 */
export type GameActionType = 'page' | 'idle' | 'boss' | 'map' | 'equip' | 'upgrade' | 'dismantle' | 'lock' | 'forge' | 'train' | 'unlock' | 'deploy' | 'inspect' | 'loadout' | 'configure' | 'settings' | 'help';
/** 从框架组件发给宿主的同步操作。 */
export interface GameAction {
    /** 操作类型。 */ type: GameActionType;
    /** 页面、物品、部位、地图索引字符串或伙伴 ID；idle/boss/settings/help 不需要。 */ id?: string;
}
/** 框架各游戏面板的受控输入。 */
export interface GameViewProps {
    /** 与题材配置绑定的规则引擎，引用应保持稳定。 */ engine: IdleEngine;
    /** 当前状态；组件只读，修改后由宿主触发重新渲染。 */ state: IdleGameState;
    /** 用户点击有效操作时同步通知宿主；禁用按钮不会通知。 */ onAction: (action: GameAction) => void;
}
/** 完整游戏三栏布局的属性。 */
export interface GameShellProps extends GameViewProps {
    /** 当前导航页，由 onAction 的 page 命令更新。 */ page: GamePage;
    /** 框架面板组成的中央内容。 */ children: ReactNode;
}
/** 二维单位展示属性。 */
export interface GameSpriteProps {
    /** 可信位图地址及朝向。 */ asset: GameUnitAsset;
    /** 图片容器附加类，默认无。 */ className?: string;
}
/** 战场的回合表现属性。 */
export interface GameBattleStageProps extends GameViewProps {
    /** 最近回合事件；null 不显示伤害，默认无事件。 */ event?: GameBattleEvent | null;
    /** 每次有效回合递增，用于重新触发 CSS 动效；默认 0。 */ sequence?: number;
}
/** 可复用资源条的属性。 */
export interface GameResourceSummaryProps {
    /** 已获得的经验、货币与掉落，组件只读。 */ state: IdleGameState;
}
/** 位图以原始透明度显示；不添加立体阴影或生成矢量替代图。 */
export function GameSprite({ asset, className = '' }: GameSpriteProps) {
    return <img className={`unit-art ${asset.flip ? 'face-left' : ''} ${className}`} src={asset.src} alt="" aria-hidden="true" draggable={false} decoding="async"/>;
}
/** 复用 Sia Button 的焦点、禁用、键盘和点击语义，并应用游戏皮肤。 */
export function GameButton({ className = '', ...props }: ButtonProps) {
    return <Button {...props} className={`game-button ${className}`}/>;
}
const fmt = (n: number) => Math.floor(n).toLocaleString('zh-CN');
const busy = (s: IdleGameState) => Boolean(s.fight?.boss && s.fight.status === 'active');
const command = (fn: GameViewProps['onAction'], type: GameActionType, id?: string) => () => fn({ type, id });
function Title({ kicker, title, children }: {
    kicker: string;
    title: string;
    children?: ReactNode;
}) {
    return <div className="view-title"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1></div>{children}</div>;
}
function ItemStats({ item }: {
    item: GameEquipment;
}) {
    return <div className="item-stats"><span>攻击 +{item.atk}</span><span>防御 +{item.def}</span><span>气血 +{item.hp}</span></div>;
}
/** 标题、导航、角色栏、内容区、首领与日志组成的响应式三栏外壳。 */
export function GameShell({ engine, state, onAction, page, children }: GameShellProps) {
    const d = engine.definition, view = { engine, state, onAction };
    return <><header className="topbar"><div className="brand"><span className="brand-seal">{d.title[0]}</span><span className="brand-title">{d.title}<small>{d.subtitle}</small></span></div><div className="realm"><span className="live-dot"/>单人修行 / 放置历练</div><div className="top-actions"><span className="version">Sia Game · v0.3</span><GameButton className="icon-button" aria-label="设置与存档" onClick={command(onAction, 'settings')}>⚙</GameButton></div></header>
  <nav className="navigation" aria-label="主导航">{([['battle', '⚔', '挂机历练'], ['maps', '▧', '世界地图'], ['gear', '▣', '装备背包'], ['pets', '♧', '伙伴图鉴']] as const).map(([id, icon, text]) => <GameButton key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={command(onAction, 'page', id)}><span aria-hidden="true">{icon}</span>{d.labels?.[id] || text}{id === 'gear' && <span className="nav-count">{state.inventory.length}</span>}</GameButton>)}<span className="nav-verse">{d.subtitle}</span></nav>
  <div className="workspace"><aside className="character-panel"><GameCharacterPanel {...view}/></aside><main>{children}</main><aside className="right-panel"><GameBossPanel {...view}/><GameLogPanel {...view}/><div className="save-state">本地自动存档 · 离线上限 {(d.offlineCapSeconds ?? 43200) / 3600} 小时</div></aside></div><footer>{d.title} / {d.subtitle}<span>由 SiaWebUI Game Framework 驱动</span></footer></>;
}
/** 展示角色属性、货币、已穿装备与出战伙伴；操作通过 onAction 通知宿主。 */
export function GameCharacterPanel({ engine, state: s, onAction }: GameViewProps) {
    const d = engine.definition, st = engine.stats(s), pet = d.pets.find(p => p.id === s.pet)!;
    return <><div className="profile-top"><div className="avatar"><GameSprite asset={d.hero}/></div><div><span className="eyebrow">{d.hero.identity}</span><h2>{s.name}</h2><span className="level-tag">Lv.{s.level} <span>修行者</span></span></div></div><div className="power"><span>综合战力</span><strong>{fmt(st.power)}</strong></div><div className="experience"><div><span>修行经验</span><span>{fmt(s.xp)} / {engine.xpNeeded(s)}</span></div><div className="progress" role="progressbar" aria-label="修行经验" aria-valuenow={s.xp} aria-valuemin={0} aria-valuemax={engine.xpNeeded(s)}><i style={{ width: `${Math.min(100, s.xp / engine.xpNeeded(s) * 100)}%` }}/></div></div><div className="attributes">{[['气血', st.hp], ['攻击', st.atk], ['防御', st.def], ['暴击', '13%']].map(([name, value]) => <div key={name}><span>{name}</span><b>{value}</b></div>)}</div><div className="line-heading">随身资财</div><div className="wallet">{[['铜钱', s.gold], ['灵蕴', s.essence], ['锻材', s.material]].map(([name, value]) => <div key={name}><span>{name}</span><b>{fmt(Number(value))}</b></div>)}</div><div className="line-heading"><span>身上装备</span><GameButton className="text-button" onClick={command(onAction, 'page', 'gear')}>管理 ›</GameButton></div><div className="equipped-list">{Object.entries(d.slots).map(([key, slot]) => <GameButton key={key} className="equipped-item" onClick={command(onAction, 'page', 'gear')}><span className="slot-symbol">◇</span><span><small>{slot.name}</small><b>{s.equipment[key]?.name || '尚未装备'}</b></span><em>{s.upgrades[key] ? `+${s.upgrades[key]}` : '›'}</em></GameButton>)}</div><GameButton className="pet-mini" onClick={command(onAction, 'page', 'pets')}><span className="pet-mini-art"><GameSprite asset={pet.art}/></span><span><small>出战灵宠</small><b>{pet.name} <em>Lv.{s.pets[s.pet]}</em></b></span></GameButton><div className="character-bottom">{s.idle ? '● 正在挂机修行' : '○ 闲庭信步 · 等待历练'}</div></>;
}
/** 六边形自动战场与能力配置入口；真实规则快照交给棋盘组件分时播放。 */
export function GameBattleStage({ engine, state: s, onAction, event, sequence = 0 }: GameBattleStageProps) {
    const d=engine.definition,m=d.maps[s.map];
    return <><Title kicker={`西行历练 / 第 ${s.map+1} 章`} title={m.name}><GameButton className="subtle-button" onClick={command(onAction,'loadout')}>配置战斗</GameButton></Title>
    <GameHexBattlefield engine={engine} state={s} onAction={onAction} event={event} sequence={sequence}/>
    <div className="battle-controls"><div className="status-label">{busy(s)?'首领挑战 · 自动迎战':s.idle?'六方来敌，自动修行':'整备棋阵，静候出发'}<small>逐格移动 · 按配置施法 · 自动拾取</small></div><GameButton className="primary-button" disabled={busy(s)} onClick={command(onAction,'idle')}>{s.idle?'暂停挂机':'开始挂机'}</GameButton></div>
    <div className="hex-build-bar">{([['attack','攻击'],['skill','技能'],['power','神通'],['treasure','法宝']] as const).map(([kind,label])=><span key={kind}><b>{label}</b>{gameAbilities(d).find(a=>a.id===s.loadout[kind])?.name}</span>)}</div>
    <GameResourceSummary state={s}/><div className="tip"><p>小妖从边缘格靠近，进入邻格才攻击。首领现身会清退所有小妖。</p><GameButton className="text-button" disabled={busy(s)} onClick={command(onAction,'page','maps')}>切换地图 ›</GameButton></div></>;
}
/** 显示累计战利品；包括背包溢出后转为材料的掉落数量。 */
export function GameResourceSummary({ state: s }: GameResourceSummaryProps) { return <section className="income"><div className="panel-heading"><h3>修行累计所得</h3><span>累计击败 {fmt(s.kills)} 个敌人</span></div><div className="income-grid">{[['经验', s.sessionXp], ['铜钱', s.sessionGold], ['装备', s.sessionDrops]].map(([label, value]) => <div key={label}><span>{label}</span><b>{fmt(Number(value))}{label === '装备' ? ' 件' : ''}</b></div>)}</div></section>; }
/** 显示地图首领、首通奖励和挑战入口；战斗过程中禁用重复挑战。 */
export function GameBossPanel({ engine, state: s, onAction }: GameViewProps) { const d = engine.definition, m = d.maps[s.map], cleared = s.cleared.includes(s.map); return <section id="quest"><div className="panel-heading"><h3>⚔ 章节妖王</h3><span>第 {s.map + 1} / {d.maps.length} 章</span></div><div className="boss-portrait"><GameSprite asset={m.bossArt}/><span className="boss-seal">{cleared ? '已破' : '妖王'}</span></div><div className="boss-title"><h2>{m.boss}</h2><span>{m.bossArt.identity}</span></div><p className="identity-traits">{m.bossArt.traits}</p><div className="boss-stats"><span>气血 {fmt(m.bossHp)}</span><span>攻击 {m.bossAtk}</span></div><div className="boss-reward"><small>{cleared ? '再次挑战奖励' : '首次击败奖励'}</small><div>{cleared ? '铜钱、经验、灵蕴' : d.slots[m.rewardSlot].names[1] + ' · 灵蕴 ×50'}</div></div><GameButton className="boss-button" disabled={busy(s)} onClick={command(onAction, 'boss')}>{busy(s) ? '正在挑战…' : cleared ? '再次挑战' : '挑战妖王'}</GameButton><p className="boss-hint">{s.map < d.maps.length - 1 ? `首次击败，解锁「${d.maps[s.map + 1].name}」` : '完成挑战，通关全部章节试炼'}</p></section>; }
/** 最新日志置顶，最多显示 60 条；文本由 React 转义，不接受 HTML。 */
export function GameLogPanel({ state: s }: GameViewProps) { return <section className="journal"><div className="panel-heading"><h3>▤ 三界见闻</h3><span>实时战报</span></div><div id="logs" role="log" aria-label="战斗记录">{s.logs.map((log, i) => <div key={`${log.time}-${i}`} className={`log-line ${log.type}`}><time>{new Date(log.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time><span>{log.text}</span></div>)}</div></section>; }
/** 按首通进度开放章节；地图图像来自配置，未开放项不可点击。 */
export function GameMapPanel({ engine, state: s, onAction }: GameViewProps) { const d = engine.definition; return <><Title kicker="三界舆图 / 西行之路" title={d.labels?.mapsTitle || "探索新的旅程"}/><p className="view-description">踏过一重山，再赴下一程。击败章节妖王，即可开启新的历练。</p><div className="map-list">{d.maps.map((m, i) => <GameButton key={m.id} className={`map-card ${s.map === i ? 'current' : ''}`} disabled={i > s.unlocked || busy(s)} onClick={command(onAction, 'map', String(i))}><div className="map-art"><img className="landscape" src={m.scene} alt=""/></div><span className="map-number">{String(i + 1).padStart(2, '0')}</span><div className="map-content"><span className="eyebrow">{m.subtitle}</span><h2>{m.name}</h2><p>{m.desc}</p><div className="map-meta">建议等级 {m.level} · 击败奖励 {m.xp} 经验 / {m.gold} 铜钱</div></div><span className="map-state">{i > s.unlocked ? '击败上一章妖王解锁' : s.map === i ? '当前历练' : '前往历练'}</span></GameButton>)}</div><div className="tip">当前已解锁 {s.unlocked + 1} / {d.maps.length} 章。</div></>; }
/** 伙伴卡片与结缘、培养、出战操作；首领进行中统一禁用成长操作。 */
export function GamePetPanel({ engine, state: s, onAction }: GameViewProps) { const d = engine.definition; return <><Title kicker="灵宠洞天 / 有灵相伴" title={d.labels?.petsTitle || "伙伴同行"}><span className="capacity">灵蕴 {fmt(s.essence)}</span></Title><p className="view-description">灵宠随你自动出战。不同的伙伴，让每一段修行各有章法。</p><div className="pet-cards">{d.pets.map(p => <article key={p.id} className={`pet-card ${s.pet === p.id ? 'selected' : ''}`}><div className="pet-card-head"><span className="pet-kind">{p.kind}</span><span>{s.pets[p.id] ? `Lv.${s.pets[p.id]}` : '尚未结缘'}</span></div><div className="pet-art"><GameSprite asset={p.art}/></div><h2>{p.name}</h2><p className="identity-traits">{p.art.traits}</p><p>{p.desc}</p><div className="pet-stat">{p.effect === 'heal' ? '每回合治疗' : p.effect === 'guard' ? '受到伤害降低' : '追击伤害'} <b>{p.effect === 'guard' ? '25%' : p.effect === 'heal' ? 7 + (s.pets[p.id] || 1) * 3 : p.base + ((s.pets[p.id] || 1) - 1) * 3}</b></div>{s.pets[p.id] ? <><GameButton className="subtle-button" disabled={busy(s) || s.pet === p.id} onClick={command(onAction, 'deploy', p.id)}>{s.pet === p.id ? '正在出战' : '设为出战'}</GameButton><GameButton className="primary-button" disabled={busy(s) || s.pets[p.id] >= 20 || s.essence < s.pets[p.id] * 15} onClick={command(onAction, 'train', p.id)}>{s.pets[p.id] >= 20 ? '已达最高等级' : `培养 · ${s.pets[p.id] * 15} 灵蕴`}</GameButton></> : <GameButton className="primary-button" disabled={busy(s) || s.essence < p.cost} onClick={command(onAction, 'unlock', p.id)}>结缘 · {p.cost} 灵蕴</GameButton>}</article>)}</div><div className="tip">普通战斗获得 2 灵蕴，首领首通获得 50 灵蕴。培养提升追击伤害。</div></>; }
/** 已穿装备、强化、背包与锁定分解组成的装备面板；品质和部位来自配置。 */
export function GameEquipmentPanel({ engine, state: s, onAction }: GameViewProps) { const [filter, setFilter] = useState('all'); const d = engine.definition; const inventory = s.inventory.filter(item => filter === 'all' || item.slot === filter); return <><Title kicker="行囊装备 / 百炼成器" title={d.labels?.gearTitle || "整理装备，提升实力"}><span className="capacity">行囊 {s.inventory.length} / 80</span></Title><div className="gear-slots">{Object.entries(d.slots).map(([key, slot]) => <section className="gear-slot" key={key}><div className="gear-info"><span className="eyebrow">{slot.name} · 强化 +{s.upgrades[key]}</span><h3>{s.equipment[key]?.name || '尚未装备'}</h3>{s.equipment[key] && <ItemStats item={s.equipment[key]!}/>}</div><GameButton className="small-button" disabled={busy(s) || !s.equipment[key] || s.upgrades[key] >= 10 || s.gold < engine.upgradeCost(s, key)} onClick={command(onAction, 'upgrade', key)}>{s.upgrades[key] >= 10 ? '已强化至上限' : `强化 · ${engine.upgradeCost(s, key)} 铜钱`}</GameButton></section>)}</div><div className="inventory-toolbar"><div className="filters">{[["all", "全部"], ...Object.entries(d.slots).map(([key, slot]) => [key, slot.name])].map(([key, name]) => <GameButton key={key} className={`filter ${filter === key ? "active" : ""}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{name}</GameButton>)}</div><span>锻材 {s.material}</span><GameButton className="subtle-button" disabled={busy(s) || s.material < 12} onClick={command(onAction, 'forge')}>锻造上品 · 12 锻材</GameButton></div><div className="inventory-list">{inventory.length ? inventory.map(item => <article className="item-row" key={item.id}><span className={`item-icon rarity-${item.tier}`}>◇</span><div className="item-detail"><strong>{item.name} <small>{d.rarities[item.tier]} · {d.slots[item.slot].name}</small></strong><ItemStats item={item}/></div><GameButton className="small-button" onClick={command(onAction, 'inspect', item.id)}>对比</GameButton><GameButton className="small-button jade-button" disabled={busy(s)} onClick={command(onAction, 'equip', item.id)}>装备</GameButton><GameButton className="text-button" disabled={busy(s)} onClick={command(onAction, 'lock', item.id)}>{item.locked ? '解锁' : '锁定'}</GameButton><GameButton className="text-button" disabled={busy(s) || item.locked} onClick={command(onAction, 'dismantle', item.id)}>分解</GameButton></article>) : <div className="empty-state"><h3>行囊尚有余地</h3><p>挂机击败妖怪，有机会拾得装备。</p><GameButton className="subtle-button" onClick={command(onAction, 'page', 'battle')}>前往历练</GameButton></div>}</div><div className="tip">强化随部位继承。背包满后，新掉落转为锻材；锁定装备不能分解。</div></>; }
/** 框架存档操作区的属性。 */
export interface GameSavePanelProps {
    /** 点击导出时同步调用，宿主应保存并下载 JSON。 */ onExport: () => void;
    /** 选择 JSON 文件后调用；宿主负责验证与二次确认，回调可异步。 */ onImport: (file: File) => void | Promise<void>;
}
/** JSON 文件选择和导出入口；同文件可再次选择，不执行自动覆盖存档。 */
export function GameSavePanel({ onExport, onImport }: GameSavePanelProps) { const input = useRef<HTMLInputElement>(null); return <div className="help-content"><p>进度自动保存在当前浏览器。导入通过校验后，需要再次确认才能替换当前进度。</p><div className="settings-actions"><GameButton className="subtle-button" onClick={onExport}>导出存档</GameButton><GameButton className="subtle-button" onClick={() => input.current?.click()}>导入存档</GameButton><input ref={input} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file)
    void onImport(file); }}/></div><p>存档保存在本机，不包含账号同步和多人联网。</p></div>; }
/** 复用 Sia Modal 的游戏对话框输入。 */
export interface GameDialogProps {
    /** 是否打开；由 onClose 通知宿主更新。 */ open: boolean;
    /** 弹框标题。 */ title: string;
    /** 可信 React 内容，不接受 HTML 字符串注入。 */ children?: ReactNode;
    /** 点击关闭、遮罩或 Escape 时同步调用。 */ onClose: () => void;
    /** 提供游戏根容器，使浮层继承游戏主题；默认 document.body。 */ container?: () => HTMLElement;
}
/** 游戏皮肤的 Sia 模态框；键盘焦点、Esc 和遮罩关闭由 Sia Modal 管理。 */
export function GameDialog({ open, title, children, onClose, container }: GameDialogProps) { return <Modal open={open} title={title} footer={null} centered className="sia-game-dialog" onCancel={onClose} getContainer={container}>{children}</Modal>; }
/** 装备对比面板的输入。 */
export interface GameEquipmentComparisonProps extends GameViewProps {
    /** 待对比的背包物品 ID；不存在时显示已移除提示。 */ itemId: string;
}
/** 对比两件装备基础属性；同部位强化保留，不计入基础属性差值。 */
export function GameEquipmentComparison({ engine, state: s, onAction, itemId }: GameEquipmentComparisonProps) { const item = s.inventory.find(i => i.id === itemId); if (!item)
    return <p>物品已不在背包中。</p>; const old = s.equipment[item.slot]; return <><div className="compare"><section><span className="eyebrow">当前装备</span><h3>{old?.name || '未装备'}</h3>{old && <ItemStats item={old}/>}</section><section><span className="eyebrow">待装备 · {engine.definition.rarities[item.tier]}</span><h3>{item.name}</h3><ItemStats item={item}/></section></div><p>同部位强化 +{s.upgrades[item.slot]} 完整继承。</p><div className="compare-delta">{(['atk', 'def', 'hp'] as const).map((key, i) => { const delta = item[key] - (old?.[key] || 0); return <span key={key} className={delta >= 0 ? 'jade' : 'red-text'}>{['攻击', '防御', '气血'][i]} {delta >= 0 ? '+' : ''}{delta}</span>; })}</div><GameButton className="primary-button full" disabled={busy(s)} onClick={command(onAction, 'equip', item.id)}>装备</GameButton></>; }
