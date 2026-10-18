import { useState } from "react";
import { Button, Drawer, Modal, Space, Switch, Typography } from "@sia.soul/sia-react-ui";

/** 弹框和抽屉均由按钮打开，避免进入样例页就遮挡文档。 */
export function OverlayExamples() {
  const [modal, setModal] = useState(false);
  const [custom, setCustom] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState("等待操作");
  return <Space direction="vertical">
    <Space><Button onClick={() => setModal(true)}>打开配置弹框</Button><Button onClick={() => setCustom(true)}>自定义底栏</Button><Button onClick={() => setDrawer(true)}>打开抽屉</Button></Space>
    <Modal open={modal} onOpenChange={setModal} title="保存资料" footerExtra="提交需要约 600ms" type="info" okText="保存" cancelText="返回" showCancel confirmLoading={busy} okButtonProps={{ danger: false }} cancelButtonProps={{ variant: "text" }} closable maskClosable={false} keyboard centered width={560} height={320} zIndex={1100} getContainer={() => document.body} onCancel={() => setEvent("取消保存")} afterOpenChange={open => setEvent(`弹框动画结束：${open}`)} onOk={async () => { setBusy(true); await new Promise(resolve => setTimeout(resolve, 600)); setBusy(false); setEvent("保存成功"); }}>点击保存观察异步状态；点击遮罩不会关闭。</Modal>
    <Modal open={custom} onOpenChange={setCustom} title="自定义底栏" footer={<Button onClick={() => setCustom(false)}>完成</Button>}>footer 替换默认确认与取消按钮。</Modal>
    <Drawer open={drawer} onOpenChange={setDrawer} title="抽屉配置" closable maskClosable={false} keyboard zIndex={1050} pushDepth={1} getContainer={() => document.body} onClose={() => setEvent("抽屉关闭")}><Switch checked={busy} onCheckedChange={setBusy} label="抽屉内状态" /></Drawer>
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
