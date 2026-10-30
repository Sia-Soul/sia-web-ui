import { useCallback, useRef, useState } from "react";
import { Button, FloatButton, Icon, Space, message } from "@sia.soul/sia-react-ui";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";
import { ApiTable } from "./ApiTable";

const inline = { position: "relative" as const, right: "auto", bottom: "auto" };
const basicCode = `import { FloatButton, Icon, message } from "@sia.soul/sia-react-ui";

<FloatButton tooltip="帮助" onClick={() => message.info("帮助中心")} />
<FloatButton type="primary" shape="square" description="反馈" style={{ right: 80 }} />`;
const groupCode = `import { FloatButton, Icon, message } from "@sia.soul/sia-react-ui";

<FloatButton.Group trigger="click" type="primary" placement="top">
  <FloatButton tooltip="帮助" onClick={() => message.info("帮助入口")} />
  <FloatButton icon={<Icon name="edit" />} tooltip="反馈" onClick={() => message.info("反馈入口")} />
</FloatButton.Group>`;
const apiRows = [
  { property: "icon / description / tooltip", description: "图标、文字及悬停提示", type: "ReactNode", defaultValue: "-" },
  { property: "type / shape", description: "默认或主色；圆形或方形", type: "'default' | 'primary' / 'circle' | 'square'", defaultValue: "default / circle" },
  { property: "badge", description: "数字、红点和溢出计数配置", type: "{ count?, dot?, overflowCount?, showZero?, color? }", defaultValue: "-" },
  { property: "onClick / disabled", description: "操作事件及禁用状态", type: "MouseEventHandler / boolean", defaultValue: "- / false" },
  { property: "style", description: "悬浮容器位置，默认固定在右下角", type: "CSSProperties", defaultValue: "right: 24; bottom: 24" },
  { property: "Group.trigger / placement", description: "点击或悬停展开；支持四个弹出方向", type: "'click' | 'hover' / 'top' | 'bottom' | 'left' | 'right'", defaultValue: "不折叠 / top" },
  { property: "Group.open / defaultOpen / onOpenChange", description: "受控或非受控展开状态", type: "boolean / boolean / (open) => void", defaultValue: "- / false / -" },
  { property: "Group.shape / icon / closeIcon", description: "统一子项形状、自定义触发及关闭图标", type: "FloatButtonShape / ReactNode / ReactNode", defaultValue: "circle / + / ×" },
  { property: "BackTop.target / visibilityHeight", description: "滚动容器和出现阈值（像素）", type: "() => HTMLElement | Window | null / number", defaultValue: "window / 400" },
  { property: "BackTop.behavior", description: "滚动方式；减弱动态效果时取消平滑滚动", type: "ScrollBehavior", defaultValue: "smooth" },
] as const;

export function FloatButtonPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const target = useCallback(() => scrollRef.current, []);
  const actions = <>
    <FloatButton tooltip="帮助中心" onClick={() => message.info("帮助中心入口")} />
    <FloatButton tooltip="提交反馈" icon={<Icon name="edit" size={20} />} onClick={() => message.info("反馈入口")} />
  </>;
  return <>
    <PageHeader eyebrow="组件 / 通用 / FloatButton" title="FloatButton 悬浮按钮" description="悬浮于页面上方的快捷操作入口，支持按钮组、菜单和返回顶部。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "api" ? <ApiTable name="FloatButton" rows={apiRows} /> : <div className="demo-stack">
      <DemoCard title="基本、类型与形状" description="圆形适合图标入口，方形可以附带文字。页面右下角还有一个固定定位的菜单。" code={basicCode}>
        <Space size={24} align="center" wrap>
          <FloatButton style={inline} tooltip="帮助" onClick={() => message.info("帮助中心")} />
          <FloatButton style={inline} type="primary" tooltip="新增任务" icon={<Icon name="plus" size={20} />} onClick={() => message.success("已新增任务")} />
          <FloatButton style={inline} shape="square" description="反馈" icon={<Icon name="edit" size={18} />} onClick={() => message.info("反馈入口")} />
          <FloatButton style={inline} badge={{ count: 12 }} tooltip="12 条通知" icon={<Icon name="bell" size={20} />} onClick={() => message.info("查看通知")} />
          <FloatButton style={inline} disabled tooltip="暂不可用" />
        </Space>
      </DemoCard>
      <DemoCard title="悬浮按钮组" description="同类操作组合展示；方形按钮组使用相连的边框与阴影。" code={'<FloatButton.Group shape="square">\n  <FloatButton tooltip="帮助" />\n  <FloatButton icon={<Icon name="edit" />} tooltip="反馈" />\n</FloatButton.Group>'}>
        <Space size={32} align="start"><FloatButton.Group style={inline}>{actions}</FloatButton.Group><FloatButton.Group shape="square" style={inline}>{actions}</FloatButton.Group></Space>
      </DemoCard>
      <DemoCard title="菜单模式与受控展开" description="点击或悬停展开，点击外部或按 Esc 收起；展开为 260ms 弹性回弹，关闭为 140ms 缩小淡出后卸载。右侧按钮演示受控模式。" code={groupCode}>
        <div style={{ minHeight: 180, display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: 40, padding: 12 }}>
          <FloatButton.Group style={inline} trigger="click" type="primary" tooltip="点击展开">{actions}</FloatButton.Group>
          <FloatButton.Group style={inline} trigger="hover" tooltip="悬停展开">{actions}</FloatButton.Group>
          <FloatButton.Group style={inline} trigger="click" open={open} onOpenChange={setOpen}>{actions}</FloatButton.Group>
          <Button onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(!open)}>{open ? "收起菜单" : "展开菜单"}</Button>
        </div>
      </DemoCard>
      <DemoCard title="返回顶部" description="滚动下面的容器超过 100px，右下方显示返回顶部按钮。" code={'const scrollRef = useRef<HTMLDivElement>(null);\nconst target = useCallback(() => scrollRef.current, []);\n\n<div ref={scrollRef} style={{ height: 240, overflow: "auto" }}>{/* 长内容 */}</div>\n<FloatButton.BackTop target={target} visibilityHeight={100} />'}>
        <div style={{ position: "relative" }}>
          <div ref={scrollRef} aria-label="返回顶部演示滚动区" tabIndex={0} style={{ height: 240, overflow: "auto", background: "var(--sia-color-background)", borderRadius: 8, padding: 20 }}>
            {Array.from({ length: 20 }, (_, i) => <p key={i}>第 {i + 1} 段内容 · 向下滚动体验返回顶部</p>)}
          </div>
          <FloatButton.BackTop target={target} visibilityHeight={100} style={{ position: "absolute", right: 20, bottom: 20 }} />
        </div>
      </DemoCard>
      <FloatButton.Group trigger="click" type="primary" aria-label="页面快捷操作">{actions}</FloatButton.Group>
    </div>}
  </>;
}
