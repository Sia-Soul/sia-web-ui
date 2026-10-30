import { useState } from "react";
import { Button, Drawer, Modal, Input, Space, Switch, Select, Tooltip, Skeleton, message } from "@sia.soul/sia-react-ui";
import { DemoCard } from "./DemoCard";

/** 将较多字段封装成子组件，deferContent 才能延后其渲染和挂载。 */
function LargeFormContent() {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
    {Array.from({ length: 80 }, (_, index) => <Input key={index} placeholder={`业务字段 ${index + 1}`} placeholderMode="floating" defaultValue={index === 0 ? "打开后可直接输入" : undefined} />)}
  </div>;
}

/** 比较同步正文和动画完成后挂载正文，同时预览选择面板、气泡及消息的回弹。 */
export function OverlayMotionDemo() {
  const [kind, setKind] = useState<"drawer" | "modal" | null>(null);
  const [deferContent, setDeferContent] = useState(false);
  const fallback = <Skeleton rows={8} columns={2} rowHeight={30} gap={16} />;
  return <DemoCard title="弹性回弹与重内容延后挂载" description="默认立即挂载正文，开启下方开关后才等待入场动画结束，切换开关对照 80 个字段的挂载时机。延后挂载让面板先完成入场，以双列表单骨架占位，占位期间隐藏滚动条，入场结束后淡入正文并恢复滚动；Modal 固定高度避免正文补入时尺寸跳变。本例显式配置双列骨架，关闭时复用；未配置 loadingFallback 时会按已显示内容生成关闭骨架并保持原尺寸，快速反向切换保留过渡，提示气泡与消息以 280ms 回弹，下拉面板为 260ms 缩放淡入与果冻回弹，面板关闭取消回弹并加快：Modal 160ms、Drawer 180ms、下拉面板 140ms，中途反向从当前画面接续；其他提示仍等时长反播；消息文字保持原尺寸，由背景单独形变，系统减少动态效果时直接显示。" code={'<Drawer open={open} deferContent loadingFallback={<Skeleton rows={8} columns={2} />} onOpenChange={setOpen}><LargeFormContent /></Drawer>\n<Modal open={open} height={480} deferContent loadingFallback={<Skeleton rows={8} columns={2} />} onOpenChange={setOpen}><LargeFormContent /></Modal>'}>
    <Space direction="vertical">
      <Switch checked={deferContent} onCheckedChange={setDeferContent} label="入场完成后挂载正文" />
      <Space wrap>
        <Button onClick={() => setKind("drawer")}>体验回弹抽屉</Button>
        <Button onClick={() => setKind("modal")}>体验回弹弹框</Button>
        <Tooltip title="弹性回弹提示"><Button>悬停查看提示</Button></Tooltip>
        <Button onClick={() => message.success("已完成操作")}>体验消息提示</Button>
        <Select placeholder="展开选择面板" options={[{ value: "a", label: "选项一" }, { value: "b", label: "选项二" }, { value: "c", label: "选项三" }]} />
      </Space>
    </Space>
    <Drawer open={kind === "drawer"} title="重内容抽屉" deferContent={deferContent} loadingFallback={fallback} onOpenChange={open => { if (!open) setKind(null); }}><LargeFormContent /></Drawer>
    <Modal open={kind === "modal"} title="重内容弹框" height={480} deferContent={deferContent} loadingFallback={fallback} onOpenChange={open => { if (!open) setKind(null); }}><LargeFormContent /></Modal>
  </DemoCard>;
}
