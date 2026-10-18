import { useRef, useState } from "react";
import { Alert, Button, Icon, Popconfirm, Popover, Progress, Space, Spin, Switch, Tooltip, Tour, Typography, Watermark } from "@sia.soul/sia-react-ui";

/** 浮层的受控状态与反馈事件均显示在页面，方便验证触发顺序。 */
export function FeedbackExamples() {
  const [event, setEvent] = useState("等待操作");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tour, setTour] = useState(false);
  const [step, setStep] = useState(0);
  const target = useRef<HTMLButtonElement>(null);
  return <Space direction="vertical">
    <Alert message="关闭后查看事件回显" closable closeIcon={<Icon name="check" />} onClose={() => setEvent("开始关闭")} afterClose={() => setEvent("关闭动画完成")} />
    <Switch checked={open} onCheckedChange={setOpen} label="受控提示开关" />
    <Tooltip title="受控提示" role="tooltip" open={open} onOpenChange={setOpen} mouseEnterDelay={0.4} mouseLeaveDelay={0.2} arrow={{ pointAtCenter: true }} autoAdjustOverflow color="#0e7490" className="property-tooltip-trigger" overlayClassName="property-tooltip"><Button>悬停或切换上方开关</Button></Tooltip>
    <Tooltip title="非受控提示" defaultOpen={false}><Button>默认关闭的提示</Button></Tooltip>
    <Popover title="操作说明" content="点击外部关闭，并观察状态变化" className="property-popover-trigger" role="dialog" color="#0e7490" onOpenChange={next => setEvent(`气泡状态：${next}`)} defaultOpen={false} arrow mouseEnterDelay={0.3} mouseLeaveDelay={0.2} autoAdjustOverflow overlayClassName="property-popover"><Button>非受控气泡</Button></Popover>
    <Popover title="受控气泡" content="由开关控制" open={open} onOpenChange={setOpen}><Button>受控气泡</Button></Popover>
    <Popconfirm title="确认归档？" cancelText="保留" cancelButtonProps={{ variant: "text" }} autoAdjustOverflow trigger="click" defaultOpen={false} disabled={busy} showCancel icon={<Icon name="info" />} onConfirm={() => setEvent("已确认")} onCancel={() => setEvent("已取消")}><Button>带取消回调的确认框</Button></Popconfirm>
    <Progress percent={65} showInfo format={(percent, success) => `${percent}%（完成 ${success}%）`} strokeColor={{ from: "#0e7490", to: "#16a34a" }} trailColor="#e2e8f0" strokeWidth={8} width={150} success={{ percent: 25, strokeColor: "#16a34a" }} size="small" />
    <Button onClick={() => { setBusy(true); window.setTimeout(() => setBusy(false), 1200); }}>显示全屏加载 1.2 秒</Button>
    <Spin spinning={busy} indicator={<Icon name="refresh" spin />} delay={200} fullscreen tip="200ms 后显示，操作结束自动关闭" />
    <Button ref={target} onClick={() => { setStep(0); setTour(true); }}>开始引导</Button>
    <Tour open={tour} current={step} steps={[{ target: () => target.current, title: "第一步", description: "点击下一步" }, { title: "完成", description: "可关闭引导" }]} mask closable disabledInteraction onChange={setStep} onClose={() => setTour(false)} onFinish={() => setTour(false)} />
    <Tour open={false} defaultCurrent={1} steps={[{ title: "初始第一步" }, { title: "初始第二步" }]} />
    <Watermark image={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="8" y="25" fill="#94a3b8">SiaWebUI</text></svg>')} width={120} height={40} rotate={-15} zIndex={2} gap={[80, 60]} offset={[20, 20]}><div style={{ width: 340, height: 180 }}>本地 SVG 图片水印</div></Watermark>
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
