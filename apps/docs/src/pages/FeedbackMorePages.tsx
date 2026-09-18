import { useRef, useState } from "react";
import {
  Alert, Button, Card, Divider, Icon, Popconfirm, Progress, Space, Spin, Tour, Watermark, message, notification,
} from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

export function AlertPage() {
  return <ComponentDocPage eyebrow="组件 / 反馈 / Alert" title="Alert 警告提示" description="在页面中就地展示需要关注的信息、状态和后续操作。" name="Alert" apiRows={[
    { property: "message / description", description: "标题与详细说明", type: "ReactNode", defaultValue: "-" },
    { property: "type / status", description: "提示类型", type: "info | success | warning | error", defaultValue: "info" },
    { property: "showIcon / banner", description: "显示图标与顶部横幅", type: "boolean", defaultValue: "false" },
    { property: "closable / action", description: "关闭能力与额外操作", type: "boolean / ReactNode", defaultValue: "false / -" },
  ]}>
    <DemoCard title="四种状态" description="图标采用 Sia 图标库的线框状态图标。" code={`<Space direction="vertical" style={{ width: "100%" }}>
  <Alert type="info" showIcon message="信息提示" description="当前配置将在保存后生效。" />
  <Alert type="success" showIcon message="发布成功" description="新版本已经部署。" closable />
  <Alert type="warning" showIcon message="需要检查" action={<Button size="small">立即检查</Button>} />
  <Alert type="error" showIcon message="保存失败" description="请检查网络后重试。" />
</Space>`}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Alert type="info" showIcon message="信息提示" description="当前配置将在保存后生效。" />
        <Alert type="success" showIcon message="发布成功" description="新版本已经部署。" closable />
        <Alert type="warning" showIcon message="需要检查" action={<Button size="small">立即检查</Button>} />
        <Alert type="error" showIcon message="保存失败" description="请检查网络后重试。" />
      </Space>
    </DemoCard>
    <DemoCard title="仅描述内容" description="不传 message 或 title 时，描述直接与图标顶部对齐。" code={'<Alert type="error" showIcon description="当前状态不是合作中，不可审核。" />'}>
      <Alert type="error" showIcon description="当前状态不是合作中，不可审核。" />
    </DemoCard>
    <DemoCard title="横幅提示" description="banner 默认使用警告状态和图标。" code={`<Alert banner message="系统将在今晚 23:00 进行维护" closable />`}><Alert banner message="系统将在今晚 23:00 进行维护" closable /></DemoCard>
  </ComponentDocPage>;
}

export function PopconfirmPage() {
  const [count, setCount] = useState(3);
  return <ComponentDocPage eyebrow="组件 / 反馈 / Popconfirm" title="Popconfirm 气泡确认框" description="在当前操作附近请求二次确认，支持异步确认和受控显示。" name="Popconfirm" apiRows={[
    { property: "title / description", description: "确认标题和说明", type: "ReactNode", defaultValue: "-" },
    { property: "onConfirm / onCancel", description: "确认与取消回调，可返回 Promise", type: "function", defaultValue: "-" },
    { property: "okText / cancelText", description: "按钮文本", type: "ReactNode", defaultValue: "确定 / 取消" },
    { property: "open / placement / trigger", description: "显示状态、位置与触发方式", type: "boolean / placement / trigger", defaultValue: "-" },
  ]}>
    <DemoCard title="删除确认" description={`当前还有 ${count} 条记录`} code={`<Popconfirm title="确定删除吗？" onConfirm={() => remove()}><Button danger>删除</Button></Popconfirm>`}>
      <Popconfirm title="确定删除这条记录吗？" description="删除后不可恢复。" onConfirm={() => { setCount((value) => Math.max(0, value - 1)); message.success("已删除"); }}>
        <Button danger icon={<Icon name="trash" />}>删除记录</Button>
      </Popconfirm>
    </DemoCard>
    <DemoCard title="异步确认" description="Promise 完成前确认按钮保持加载。" code={`<Popconfirm title="提交审核？" onConfirm={() => submitAsync()}><Button>提交</Button></Popconfirm>`}>
      <Popconfirm title="提交审核？" description="确认后将模拟 800ms 异步请求。" onConfirm={() => new Promise<void>((resolve) => window.setTimeout(resolve, 800))}><Button>异步提交</Button></Popconfirm>
    </DemoCard>
  </ComponentDocPage>;
}

export function ProgressPage() {
  const [percent, setPercent] = useState(48);
  return <ComponentDocPage eyebrow="组件 / 反馈 / Progress" title="Progress 进度条" description="展示任务完成比例，支持直线、环形、仪表盘、分段和状态样式。" name="Progress" apiRows={[
    { property: "percent / status", description: "进度与状态", type: "number / normal | active | success | exception", defaultValue: "0 / 自动" },
    { property: "type", description: "直线、环形或仪表盘", type: "line | circle | dashboard", defaultValue: "line" },
    { property: "steps / success", description: "分段数量和成功子进度", type: "number / object", defaultValue: "-" },
    { property: "format / showInfo", description: "自定义信息与显示开关", type: "function / boolean", defaultValue: "- / true" },
  ]}>
    <DemoCard title="可调进度" description={`当前进度：${percent}%`} code={`<Space direction="vertical" style={{ width: "100%" }}>
  <Progress percent={percent} status="active" />
  <Progress percent={percent} steps={10} />
  <Space>
    <Button onClick={() => setPercent((value) => Math.max(0, value - 10))}>-10</Button>
    <Button variant="primary" onClick={() => setPercent((value) => Math.min(100, value + 10))}>+10</Button>
  </Space>
</Space>`}>
      <Space direction="vertical" style={{ width: "100%" }}><Progress percent={percent} status="active" /><Progress percent={percent} steps={10} /><Space><Button onClick={() => setPercent((value) => Math.max(0, value - 10))}>-10</Button><Button variant="primary" onClick={() => setPercent((value) => Math.min(100, value + 10))}>+10</Button></Space></Space>
    </DemoCard>
    <DemoCard title="环形与仪表盘" description="自动在 100% 时显示成功状态。" code={`<Space size="large">
  <Progress type="circle" percent={75} />
  <Progress type="dashboard" percent={62} />
</Space>`}>
      <Space size="large"><Progress type="circle" percent={75} /><Progress type="dashboard" percent={62} /></Space>
    </DemoCard>
  </ComponentDocPage>;
}

export function SpinPage() {
  const [spinning, setSpinning] = useState(true);
  return <ComponentDocPage eyebrow="组件 / 反馈 / Spin" title="Spin 加载中" description="表示页面、卡片或异步区域正在加载，支持延迟和全屏遮罩。" name="Spin" apiRows={[
    { property: "spinning / delay", description: "加载状态与延迟显示毫秒数", type: "boolean / number", defaultValue: "true / 0" },
    { property: "size / indicator", description: "尺寸与自定义指示器", type: "small | default | large / ReactNode", defaultValue: "default" },
    { property: "tip", description: "加载说明文本", type: "ReactNode", defaultValue: "-" },
    { property: "fullscreen", description: "全屏加载遮罩", type: "boolean", defaultValue: "false" },
  ]}>
    <DemoCard title="容器加载" description="内容仍保持布局，加载时覆盖半透明遮罩。" code={`<Space direction="vertical" style={{ width: "100%" }}>
  <Spin spinning={spinning} tip="正在读取数据...">
    <Card title="项目数据">
      <p>这里是加载完成后展示的业务内容。</p>
      <p>遮罩不会引发布局跳动。</p>
    </Card>
  </Spin>
  <Button onClick={() => setSpinning((value) => !value)}>
    {spinning ? "停止加载" : "开始加载"}
  </Button>
</Space>`}>
      <Space direction="vertical" style={{ width: "100%" }}><Spin spinning={spinning} tip="正在读取数据..."><Card title="项目数据"><p>这里是加载完成后展示的业务内容。</p><p>遮罩不会引发布局跳动。</p></Card></Spin><Button onClick={() => setSpinning((value) => !value)}>{spinning ? "停止加载" : "开始加载"}</Button></Space>
    </DemoCard>
    <DemoCard title="不同尺寸" description="不包裹内容时作为独立加载指示器。" code={`<Spin size="small" /><Spin /><Spin size="large" />`}><Space size="large"><Spin size="small" /><Spin /><Spin size="large" /></Space></DemoCard>
  </ComponentDocPage>;
}

export function WatermarkPage() {
  return <ComponentDocPage eyebrow="组件 / 反馈 / Watermark" title="Watermark 水印" description="为页面或局部内容叠加不可交互的文字或图片水印。" name="Watermark" apiRows={[
    { property: "content / image", description: "单行、多行文字或图片", type: "string | string[] / string", defaultValue: "Sia Web UI" },
    { property: "rotate / gap / offset", description: "角度、平铺间距和偏移", type: "number / [number,number]", defaultValue: "-22 / [100,100]" },
    { property: "font", description: "颜色、字号、字重与字体", type: "WatermarkFont", defaultValue: "-" },
    { property: "zIndex", description: "水印覆盖层层级", type: "number", defaultValue: "9" },
  ]}>
    <DemoCard title="多行文字水印" description="SVG 数据图在组件内部生成，不依赖图片资源。" code={`<Watermark
  content={["Sia Web UI", "内部资料"]}
  font={{ color: "rgba(22,119,255,.17)", fontSize: 15 }}
>
  <div style={{ minHeight: 260, padding: 24 }}>
    <h3>项目交付报告</h3>
    <p>水印层不会阻挡内容选择、按钮点击或滚动。</p>
    <Button variant="primary">正常操作</Button>
  </div>
</Watermark>`}>
      <Watermark content={["Sia Web UI", "内部资料"]} font={{ color: "rgba(22,119,255,.17)", fontSize: 15 }}>
        <div style={{ minHeight: 260, padding: 24, background: "var(--sia-color-control-hover)", borderRadius: 8 }}><h3>项目交付报告</h3><p>水印层不会阻挡内容选择、按钮点击或滚动。</p><Button variant="primary">正常操作</Button></div>
      </Watermark>
    </DemoCard>
  </ComponentDocPage>;
}

export function NotificationPage() {
  return <ComponentDocPage eyebrow="组件 / 反馈 / Notification" title="Notification 通知提醒框" description="从页面角落展示较完整的全局通知，支持更新、自动关闭和四角定位。" name="Notification" apiRows={[
    { property: "notification.open / success / error", description: "命令式打开不同类型通知", type: "(config) => handle", defaultValue: "-" },
    { property: "message / description", description: "标题与详细内容", type: "ReactNode", defaultValue: "-" },
    { property: "placement / duration", description: "出现位置和持续秒数", type: "topLeft | topRight | bottomLeft | bottomRight / number", defaultValue: "topRight / 4.5" },
    { property: "key / destroy", description: "按键更新和主动销毁", type: "string | number / function", defaultValue: "-" },
  ]}>
    <DemoCard title="命令式通知" description="不需要预先挂载组件，可在业务逻辑中直接调用。" code={`<Space wrap>
  <Button onClick={() => notification.info({ message: "新消息", description: "你有一条新的项目评论。" })}>信息</Button>
  <Button onClick={() => notification.success({ message: "发布完成", description: "版本 v1.2.0 已经上线。" })}>成功</Button>
  <Button onClick={() => notification.warning({ message: "资源不足", description: "存储空间使用率已超过 80%。", placement: "bottomRight" })}>警告</Button>
  <Button danger onClick={() => notification.error({ message: "构建失败", description: "请查看构建日志并重试。", duration: 0 })}>
    错误（不自动关闭）
  </Button>
</Space>`}>
      <Space wrap><Button onClick={() => notification.info({ message: "新消息", description: "你有一条新的项目评论。" })}>信息</Button><Button onClick={() => notification.success({ message: "发布完成", description: "版本 v1.2.0 已经上线。" })}>成功</Button><Button onClick={() => notification.warning({ message: "资源不足", description: "存储空间使用率已超过 80%。", placement: "bottomRight" })}>警告</Button><Button danger onClick={() => notification.error({ message: "构建失败", description: "请查看构建日志并重试。", duration: 0 })}>错误（不自动关闭）</Button></Space>
    </DemoCard>
  </ComponentDocPage>;
}

export function TourPage() {
  const [open, setOpen] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);
  const secondRef = useRef<HTMLButtonElement>(null);
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Tour" title="Tour 漫游式引导" description="逐步聚焦页面元素，为新功能或复杂流程提供上下文引导。" name="Tour" apiRows={[
    { property: "open / current", description: "显示状态与当前步骤", type: "boolean / number", defaultValue: "false / 0" },
    { property: "steps", description: "目标、标题、说明、位置和按钮配置", type: "TourStep[]", defaultValue: "[]" },
    { property: "mask / disabledInteraction", description: "遮罩和目标区交互限制", type: "boolean", defaultValue: "true / false" },
    { property: "onClose / onFinish / onChange", description: "关闭、完成和步骤变化", type: "function", defaultValue: "-" },
  ]}>
    <DemoCard title="两步功能引导" description="高亮目标位置，并在滚动和窗口变化时实时跟随。" code={`const firstRef = useRef(null);
const secondRef = useRef(null);

<Space>
  <Button ref={firstRef} variant="primary">创建项目</Button>
  <Button ref={secondRef}>项目设置</Button>
  <Button onClick={() => setOpen(true)}>开始引导</Button>
</Space>
<Tour
  open={open}
  onClose={() => setOpen(false)}
  steps={[
    { target: () => firstRef.current, title: "创建新项目", placement: "bottom" },
    { target: () => secondRef.current, title: "配置项目", placement: "bottom" },
  ]}
/>`}>
      <Space><Button ref={firstRef} variant="primary" icon={<Icon name="plus" />}>创建项目</Button><Button ref={secondRef} icon={<Icon name="settings" />}>项目设置</Button><Button onClick={() => setOpen(true)}>开始引导</Button></Space>
      <Divider />
      <p>点击“开始引导”后，依次查看创建入口与设置入口。</p>
      <Tour open={open} onClose={() => setOpen(false)} onFinish={() => { setOpen(false); message.success("引导完成"); }} steps={[
        { target: () => firstRef.current, title: "创建新项目", description: "从统一模板快速生成一个新的业务项目。", placement: "bottom" },
        { target: () => secondRef.current, title: "配置项目", description: "在这里调整主题、权限和工程选项。", placement: "bottom" },
      ]} />
    </DemoCard>
  </ComponentDocPage>;
}
