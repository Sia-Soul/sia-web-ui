import { OverlayMotionDemo } from "./OverlayMotionDemo";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal, Space, message } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const basicCode = `import { useState } from "react";
import { Button, Input, Modal, message } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="primary" onClick={() => setOpen(true)}>打开基础 Modal</Button>
    <Modal
      open={open}
      title="编辑项目"
      onOpenChange={setOpen}
      onOk={async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        message.success("项目设置已保存");
      }}
    >
      <p>填写新的项目名称。</p>
      <Input defaultValue="Sia Web UI" />
    </Modal>
  </>;
}`;

const apiCode = `import { Button, Modal } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <>
    <Button onClick={() => Modal.info({ children: "这是一条提示信息。" })}>提示框</Button>
    <Button onClick={() => Modal.success({ children: "数据保存成功。" })}>成功提示</Button>
    <Button onClick={() => Modal.warning({ children: "操作可能影响其他成员。" })}>警告提示</Button>
    <Button onClick={() => Modal.error({ children: "保存失败。" })}>错误提示</Button>
    <Button onClick={() => Modal.confirm({
      title: "确认删除项目？",
      children: "删除后无法恢复。",
      okText: "确认删除",
      okButtonProps: { danger: true },
      onOk: () => new Promise((resolve) => window.setTimeout(resolve, 700)),
    })}>确认框</Button>
  </>;
}`;

const apiRows = [
  { property: "deferContent", description: "入场完成后挂载正文；关闭时卸载正文并用等高骨架占位。父组件已执行的计算不受影响；默认 false 为立即挂载。", type: "boolean", defaultValue: "false" },
  { property: "loadingFallback", description: "自定义入场和退场占位；未传时入场为默认骨架，退场按已显示的可见控件和文字行生成近似骨架，保持尺寸且无滚动条；null 关闭占位。", type: "ReactNode", defaultValue: "静态骨架" },
  { property: "open", description: "是否显示对话框", type: "boolean", defaultValue: "false" },
  { property: "autoFocus", description: "打开时优先聚焦正文首个可用输入组件，跳过隐藏、禁用及只读字段；false 使用默认焦点。异步加载的字段需自行聚焦。", type: "boolean", defaultValue: "true" },
  { property: "title", description: "标题", type: "ReactNode", defaultValue: "-" },
  { property: "footer", description: "自定义底部操作区，传 null 隐藏", type: "ReactNode | null", defaultValue: "默认按钮" },
  { property: "onOk", description: "确认回调，支持 Promise 与返回 false 阻止关闭", type: "() => void | boolean | Promise", defaultValue: "-" },
  { property: "onOpenChange", description: "打开状态变化回调", type: "(open: boolean) => void", defaultValue: "-" },
  { property: "maskClosable / keyboard", description: "遮罩和 Esc 是否允许关闭", type: "boolean", defaultValue: "true" },
  { property: "width / centered", description: "宽度与垂直居中", type: "number | string / boolean", defaultValue: "520 / false" },
  { property: "Modal.open / confirm / info / success / warning / error", description: "无需 JSX 状态即可打开", type: "(config) => { destroy, update }", defaultValue: "-" },
] as const;

export function ModalPage() {
  // 独立展示关闭输入自动聚焦的用法，基础弹框则沿用默认行为。
  const [manualOpen, setManualOpen] = useState(false);
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [open, setOpen] = useState(false);

  function openApiDialog() {
    Modal.open({
      title: "API 对话框",
      children: <p>通过 <code>Modal.open()</code> 创建，不需要在页面中维护 open 状态。</p>,
      onOk: () => {
        message.success("对话框已确认");
      },
    });
  }

  const confirmation = useRef<ReturnType<typeof Modal.confirm>>();
  useEffect(() => () => confirmation.current?.destroy(), []);
  function openConfirm() {
    // 阻止重复打开，必须等关闭动画完成后释放句柄，使下一次点击可以重新打开。
    if (confirmation.current) return;
    const handle = Modal.confirm({
      afterOpenChange: (visible) => {
        if (!visible && confirmation.current === handle) confirmation.current = undefined;
      },
      title: "确认删除项目？",
      children: <p>删除后无法恢复，请确认已经备份重要数据。</p>,
      okText: "确认删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        message.success("项目已删除");
      },
    });
    confirmation.current = handle;
  }

  return <>
    {/* 正文默认字号统一由框架提供，示例无需再添加局部字号。 */}
    <PageHeader eyebrow="组件 / 反馈 / Modal" title="Modal 对话框" description="在当前流程上方承载任务，支持声明式使用与静态 API 调用；提示与确认类型默认采用实心状态图标。正文默认字号为 13px，子元素可通过自身字号样式覆盖。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <OverlayMotionDemo />
      <DemoCard title="基础对话框" description="打开后默认聚焦正文首个可用输入组件，可直接输入；支持遮罩、Esc、焦点管理和异步确认。" code={basicCode}>
        <Space wrap><Button variant="primary" onClick={() => setOpen(true)}>打开基础 Modal</Button></Space>
      </DemoCard>
      <DemoCard title="关闭输入自动聚焦" description="autoFocus=false 时保留默认首个可聚焦元素；内容自身显式设置的焦点始终优先。" code={'<Modal open={open} autoFocus={false} onOpenChange={setOpen}><Input placeholder="手动点击输入" /></Modal>'}>
        <Button onClick={() => setManualOpen(true)}>打开不自动聚焦输入的弹框</Button>
        <Modal open={manualOpen} autoFocus={false} title="手动选择输入" onOpenChange={setManualOpen}><Input placeholder="手动点击输入" /></Modal>
      </DemoCard>
      <DemoCard title="API 调用" description="适合跨组件反馈、一次性对话和确认操作。确认框关闭完成后释放句柄，可反复取消、重新打开。" code={apiCode}>
        <Space wrap>
          <Button onClick={openApiDialog}>打开对话框</Button>
          <Button onClick={() => Modal.info({ children: "这是一条需要用户关注的信息。" })}>提示框</Button>
          <Button onClick={() => Modal.success({ children: "数据已经保存成功。" })}>成功提示</Button>
          <Button onClick={() => Modal.warning({ children: "当前操作可能影响其他成员。" })}>警告提示</Button>
          <Button danger onClick={() => Modal.error({ children: "保存失败，请稍后重试。" })}>错误提示</Button>
          <Button danger onClick={openConfirm}>确认框</Button>
        </Space>
      </DemoCard>
      <Modal open={open} title="编辑项目" onOpenChange={setOpen} onOk={async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        message.success("项目设置已保存");
      }}>
        <p>填写新的项目名称，确认操作会模拟异步保存。</p>
        <Input aria-label="项目名称" defaultValue="Sia Web UI" />
      </Modal>
    </div> : <ApiTable name="Modal" rows={apiRows} />}
  </>;
}
