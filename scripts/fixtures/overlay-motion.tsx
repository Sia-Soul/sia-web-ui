import React, { useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Drawer } from "../../packages/react/src/components/Drawer";
import { Modal } from "../../packages/react/src/components/Modal";
import { Input } from "../../packages/react/src/components/Input";
import { Select } from "../../packages/react/src/components/Select";
import { DatePicker } from "../../packages/react/src/components/DatePicker";
import { Tooltip } from "../../packages/react/src/components/FloatingDisplay";
import { Dropdown } from "../../packages/react/src/components/Dropdown";
import { notification } from "../../packages/react/src/components/Feedback";
import { message } from "../../packages/react/src/components/Message";
import { FloatingScrollbarProvider } from "../../packages/react/src/components/FloatingScrollbarProvider";
import "../../packages/react/src/styles.css";
import "../../packages/react/src/components-extra.css";

// 可控的重内容用于比较外壳首次可见与正文挂载时间，不用机器相关帧率作为通过条件。
function HeavyContent() {
  const [extraFields, setExtraFields] = useState(false);
  (window as any).setExtraFields = setExtraFields;
  const begin = performance.now();
  while (performance.now() - begin < 80) { /* 模拟一次不可拆分的业务计算。 */ }
  useLayoutEffect(() => { (window as any).bodyMountedAt = performance.now(); }, []);
  return <div style={{ minHeight: 1200 }}><Input aria-label="延后输入" defaultValue="保留内容" allowClear showCount maxLength={30} />{extraFields && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}><Input aria-label="新增字段 A" /><Input aria-label="新增字段 B" /><div hidden><Input aria-label="隐藏字段" /></div></div>}</div>;
}
function Fixture() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("drawer");
  const [placement, setPlacement] = useState<"left" | "right" | "top" | "bottom">("right");
  (window as any).setMotionOpen = setOpen;
  (window as any).setMotionKind = setKind;
  (window as any).setMotionPlacement = setPlacement;
  (window as any).motionMessage = message;
  (window as any).motionNotification = notification;
  (window as any).motionModal = Modal;
  (window as any).motionDrawer = Drawer;
  const completed = (value: boolean) => { (window as any).motionEvents.push(value); };
  return <div style={{ padding: 40, minHeight: "100vh", background: "var(--sia-color-background)" }}>
    {/* 与文档站相同的全局接管场景，检查骨架阶段不生成浮动滚动条。 */}
    <FloatingScrollbarProvider />
    <button onClick={() => { (window as any).motionEvents = []; (window as any).bodyMountedAt = 0; setOpen(true); }}>打开</button>
    {kind === "drawer" ? <Drawer deferContent open={open} placement={placement} title="动效抽屉" onOpenChange={setOpen} afterOpen={() => completed(true)} afterClose={() => completed(false)}><HeavyContent /></Drawer>
      : <Modal deferContent open={open} height={300} title="动效弹框" onOpenChange={setOpen} afterOpenChange={completed}>{open ? <HeavyContent /> : undefined}</Modal>}
    <Select options={[{ value: "a", label: "选项 A" }, { value: "b", label: "选项 B" }]} placeholder="打开选择" />
    {/* 覆盖 Select 内部在关闭时同步清空正文的组合场景。 */}
    <Select aria-label="自动弹框回归" options={Array.from({ length: 16 }, (_, index) => ({ value: index, label: `候选 ${index + 1}` }))} />
    <Tooltip title="提示动效" trigger="click"><button>提示</button></Tooltip>
    <Dropdown trigger={["contextMenu"]} menu={{ items: [{ key: "context", label: "右键选项" }] }}><button>右键菜单</button></Dropdown>
    <Dropdown trigger={["click"]} menu={{ items: [{ key: "one", label: "菜单项" }, { key: "more", label: "更多项目", children: [{ key: "child", label: "子菜单项目" }] }] }}><button>菜单</button></Dropdown>
    {/* 日期面板沿用相同液体轨迹，检查日历内容显露及实际尺寸。 */}
    <DatePicker placeholder="液体日期" />
  </div>;
}
(window as any).motionEvents = [];
createRoot(document.getElementById("root")!).render(<Fixture />);
