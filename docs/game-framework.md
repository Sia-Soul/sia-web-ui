# Sia 放置游戏框架

## 目录和依赖边界

- `packages/react/src/game/`：框架组件、类型、规则引擎、运行时和游戏样式的唯一源码。
- `packages/react/src/game.ts`：主库 `@sia.soul/sia-react-ui/game` 入口。
- `packages/react-game`：仅依赖 React/ReactDOM 的独立发行包；构建时包含所需 Sia 基础组件，不携带编辑器、地图 SDK 或图表。
- 业务项目只存放内容配置、图片、入口和测试；没有业务组件、HTML 字符串模板、组件 CSS 或复制的引擎。

先在框架里添加所需组件，再通过发行入口引用。独立包由同一份源文件构建；禁止直接编辑独立包 dist 或业务 vendor 包。

## 可复用组件

| 导出 | 职责 |
| --- | --- |
| IdleGameApp | 完整宿主：状态、定时器、存档、离线补算和页面装配 |
| GameShell | 标题、导航与响应式三栏 |
| GameCharacterPanel | 属性、资源、装备摘要与出战伙伴 |
| GameBattleStage / GameSprite | 位图战场、单位、血条、身份、回合表现 |
| GameMapPanel | 地图解锁与选择 |
| GameEquipmentPanel / GameEquipmentComparison | 装备、筛选、强化、对比、锁定、分解、锻造 |
| GamePetPanel | 伙伴结缘、出战、培养 |
| GameBossPanel / GameLogPanel | 首领挑战和战报 |
| GameResourceSummary | 累计奖励 |
| GameSavePanel / GameDialog | 文件选择和 Sia 模态框 |
| GameButton | 复用 Sia Button 的游戏皮肤 |
| createIdleEngine | 无 DOM 的同步规则，供测试或其他宿主调用 |

面板接收 `engine/state/onAction`，状态受控；视图不直接修改数据。宿主统一处理命令，规则层同样阻止首领战期间换装和成长，不能通过绕过 UI 改变本次战斗。

## 内容配置

`IdleGameDefinition` 包含标题、主角位图、门派身份、技能名、存档键、导航文案、章节、伙伴、装备部位及品质。场景图、单位图均由业务以 PNG/WebP 路径注入，框架不绘制 SVG 贴图。

章节 id 从 0 连续递增，首通解锁下一项。配置不限定三章；每章 `rewardSlot` 引用已存在部位。装备部位不限定四个；名称数组长度与品质数量相同。伙伴 `effect` 明确指定 attack/heal/guard，不依赖某个中文名称或固定 ID。不同游戏必须使用不同 saveKey。

```ts
// 新主题可以改用不同伙伴 ID、地图和装备槽；规则不依赖西游常量。
const definition: IdleGameDefinition = {
  title: '荒原探索', subtitle: '放置历练', heroName: '旅者', skillName: '强击', saveKey: 'wasteland-v1',
  hero: { src: 'assets/traveler.png', identity: '游侠', traits: '斗篷 · 短剑' },
  rarities: ['普通', '优秀', '稀有'],
  slots: { tool: { name: '工具', names: ['木剑', '铁剑', '银剑'], base: {atk:7,def:0,hp:4}, starter:true } },
  pets: [{ id:'owl', name:'侦察鸮', kind:'追击', effect:'attack', desc:'每回合追击', cost:0, base:7,
    art:{src:'assets/owl.png',identity:'飞行伙伴',traits:'双翼'} }],
  maps: [{id:0,name:'林地',subtitle:'第一站',level:'1—5',enemy:'野兽',boss:'兽王',hp:72,atk:9,bossHp:590,bossAtk:24,xp:24,gold:18,rewardSlot:'tool',desc:'林间探索',scene:'assets/forest.png',
    enemyArt:{src:'assets/beast.png',identity:'野兽',traits:'利爪'},bossArt:{src:'assets/king.png',identity:'首领',traits:'巨角'}}]
};
```

## 运行与存档约定

在线按 turnDurationMs 推进回合（默认 1000 毫秒，西游配置 1800 毫秒）；首领最多 60 回合；背包容量 80，溢出转材料。等级上限 60、强化上限 10、伙伴等级上限 20。这些是第一版规则，尚未抽象成插件式数值系统。

隐藏页面时保存并暂停在线计时；恢复后按同一规则补算普通战斗。默认上限 43200 秒（12 小时），可配置 0 至 43200。离线不首通首领，结算更新时间防止重复领取。卸载清理时钟和监听，多个实例的内存状态互相独立。同一 saveKey 不支持多标签并发编辑。

存档版本 1；导入校验结构、数字范围及物品归属，装备名称和属性从可信配置重建。文件最多 1MB，确认后才替换。图片、回合动作和当前日志不写入存档。浏览器存储失败时提示导出，未提供服务器账号或反作弊。

## 样式与素材

游戏样式放在 `.sia-game` 作用域，复用 Sia Button/Modal 交互。布局宽屏三栏，1190px 以下首领栏下移，760px 以下单列。

- `--game-accent`：奖励与修为强调色，默认 `#e0bd78`，CSS 颜色值；宿主 style 或祖先同名变量优先。
- `--game-background`：页面背景，默认 `#10151e`，CSS 颜色值；覆盖规则同上。

默认皮肤由框架的 `game/dark-theme.css` 提供：炭黑背景、蓝灰面板、青蓝交互态和金色奖励。导航、角色栏、背包、灵宠、首领及弹窗统一应用该皮肤；场景和单位位图不添加主题滤镜，保留平涂赛璐璐美术。业务只导入框架样式，不复制或覆盖组件 CSS。

其余变量是内部皮肤实现。图片与场景采用干净线稿、平涂、硬边赛璐璐阴影，避免厚涂及三维材质。战斗采用六边形棋子移动、命中反馈与独立治疗，角色位图绘制在棋子顶面；无骨骼动画和装备换装模型。

## 检查与本地接入

```powershell
pnpm check:api-docs
pnpm --filter '@sia.soul/sia-react-ui' build
pnpm test:api-docs
node scripts/build-game.mjs
```

西游示例项目中 `npm run sync:sia` 会构建独立包、pack 成 tgz 并安装本地依赖。再运行 `npm test`、`npm run check:architecture`、`npm run build`。正式 npm 发布由用户执行，联调不改变框架版本号，也不执行发布。

## 六边形自动战斗

`GameHexBattlefield` 使用 Canvas 2D 绘制 45° 俯视的 37 格棋盘。棋子是浅厚度六边形，角色 PNG/WebP 贴在顶面；不使用 SVG、3D 模型、材质光照或厚涂。`GameLoadoutPanel` 提供攻击、技能、神通、法宝四类单选配置。业务仍只提供内容与数值，不定义组件。

普通波次最多四只小怪：开场两只，第 1、3 回合从其他边缘格补充。每回合最多移动一个邻格；寻路避开活着的单位。玩家按选定攻击的射程接近目标，怪物只有邻接玩家才能攻击。灵宠自动跟随或追击。全部消灭后休整两回合，再生成下一波。

首领登场直接替换棋盘，只保留玩家、灵宠和一个首领。五回合循环为挥砍、挥砍、蓄力、双倍攻击重斩、喘息；蓄力与喘息不造成伤害。`bossSkillName` 配置重击文案，默认「蓄力重击」。

能力配置 `abilities` 必须覆盖四类。`range` 是六边形格数；`cooldown` 是回合周期，技能和法宝同时可用时优先法宝，神通独立生效。默认组合兼容旧存档，未知或跨槽 ID 自动回退。换装配后重新开始普通波次，首领战期间禁止修改。

`GameBattleEvent.playback` 保存不可变的单位起始状态及带时刻的动作序列。`sampleHexPlayback` 只在命中时更新显示气血，移动在相邻格之间插值；治疗只显示实际恢复量，死亡之后才显示地块战利品。掉落经济由规则引擎逐个发放，回放不重复入账。视图卸载清理动画帧；减少动态效果偏好关闭抖动和浮动。离线按同一 turnDurationMs 计算完整回合，仍不挑战首领。
# 六边形地图背景

`IdleMapDefinition.scene` 同时用于地图预览和六边形战场底图。使用 PNG/WebP 位图，推荐宽高比 `900:580`，45° 俯视地面构图，不画天空、角色或格线。中央约 64% 宽度留空，建筑、草木和山石沿边缘分组摆放，保留进场缺口。

框架完整铺满背景，不再施加倾斜投影；棋盘地格以半透明平涂色覆盖，保留底图色调，单位棋子仍独立显示浅厚度。背景加载完成时即使战斗暂停也会重绘；加载失败保留暗色底板。地图切换沿用原有场景配置，不需要业务项目编写组件或样式。
