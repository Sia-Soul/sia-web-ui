import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button, Icon, Select, Space, Switch, Typography } from "@sia.soul/sia-react-ui";
import {
  createIdleEngine, gameAbilities, GameBattleStage, GameBossPanel, GameButton, GameCharacterPanel,
  GameDialog, GameEquipmentComparison, GameEquipmentPanel, GameHexBattlefield, GameLoadoutPanel,
  GameLogPanel, GameMapPanel, GamePetPanel, GameResourceSummary, GameSavePanel, GameShell, GameSprite, IdleGameApp,
} from "@sia.soul/sia-react-ui/game";
import type { GameAction, GameBattleEvent, GamePage, IdleGameDefinition, IdleGameState } from "@sia.soul/sia-react-ui/game";

/** 演示复用仓库已有应用位图作为棋子；正式游戏可替换为自己的 PNG/WebP 素材。 */
const heroArt = { src: "/examples/desktop-mark.png", identity: "桌面应用棋子", traits: "蓝色应用徽记，用于展示贴图尺寸与朝向" };
const otherArt = { src: "/examples/database-mark.png", identity: "数据库棋子", traits: "数据库徽记，用于区分伙伴与对手", flip: true };
/** 稳定的内容配置与独立存档槽；关闭离线收益，方便重复检查界面。 */
const definition: IdleGameDefinition = {
  title: "组件演练场", subtitle: "框架组件交互示例", heroName: "示例角色", hero: heroArt,
  skillName: "示例连击", saveKey: "sia-docs-property-examples-game-v1", offlineCapSeconds: 0, turnDurationMs: 1500,
  rarities: ["普通", "优良", "精良"],
  slots: { weapon: { name: "武器", names: ["练习剑", "精铁剑", "试炼剑"], base: { atk: 8, def: 1, hp: 10 }, starter: true } },
  pets: [
    { id: "companion", name: "练习伙伴", kind: "追击", effect: "attack", desc: "每回合追加攻击", cost: 0, base: 6, art: otherArt },
    { id: "healer", name: "治疗伙伴", kind: "治疗", effect: "heal", desc: "回复主角气血", cost: 20, base: 0, art: heroArt },
  ],
  maps: [0, 1].map(id => ({
    id, name: `练习场 ${id + 1}`, subtitle: "本地图标素材", level: `${id + 1} 级`, enemy: "练习对手", boss: "试炼首领",
    hp: 55 + id * 20, atk: 5, bossHp: 120 + id * 30, bossAtk: 8, xp: 20, gold: 15, rewardSlot: "weapon",
    desc: "击败首领解锁下一场地；地图与奖励全部由配置定义。", scene: "/examples/database-mark.png", enemyArt: otherArt, bossArt: heroArt,
  })),
};
/** 单独查看各面板，或查看 GameShell 对它们的组合；使用选择器避免同时挂载多个战场。 */
const panelOptions = [
  { value: "shell", label: "组合外壳" }, { value: "character", label: "角色信息" },
  { value: "battle", label: "完整战场" }, { value: "hex", label: "独立六边形棋盘" },
  { value: "resources", label: "累计资源" }, { value: "boss", label: "首领挑战" },
  { value: "logs", label: "战斗记录" }, { value: "maps", label: "地图" },
  { value: "pets", label: "伙伴" }, { value: "gear", label: "装备" },
  { value: "loadout", label: "能力装配" }, { value: "save", label: "存档操作" },
];

/** 受控面板由示例宿主更新状态；完整宿主则自行管理时钟和独立本地存档。 */
export function GameExamples() {
  const [completeApp, setCompleteApp] = useState(false);
  const [observed, setObserved] = useState("等待完整宿主操作");
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Switch label="使用完整游戏宿主" checked={completeApp} onCheckedChange={setCompleteApp} />
    <Typography.Text>组合面板演示保存在内存中，存档可手动导入导出；完整宿主使用文档专用本地存档。切换模式会卸载当前演示并停止其时钟。</Typography.Text>
    {completeApp ? <>
      <IdleGameApp definition={definition} className="property-idle-game" style={{ "--game-accent": "#8bdcff" } as CSSProperties}
        onStateChange={state => setObserved(`完整宿主：等级 ${state.level}，铜钱 ${state.gold}，${state.idle ? "挂机中" : "已暂停"}`)} />
      <Typography.Text role="status">{observed}</Typography.Text>
    </> : <ControlledGameExamples />}
  </Space>;
}

/** 面板命令只经宿主交给公开引擎，示例不复制战斗、装备和存档校验规则。 */
function ControlledGameExamples() {
  const [engine] = useState(() => createIdleEngine(definition));
  const [state, setState] = useState(() => {
    const initial = engine.freshState();
    // 给足初始材料及一件可比较装备，用户无需先挂机才能体验面板操作。
    initial.material = 24;
    initial.essence = 80;
    initial.inventory.push(engine.makeGear("weapon", 1, 0, "demo-gear"));
    engine.addLog(initial, "可推进一个回合，或点击开始挂机。面板状态只保存在内存。");
    return initial;
  });
  const [panel, setPanel] = useState("shell");
  const [page, setPage] = useState<GamePage>("battle");
  const [event, setEvent] = useState<GameBattleEvent | null>(null);
  const [sequence, setSequence] = useState(0);
  const [dialog, setDialog] = useState("");
  const [itemId, setItemId] = useState("demo-gear");
  const [pending, setPending] = useState<IdleGameState | null>(null);
  const [message, setMessage] = useState("等待操作");
  const [loading, setLoading] = useState(false);
  const [danger, setDanger] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const locked = Boolean(state.fight?.boss && state.fight.status === "active");

  /** 规则原位修改副本后统一提交，确保 React 可观察到状态与回合事件变化。 */
  function advance() {
    const next = structuredClone(state);
    const wasIdle = next.idle;
    next.idle = true;
    const result = engine.tick(next);
    next.idle = wasIdle;
    setState(next);
    setEvent(result);
    setSequence(value => value + 1);
    setMessage(`已推进回合，累计击败 ${next.kills} 个敌人`);
  }
  // 时钟只读取最新提交后的操作；切换分组或演示模式时清理定时器。
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    if (!state.idle && !locked) return;
    const timer = window.setInterval(() => advanceRef.current(), definition.turnDurationMs);
    return () => window.clearInterval(timer);
  }, [state.idle, locked]);

  /** 响应面板命令；导航与弹框仅改变显示，数值操作由引擎校验。 */
  function onAction({ type, id = "" }: GameAction) {
    if (type === "page" && (id === "battle" || id === "maps" || id === "gear" || id === "pets")) {
      setPage(id);
      if (panel !== "shell") setPanel(id);
      return;
    }
    if (type === "settings" || type === "loadout" || type === "help" || type === "inspect") {
      if (type === "inspect") setItemId(id);
      setDialog(type);
      return;
    }
    if (locked) { setMessage("首领挑战中，等待结束后再调整配置。"); return; }
    const next = structuredClone(state);
    let success = true;
    switch (type) {
      case "idle": next.idle = !next.idle; if (!next.idle) next.fight = null; break;
      case "boss": engine.beginFight(next, true); setPage("battle"); if (panel !== "shell") setPanel("battle"); break;
      case "equip": success = engine.equip(next, id); if (success) { next.fight = null; setDialog(""); } break;
      case "upgrade": success = engine.upgrade(next, id); if (success) next.fight = null; break;
      case "dismantle": success = engine.dismantle(next, id); break;
      case "forge": success = engine.forge(next); break;
      case "train": success = engine.trainPet(next, id); if (success) next.fight = null; break;
      case "unlock": success = engine.unlockPet(next, id); break;
      case "deploy": if (next.pets[id]) { next.pet = id; next.fight = null; } else success = false; break;
      case "lock": {
        const item = next.inventory.find(item => item.id === id);
        if (item) item.locked = !item.locked; else success = false;
        break;
      }
      case "map": {
        const index = Number(id);
        success = Number.isInteger(index) && index >= 0 && index <= next.unlocked;
        if (success) { next.map = index; next.fight = null; setPage("battle"); if (panel !== "shell") setPanel("battle"); }
        break;
      }
      case "configure": {
        const ability = gameAbilities(definition).find(ability => ability.id === id);
        if (ability) { next.loadout[ability.kind] = id; next.fight = null; } else success = false;
        break;
      }
      default: return;
    }
    engine.addLog(next, success ? `已执行 ${type}${id ? `：${id}` : ""}` : "当前条件不足，未执行操作。");
    setState(next);
    setEvent(null);
    setMessage(success ? `操作完成：${type}` : "当前条件不足，未执行操作。");
  }

  /** 导出当前内存状态为 JSON；对象 URL 在浏览器接收下载后释放。 */
  function exportSave() {
    const url = URL.createObjectURL(new Blob([engine.serialize(state)], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "sia-docs-game.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("已导出当前演示存档");
  }
  /** 验证文件后仅暂存，用户确认才替换当前示例；失败保留原有状态。 */
  async function importSave(file: File) {
    try {
      if (file.size > 1000000) throw new Error("文件不能超过 1MB");
      const imported = engine.hydrate(JSON.parse(await file.text()));
      setPending(imported);
      setDialog("import");
    } catch (error) { setMessage(`导入失败：${error instanceof Error ? error.message : String(error)}`); }
  }
  /** 组合外壳的中央页面使用同一份受控状态，导航切换不创建新引擎。 */
  function renderPage() {
    if (page === "maps") return <GameMapPanel engine={engine} state={state} onAction={onAction} />;
    if (page === "gear") return <GameEquipmentPanel engine={engine} state={state} onAction={onAction} />;
    if (page === "pets") return <GamePetPanel engine={engine} state={state} onAction={onAction} />;
    return <GameBattleStage engine={engine} state={state} onAction={onAction} event={event} sequence={sequence} />;
  }

  return <Space direction="vertical" style={{ width: "100%" }}>
    <Select aria-label="游戏面板" value={panel} options={panelOptions} onChange={value => setPanel(String(value))} />
    <Space wrap>
      <Button disabled={state.idle || locked} onClick={advance}>推进一个回合</Button>
      <Switch label="演示按钮加载中" checked={loading} onCheckedChange={setLoading} />
      <Switch label="演示危险按钮" checked={danger} onCheckedChange={setDanger} />
    </Space>
    <div ref={host} className="sia-game" data-sia-theme="dark">
      <div style={{ width: 64, height: 64 }}><GameSprite asset={heroArt} className="property-game-sprite" /></div>
      <GameButton variant="primary" size="small" loading={loading} block danger={danger} icon={<Icon name="refresh" />} iconPosition="end"
        onClick={() => setMessage("游戏按钮点击成功")}>游戏按钮交互</GameButton>
      {panel === "shell" && <GameShell page={page} engine={engine} state={state} onAction={onAction}>{renderPage()}</GameShell>}
      {panel === "character" && <GameCharacterPanel engine={engine} state={state} onAction={onAction} />}
      {panel === "battle" && <GameBattleStage engine={engine} state={state} onAction={onAction} event={event} sequence={sequence} />}
      {panel === "hex" && <GameHexBattlefield engine={engine} state={state} onAction={onAction} event={event} sequence={sequence} />}
      {panel === "resources" && <GameResourceSummary state={state} />}
      {panel === "boss" && <GameBossPanel engine={engine} state={state} onAction={onAction} />}
      {panel === "logs" && <GameLogPanel engine={engine} state={state} onAction={onAction} />}
      {panel === "maps" && <GameMapPanel engine={engine} state={state} onAction={onAction} />}
      {panel === "pets" && <GamePetPanel engine={engine} state={state} onAction={onAction} />}
      {panel === "gear" && <GameEquipmentPanel engine={engine} state={state} onAction={onAction} />}
      {panel === "loadout" && <GameLoadoutPanel engine={engine} state={state} onAction={onAction} />}
      {panel === "save" && <GameSavePanel onExport={exportSave} onImport={importSave} />}
      <GameDialog open={Boolean(dialog)} title={dialog === "import" ? "确认导入演示存档" : "游戏面板操作"}
        onClose={() => { setDialog(""); setPending(null); }} container={() => host.current ?? document.body}>
        {dialog === "settings" && <GameSavePanel onExport={exportSave} onImport={importSave} />}
        {dialog === "loadout" && <GameLoadoutPanel engine={engine} state={state} onAction={onAction} />}
        {dialog === "inspect" && <GameEquipmentComparison itemId={itemId} engine={engine} state={state} onAction={onAction} />}
        {dialog === "help" && <Typography.Text>开始挂机后按配置间隔推进回合，暂停后可更换装备和能力。</Typography.Text>}
        {dialog === "import" && pending && <Space direction="vertical">
          <Typography.Text>即将载入等级 {pending.level} 的角色；确认后替换当前内存演示。</Typography.Text>
          <Button disabled={locked} onClick={() => { setState(pending); setPending(null); setDialog(""); setEvent(null); setMessage("已导入演示存档"); }}>确认替换演示状态</Button>
        </Space>}
      </GameDialog>
    </div>
    <Typography.Text role="status">{message}</Typography.Text>
  </Space>;
}
