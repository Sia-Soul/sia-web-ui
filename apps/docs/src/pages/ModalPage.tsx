import { useState } from "react";
import { Button, Input, Modal, Space, message } from "@sia-ui/react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const basicCode = `import { useState } from "react";
import { Button, Input, Modal, message } from "@sia-ui/react";

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

const apiCode = `import { Button, Modal } from "@sia-ui/react";

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
  { property: "open", description: "是否显示对话框", type: "boolean", defaultValue: "false" },
  { property: "title", description: "标题", type: "ReactNode", defaultValue: "-" },
  { property: "footer", description: "自定义底部操作区，传 null 隐藏", type: "ReactNode | null", defaultValue: "默认按钮" },
  { property: "onOk", description: "确认回调，支持 Promise 与返回 false 阻止关闭", type: "() => void | boolean | Promise", defaultValue: "-" },
  { property: "onOpenChange", description: "打开状态变化回调", type: "(open: boolean) => void", defaultValue: "-" },
  { property: "maskClosable / keyboard", description: "遮罩和 Esc 是否允许关闭", type: "boolean", defaultValue: "true" },
  { property: "width / centered", description: "宽度与垂直居中", type: "number | string / boolean", defaultValue: "520 / false" },
  { property: "Modal.open / confirm / info / success / warning / error", description: "无需 JSX 状态即可打开", type: "(config) => { destroy, update }", defaultValue: "-" },
] as const;

export function ModalPage() {
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

  function openConfirm() {
    Modal.confirm({
      title: "确认删除项目？",
      children: <p>删除后无法恢复，请确认已经备份重要数据。</p>,
      okText: "确认删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        message.success("项目已删除");
      },
    });
  }

  return <>
    <PageHeader eyebrow="组件 / 反馈 / Modal" title="Modal 对话框" description="在当前流程上方承载任务，支持声明式使用与静态 API 调用。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="基础对话框" description="通过 open 属性控制，支持遮罩、Esc、焦点管理和异步确认。" code={basicCode}>
        <Space wrap><Button variant="primary" onClick={() => setOpen(true)}>打开基础 Modal</Button></Space>
      </DemoCard>
      <DemoCard title="API 调用" description="适合跨组件反馈、一次性对话和确认操作。" code={apiCode}>
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
