/** 放置游戏的可序列化数值；攻击、防御、气血均为非负整数。 */
export interface GameStats {
    /** 每回合基础攻击。 */ atk: number;
    /** 抵扣攻击的防御。 */ def: number;
    /** 最大气血。 */ hp: number;
}
/** 用于头像、战场和图鉴的二维位图。框架不绘制单位贴图。 */
export interface GameUnitAsset {
    /** PNG/WebP 图片路径，由业务部署素材提供；建议透明背景。 */
    src: string;
    /** 显示在单位名下的门派或种族身份。 */
    identity: string;
    /** 武器、服饰及剪影特征说明。 */
    traits: string;
    /** 水平翻转图片，统一敌人朝左；默认 false。 */
    flip?: boolean;
}
/** 装备部位的生成规则。 */
export interface IdleSlotDefinition {
    /** 部位显示名。 */
    name: string;
    /** 按品质从低到高排列的装备名称；长度必须与 rarities 相同。 */
    names: string[];
    /** 零品质、零地图阶数时的基础属性。 */
    base: GameStats;
    /** 新角色是否自动装备该部位的零品质物品；默认 false。 */
    starter?: boolean;
}
/** 一个可顺序解锁的挂机章节。 */
export interface IdleMapDefinition {
    /** 从 0 开始连续递增，必须等于数组索引。 */
    id: number;
    /** 章节显示名。 */
    name: string;
    /** 地点或剧情副标题。 */
    subtitle: string;
    /** 建议等级文案，不限制进入条件。 */
    level: string;
    /** 普通怪物名称。 */
    enemy: string;
    /** 首领名称。 */
    boss: string;
    /** 普通怪物最大气血，正整数。 */
    hp: number;
    /** 普通怪物攻击，非负整数。 */
    atk: number;
    /** 首领最大气血，正整数。 */
    bossHp: number;
    /** 首领攻击，非负整数。 */
    bossAtk: number;
    /** 普通战斗获胜经验，非负整数。 */
    xp: number;
    /** 普通战斗获胜货币，非负整数。 */
    gold: number;
    /** 首通良品装备的部位键，必须存在于 slots。 */
    rewardSlot: string;
    /** 地图说明。 */
    desc: string;
    /** 不含角色、格线和 UI 的俯视背景位图路径；建议宽高比 900:580，中央留空供棋盘覆盖。六边形战场完整铺满该图，加载失败时使用暗色底板。 */
    scene: string;
    /** 普通怪物位图及身份。 */
    enemyArt: GameUnitAsset;
    /** 首领位图及身份。 */
    bossArt: GameUnitAsset;
    /** 首领第四回合重击的显示名；默认「蓄力重击」。 */
    bossSkillName?: string;
}
/** 可结缘、培养并参与回合结算的伙伴。 */
export interface IdlePetDefinition {
    /** 稳定唯一标识，写入存档。 */
    id: string;
    /** 灵宠名称。 */
    name: string;
    /** 职责显示名。 */
    kind: string;
    /** attack 仅追击；heal 每回合治疗；guard 使所受伤害乘 0.75。 */
    effect: 'attack' | 'heal' | 'guard';
    /** 职责和能力说明。 */
    desc: string;
    /** 结缘灵蕴；第一只伙伴默认获得，不扣费。 */
    cost: number;
    /** 攻击伙伴的一级追击伤害；治疗伙伴改用 7 + 等级 × 3，守护伙伴使用固定减伤。 */
    base: number;
    /** 伙伴透明位图及身份。 */
    art: GameUnitAsset;
}
/** 创建放置 RPG 的内容配置；创建后应保持引用稳定。 */
export interface IdleGameDefinition {
    /** 游戏标题。 */
    title: string;
    /** 可覆盖导航及页面标题；未提供字段使用中性的放置游戏文案。 */
    labels?: Partial<GameLabels>;
    /** 标题下方的题材说明。 */
    subtitle: string;
    /** 初始角色名；旧存档同样使用该可信配置名称。 */
    heroName: string;
    /** 主角位图和门派身份。 */
    hero: GameUnitAsset;
    /** 每三回合触发的技能名。 */
    skillName: string;
    /** localStorage 的独立键；修改会切换存档槽。 */
    saveKey: string;
    /** 至少一个章节，id 必须连续。 */
    maps: IdleMapDefinition[];
    /** 至少一个伙伴，第一只在新档中为一级。 */
    pets: IdlePetDefinition[];
    /** 至少一个装备部位，顺序用于展示和掉落。 */
    slots: Record<string, IdleSlotDefinition>;
    /** 至少三档品质名称，锻造使用第三级。 */
    rarities: string[];
    /** 离线模拟上限，单位秒；默认 43200，可设 0 关闭，最高 43200。 */
    offlineCapSeconds?: number;
    /** 自动回合间隔，单位毫秒；默认 1000，允许 1000 至 5000 的整数。在线与离线使用同一间隔。 */
    turnDurationMs?: number;
    /** 可装配的自动战斗能力；省略时使用框架默认组合，提供时四类能力都必须至少包含一项。 */
    abilities?: GameAbility[];
}
/** 框架生成并在导入时重建属性的装备。 */
export interface GameEquipment {
    /** 稳定唯一物品 ID。 */
    id: string;
    /** 部位键。 */
    slot: string;
    /** 从 0 开始的品质序号。 */
    tier: number;
    /** 生成时的地图阶数。 */
    rank: number;
    /** 由可信配置生成的装备名。 */
    name: string;
    /** 基础攻击。 */
    atk: number;
    /** 基础防御。 */
    def: number;
    /** 基础气血。 */
    hp: number;
    /** 为 true 时禁止分解。 */
    locked: boolean;
}
/** 当前战斗的可观察状态；不持久化正在进行的战斗。 */
export interface GameBattle {
    /** 当前棋盘单位，主角和灵宠固定 id，其余为本波敌人。 */ units: GameHexUnit[];
    /** 本波累计生成的小怪数量；普通战斗最多 4，首领战为 1。 */ spawned: number;
    /** 是否首领战。 */
    boss: boolean;
    /** 角色当前气血。 */
    hp: number;
    /** 角色开战时最大气血。 */
    maxHp: number;
    /** 敌人当前气血。 */
    enemyHp: number;
    /** 敌人开战时最大气血。 */
    enemyMax: number;
    /** 已执行回合数。 */
    turn: number;
    /** 进行中、获胜或失败。 */
    status: 'active' | 'won' | 'lost';
    /** 结算后的休整回合数，达到 2 后继续。 */
    recovery: number;
}
/** 最近的战斗记录，最多保留 60 条。 */
export interface GameLogEntry {
    /** 纯文本记录内容。 */
    text: string;
    /** 显示分类，info、loot、rare 或 boss。 */
    type: string;
    /** Unix 时间戳，单位毫秒。 */
    time: number;
}
/** 运行时可变状态；规则函数原位更新，React 宿主负责订阅刷新。 */
export interface IdleGameState {
    /** 当前存档版本为 1。 */
    version: number;
    /** 角色显示名。 */
    name: string;
    /** 等级，1 至 60。 */
    level: number;
    /** 当前等级经验。 */
    xp: number;
    /** 持有货币。 */
    gold: number;
    /** 伙伴成长资源。 */
    essence: number;
    /** 锻造材料。 */
    material: number;
    /** 当前地图索引。 */
    map: number;
    /** 最高已解锁地图索引。 */
    unlocked: number;
    /** 累计击败敌人数。 */
    kills: number;
    /** 累计首领胜利次数。 */
    bossWins: number;
    /** 下一件掉落的自增序号。 */
    nextId: number;
    /** 最后保存时间，Unix 毫秒。 */
    savedAt: number;
    /** 累计获得货币。 */
    sessionGold: number;
    /** 累计获得经验。 */
    sessionXp: number;
    /** 累计掉落数量，包含溢出转材料。 */
    sessionDrops: number;
    /** 是否继续普通挂机；暂停不产生离线收益。 */
    idle: boolean;
    /** 已首通地图索引。 */
    cleared: number[];
    /** 背包，容量 80。 */
    inventory: GameEquipment[];
    /** 按部位存储已穿装备。 */
    equipment: Record<string, GameEquipment | null>;
    /** 部位强化等级，0 至 10，更换装备保留。 */
    upgrades: Record<string, number>;
    /** 当前出战伙伴 ID。 */
    pet: string;
    /** 已解锁伙伴的等级，1 至 20。 */
    pets: Record<string, number>;
    /** 最近日志，序列化时不保存。 */
    logs: GameLogEntry[];
    /** 当前战斗；无战斗时为 null。 */
    fight: GameBattle | null;
    /** 四类自动战斗能力的配置 ID；导入时按可信能力列表校验，旧档自动使用默认组合。 */
    loadout: Record<GameAbilityKind, string>;
}
/** 四个装配槽；普攻无冷却，技能、神通、法宝按各自周期自动施放。 */
export type GameAbilityKind = 'attack' | 'skill' | 'power' | 'treasure';
/** 由宿主提供名称和数值的自动战斗能力。 */
export interface GameAbility {
    /** 能力唯一 ID，写入存档。 */ id: string;
    /** 显示名。 */ name: string;
    /** 归属装配槽。 */ kind: GameAbilityKind;
    /** 单体伤害、目标周围一格群伤、治疗或本回合护盾。 */ effect: 'damage' | 'blast' | 'heal' | 'shield';
    /** 六边形格距离，1 至 3；治疗与护盾只作用自身。 */ range: number;
    /** 伤害乘攻击、治疗乘最大气血的系数；shield 为减伤比例，0 至 0.8。 */ scale: number;
    /** 自动施放周期，正整数回合；普攻固定为 1，其余至少 2。 */ cooldown: number;
    /** 给玩家解释效果的纯文本。 */ description: string;
}
/** 轴向六边形坐标，棋盘满足 max(abs(q),abs(r),abs(q+r)) <= 3。 */
export interface GameHexCell {
    /** 轴向列坐标。 */ q: number;
    /** 轴向行坐标。 */ r: number;
}
/** 棋盘上的一个单位，其贴图只绘制在六边形棋子顶面。 */
export interface GameHexUnit extends GameHexCell {
    /** 主角为 hero、伙伴为 pet，敌人由引擎生成唯一 ID。 */ id: string;
    /** 友方主角、友方伙伴或敌方。 */ side: 'hero' | 'pet' | 'enemy';
    /** 当前气血，伙伴不会单独受到攻击。 */ hp: number;
    /** 最大气血。 */ maxHp: number;
}
/** 回合中的一项有序表现事件；at 为回合时长的归一化比例。 */
export interface GameHexCue {
    /** 事件开始比例，0 至 1，只有到达该时刻后才显示对应数值。 */ at: number;
    /** 逐格移动、出手、命中、治疗、护盾、消散、掉落或生成。 */ kind: 'move' | 'cast' | 'hit' | 'heal' | 'shield' | 'death' | 'loot' | 'spawn';
    /** 发起事件的单位 ID。 */ actor: string;
    /** 事件目标 ID；无目标时省略。 */ target?: string;
    /** 移动的起始格。 */ from?: GameHexCell;
    /** 移动的终点格。 */ to?: GameHexCell;
    /** 伤害、治疗或铜钱数值。 */ value?: number;
    /** 事件生效后的目标气血。 */ hp?: number;
    /** 技能名、掉落名等纯文本提示。 */ label?: string;
}
/** 单回合的伤害及奖励通知；无推进时 tick 返回 null。 */
export interface GameBattleEvent {
    /** 回合表现快照；由引擎生成，用于命中前后分别显示气血，不修改规则状态。 */
    playback?: GameBattlePlayback;
    /** 主角造成的伤害。 */
    damage: number;
    /** 伙伴追击伤害。 */
    petDamage: number;
    /** 是否暴击。 */
    crit: boolean;
    /** 是否使用技能或法宝；普攻时为 false。 */
    skill: boolean;
    /** 角色承受伤害。 */
    incoming: number;
    /** 本回合击败首领时为 true。 */
    bossWin?: boolean;
    /** 首领是否首次通关。 */
    first?: boolean;
    /** 首通装备名称。 */
    reward?: string;
    /** 普通战斗装备掉落名称。 */
    drop?: string;
    /** 本回合战斗失败时为 true。 */
    lost?: boolean;
}
/** 一次回合的不可变数值快照；所有气血都是该回合对应时刻的实际值。 */
export interface GameBattlePlayback {
    /** 回合开始时的棋盘快照；后续状态修改不影响此数组。 */ units: GameHexUnit[];
    /** 已按时刻排序的棋盘动作与命中事件。 */ cues: GameHexCue[];
    /** 当前回合序号，从 1 开始。 */ turn: number;
    /** 是否为首领战。 */ boss: boolean;
    /** 本回合敌方招式：普通攻击、蓄力、重击或喘息。 */ move: 'strike' | 'charge' | 'heavy' | 'recover';
    /** 主角出手前的气血。 */ heroBefore: number;
    /** 敌方命中后、治疗前的气血。 */ heroAfterImpact: number;
    /** 治疗结算后的气血。 */ heroAfter: number;
    /** 敌人回合开始时的气血。 */ enemyBefore: number;
    /** 主角命中后的敌方气血。 */ enemyAfterHero: number;
    /** 灵宠追击后的敌方气血。 */ enemyAfter: number;
    /** 实际恢复气血，满血及致死受击均为 0，不会复活。 */ healed: number;
    /** 是否携带守护灵宠，由地块护盾效果表现。 */ guarded: boolean;
    /** 本回合是否击败敌人。 */ won: boolean;
    /** 本回合已入账经验；未击败时为 0。 */ xp: number;
    /** 本回合已入账铜钱；未击败时为 0。 */ gold: number;
}
/** 已入账的离线收益报告。 */
export interface GameOfflineReport {
    /** 实际模拟秒数，受配置上限约束。 */
    seconds: number;
    /** 新增经验，包含升级消耗。 */
    xp: number;
    /** 新增货币。 */
    gold: number;
    /** 装备掉落总数。 */
    drops: number;
    /** 新增伙伴资源。 */
    essence: number;
    /** 击败敌人总数。 */
    kills: number;
}
/** 与题材解耦的规则句柄；全部数值行为同步执行，不发出网络请求。 */
export interface IdleEngine {
    /** 创建引擎时传入的可信内容配置。 */
    definition: IdleGameDefinition;
    /** 创建新档；now 为 Unix 毫秒，默认 Date.now()。 */
    freshState: (now?: number) => IdleGameState;
    /** 根据部位和品质生成可信属性；默认 tier/rank 为 0，id 为当前时间。 */
    makeGear: (slot: string, tier?: number, rank?: number, id?: string | number) => GameEquipment;
    /** 返回当前等级升级所需经验。 */
    xpNeeded: (state: IdleGameState) => number;
    /** 合并等级、装备及部位强化，返回战斗数值。 */
    stats: (state: IdleGameState) => GameCombatStats;
    /** 立即追加记录；type 默认 info，超出 60 条裁掉最旧记录。 */
    addLog: (state: IdleGameState, text: string, type?: string) => void;
    /** 增加经验和货币，并循环升级直到经验不足或达到 60 级。 */
    grant: (state: IdleGameState, xp: number, gold: number) => void;
    /** 开始普通战斗或首领战；boss 默认 false，锁定挑战期间不可再次开始。 */
    beginFight: (state: IdleGameState, boss?: boolean) => void;
    /** 推进一个战术回合；实际时间由 turnDurationMs 控制；rng 默认 Math.random；暂停且无首领战时返回 null。 */
    tick: (state: IdleGameState, rng?: () => number) => GameBattleEvent | null;
    /** 穿戴背包装备，旧装备回到背包；首领战或物品不存在时返回 false。 */
    equip: (state: IdleGameState, id: string) => boolean;
    /** 返回指定部位下一次强化的货币消耗。 */
    upgradeCost: (state: IdleGameState, slot: string) => number;
    /** 扣费强化，最高 10；条件不足或首领战时返回 false，不扣费。 */
    upgrade: (state: IdleGameState, slot: string) => boolean;
    /** 分解未锁定物品获得材料；失败返回 false。 */
    dismantle: (state: IdleGameState, id: string) => boolean;
    /** 消耗 12 材料锻造第三级装备；材料不足或首领战时返回 false。 */
    forge: (state: IdleGameState) => boolean;
    /** 按当前等级乘 15 扣费培养，最高 20；失败不扣费。 */
    trainPet: (state: IdleGameState, id: string) => boolean;
    /** 扣除伙伴配置的结缘费用；已拥有、不足或首领战时返回 false。 */
    unlockPet: (state: IdleGameState, id: string) => boolean;
    /** 校验导入值并重建装备属性；不支持版本或结构错误时抛出 Error；now 默认当前毫秒。 */
    hydrate: (raw: unknown, now?: number) => IdleGameState;
    /** 按普通战斗模拟离线秒数并入账，最多 offlineCapSeconds；少于 15 秒或暂停返回 null；更新时间避免重复结算。 */
    settleOffline: (state: IdleGameState, now?: number, rng?: () => number) => GameOfflineReport | null;
    /** 输出 JSON 存档副本，清除战斗和日志；now 默认为当前毫秒，不修改原状态。 */
    serialize: (state: IdleGameState, now?: number) => string;
}
/** 合并装备后的角色战斗属性。 */
export interface GameCombatStats extends GameStats {
    /** 综合战力，用于角色栏显示。 */
    power: number;
}
/** 游戏导航与主要页面标题的本地化文案。 */
export interface GameLabels {
    /** 战场导航，默认「挂机历练」。 */ battle: string;
    /** 地图导航，默认「世界地图」。 */ maps: string;
    /** 装备导航，默认「装备背包」。 */ gear: string;
    /** 伙伴导航，默认「伙伴图鉴」。 */ pets: string;
    /** 地图页标题，默认「探索新的旅程」。 */ mapsTitle: string;
    /** 装备页标题，默认「整理装备，提升实力」。 */ gearTitle: string;
    /** 伙伴页标题，默认「伙伴同行」。 */ petsTitle: string;
}
