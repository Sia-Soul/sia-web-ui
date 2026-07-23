import { useState } from "react";
import {
  Badge, Button, Calendar, Card, Carousel, Collapse, Icon, Image as SiaImage, Popover, Rate, Space, Tag, Timeline, Tooltip, Tree,
} from "@sia-ui/react";
import type { CollapseKey, TreeKey, TreeNode } from "@sia-ui/react";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

export function RatePage() {
  const [value, setValue] = useState(3.5);
  return <ComponentDocPage eyebrow="组件 / 数据录入 / Rate" title="Rate 评分" description="对内容进行等级评价，支持半星、清除、自定义字符和提示文本。" name="Rate" apiRows={[
    { property: "value / defaultValue", description: "受控或默认评分", type: "number", defaultValue: "0" },
    { property: "count / allowHalf", description: "总星数与半星", type: "number / boolean", defaultValue: "5 / false" },
    { property: "allowClear / disabled", description: "再次点击清除与只读", type: "boolean", defaultValue: "true / false" },
    { property: "character / tooltips", description: "自定义字符和每级提示", type: "ReactNode | function / string[]", defaultValue: "-" },
  ]}>
    <DemoCard title="半星与提示" description={`当前评分：${value}`} code={`<Rate allowHalf value={value} onChange={setValue} tooltips={["很差", "较差", "一般", "满意", "很棒"]} />`}>
      <Space align="center"><Rate allowHalf value={value} onChange={setValue} tooltips={["很差", "较差", "一般", "满意", "很棒"]} /><strong>{value} 分</strong></Space>
    </DemoCard>
    <DemoCard title="自定义字符" description="character 可以是任意 React 节点或函数。" code={`<Rate character={<Icon name="heart" variant="filled" />} defaultValue={4} />`}>
      <Rate character={<Icon name="heart" variant="filled" />} defaultValue={4} />
    </DemoCard>
  </ComponentDocPage>;
}

export function BadgePage() {
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Badge" title="Badge 徽标数" description="在元素右上角展示数量、状态点或轻量状态文本。" name="Badge" apiRows={[
    { property: "count / overflowCount", description: "数量与封顶显示值", type: "ReactNode / number", defaultValue: "- / 99" },
    { property: "dot / showZero", description: "红点和零值显示", type: "boolean", defaultValue: "false" },
    { property: "status / text", description: "独立状态点和说明", type: "success | processing | default | error | warning", defaultValue: "-" },
    { property: "Badge.Ribbon", description: "卡片角标", type: "text / color / placement", defaultValue: "-" },
  ]}>
    <DemoCard title="数字、红点与状态" description="支持数量封顶、偏移和自定义颜色。" code={`<Space size="large" wrap>
  <Badge count={120}><Button>消息</Button></Badge>
  <Badge dot><Button icon={<Icon name="bell" />}>通知</Button></Badge>
  <Badge status="success" text="运行正常" />
  <Badge status="processing" text="处理中" />
</Space>`}>
      <Space size="large" wrap><Badge count={120}><Button>消息</Button></Badge><Badge dot><Button icon={<Icon name="bell" />}>通知</Button></Badge><Badge status="success" text="运行正常" /><Badge status="processing" text="处理中" /></Space>
    </DemoCard>
    <DemoCard title="卡片角标" description="Ribbon 用于强调卡片状态。" code={`<Badge.Ribbon text="推荐">
  <Card title="企业版" description="适合多人协作团队">
    包含完整的权限与审计能力。
  </Card>
</Badge.Ribbon>`}>
      <Badge.Ribbon text="推荐"><Card title="企业版" description="适合多人协作团队">包含完整的权限与审计能力。</Card></Badge.Ribbon>
    </DemoCard>
  </ComponentDocPage>;
}

export function CalendarPage() {
  const [value, setValue] = useState("2026-07-20");
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Calendar" title="Calendar 日历" description="以月历或年面板展示日期，并承载日期级数据与选择状态。" name="Calendar" apiRows={[
    { property: "value / defaultValue", description: "YYYY-MM-DD 日期值", type: "string", defaultValue: "今天" },
    { property: "mode / fullscreen", description: "月年面板和完整/迷你尺寸", type: "month | year / boolean", defaultValue: "month / true" },
    { property: "validRange / disabledDate", description: "有效范围与禁用函数", type: "[string,string] / function", defaultValue: "-" },
    { property: "dateCellRender / fullCellRender", description: "日期单元格扩展与完全渲染", type: "function", defaultValue: "-" },
  ]}>
    <DemoCard title="带日程的月历" description={`已选择：${value}`} code={`<Calendar
  value={value}
  onChange={setValue}
  dateCellRender={(date) =>
    date.endsWith("-20")
      ? <Tag status="success">发布</Tag>
      : date.endsWith("-24")
        ? <Tag status="warning">评审</Tag>
        : null
  }
/>`}>
      <Calendar value={value} onChange={setValue} dateCellRender={(date) => date.endsWith("-20") ? <Tag status="success">发布</Tag> : date.endsWith("-24") ? <Tag status="warning">评审</Tag> : null} />
    </DemoCard>
    <DemoCard title="迷你日历" description="适合侧栏、卡片和筛选面板。" code={`<Calendar fullscreen={false} defaultValue="2026-07-20" />`}><Calendar fullscreen={false} defaultValue="2026-07-20" /></DemoCard>
  </ComponentDocPage>;
}

const slideStyle = (background: string) => ({ display: "grid", placeItems: "center", height: 220, color: "#fff", background, fontSize: 28, fontWeight: 700 });
export function CarouselPage() {
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Carousel" title="Carousel 走马灯" description="循环展示一组内容，支持自动播放、箭头、指示点和淡入切换。" name="Carousel" apiRows={[
    { property: "autoplay / autoplaySpeed", description: "自动播放与间隔时间", type: "boolean / number", defaultValue: "false / 3000" },
    { property: "arrows / dots", description: "显示切换箭头和指示点", type: "boolean", defaultValue: "false / true" },
    { property: "effect", description: "滚动或淡入效果", type: "scroll | fade", defaultValue: "scroll" },
    { property: "infinite / pauseOnHover", description: "循环和悬停暂停", type: "boolean", defaultValue: "true" },
  ]}>
    <DemoCard title="自动轮播" description="悬停时暂停，支持箭头与指示点切换。" code={`<Carousel autoplay arrows>
  <div style={slideStyle("#1677ff")}>统一组件</div>
  <div style={slideStyle("#5b5bd6")}>统一样式</div>
  <div style={slideStyle("#13a8a8")}>加速交付</div>
</Carousel>`}>
      <Carousel autoplay arrows><div style={slideStyle("#1677ff")}>统一组件</div><div style={slideStyle("#5b5bd6")}>统一样式</div><div style={slideStyle("#13a8a8")}>加速交付</div></Carousel>
    </DemoCard>
  </ComponentDocPage>;
}

export function CollapsePage() {
  const [keys, setKeys] = useState<CollapseKey[]>(["overview"]);
  const items = [
    { key: "overview", label: "项目概览", children: "Sia Web UI 为业务项目提供统一的交互和视觉基础。" },
    { key: "components", label: "组件能力", children: "组件全部由本项目实现，不依赖 Ant Design 运行时。" },
    { key: "disabled", label: "不可展开", children: "隐藏内容", disabled: true },
  ];
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Collapse" title="Collapse 折叠面板" description="在有限区域内分组收纳内容，支持手风琴、无边框和销毁隐藏面板。" name="Collapse" apiRows={[
    { property: "items", description: "面板标题、内容、额外操作和状态", type: "CollapseItem[]", defaultValue: "[]" },
    { property: "activeKey / defaultActiveKey", description: "展开面板键", type: "Key | Key[]", defaultValue: "[]" },
    { property: "accordion / ghost", description: "手风琴与透明样式", type: "boolean", defaultValue: "false" },
    { property: "destroyInactivePanel", description: "收起后销毁内容", type: "boolean", defaultValue: "false" },
  ]}>
    <DemoCard title="受控面板" description={`已展开：${keys.join(", ") || "无"}`} code={`<Collapse items={items} activeKey={keys} onChange={(next) => setKeys(next as CollapseKey[])} />`}>
      <Collapse items={items} activeKey={keys} onChange={(next) => setKeys(Array.isArray(next) ? next : [next])} />
    </DemoCard>
    <DemoCard title="手风琴与无边框" description="同一时间只展开一个面板。" code={`<Collapse accordion ghost items={items} />`}><Collapse accordion ghost items={items.slice(0, 2)} /></DemoCard>
  </ComponentDocPage>;
}

const imageSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='400'%3E%3Cdefs%3E%3ClinearGradient id='g' x2='1' y2='1'%3E%3Cstop stop-color='%231677ff'/%3E%3Cstop offset='1' stop-color='%236f55d9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='720' height='400' rx='24' fill='url(%23g)'/%3E%3Ccircle cx='590' cy='85' r='38' fill='%23fff' fill-opacity='.22'/%3E%3Cpath d='M0 330 190 160l130 120 95-80 305 200H0Z' fill='%23fff' fill-opacity='.2'/%3E%3Ctext x='42' y='72' font-size='34' font-family='sans-serif' fill='white'%3ESia Web UI%3C/text%3E%3C/svg%3E";
export function ImagePage() {
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Image" title="Image 图片" description="展示图片并提供占位、加载失败回退和遮罩预览。" name="Image" apiRows={[
    { property: "src / fallback", description: "图片地址和失败回退地址", type: "string", defaultValue: "-" },
    { property: "placeholder", description: "加载完成前的占位内容", type: "ReactNode", defaultValue: "-" },
    { property: "preview", description: "预览开关或配置", type: "boolean | ImagePreviewConfig", defaultValue: "true" },
    { property: "width / height", description: "继承原生图片尺寸属性", type: "number | string", defaultValue: "-" },
  ]}>
    <DemoCard title="点击预览" description="鼠标移入图片显示实色预览遮罩，遮罩、占位层和图片始终使用相同圆角。" code={`<Image
  width={420}
  style={{ borderRadius: 24 }}
  src={imageSrc}
  alt="Sia Web UI 渐变风景示意图"
  placeholder={<span>图片加载中...</span>}
/>`}>
      <SiaImage width={420} style={{ borderRadius: 24 }} src={imageSrc} alt="Sia Web UI 渐变风景示意图" placeholder={<SpinPlaceholder />} />
    </DemoCard>
  </ComponentDocPage>;
}
function SpinPlaceholder() { return <span style={{ padding: 30, color: "var(--sia-color-text-secondary)" }}>图片加载中...</span>; }

export function PopoverPage() {
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Popover" title="Popover 气泡卡片" description="点击、悬停或聚焦元素时展示结构化的补充内容。" name="Popover" apiRows={[
    { property: "title / content", description: "标题与正文", type: "ReactNode", defaultValue: "-" },
    { property: "trigger", description: "触发方式", type: "click | hover | focus", defaultValue: "click" },
    { property: "placement", description: "八个方向的位置", type: "FloatingPlacement", defaultValue: "top" },
    { property: "open / onOpenChange", description: "受控显示状态", type: "boolean / function", defaultValue: "-" },
  ]}>
    <DemoCard title="点击和悬停" description="浮层继承明暗主题并支持自定义内容。" code={`<Space>
  <Popover title="组件说明" content="全部为 Sia Web UI 自研实现。" placement="bottom">
    <Button>点击查看</Button>
  </Popover>
  <Popover title="快捷提示" content="悬停后展示" trigger="hover">
    <Button>鼠标悬停</Button>
  </Popover>
</Space>`}>
      <Space><Popover title="组件说明" content="全部为 Sia Web UI 自研实现。" placement="bottom"><Button>点击查看</Button></Popover><Popover title="快捷提示" content="悬停后展示" trigger="hover"><Button>鼠标悬停</Button></Popover></Space>
    </DemoCard>
  </ComponentDocPage>;
}

export function TimelinePage() {
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Timeline" title="Timeline 时间轴" description="按时间顺序垂直展示事件、状态和阶段信息。" name="Timeline" apiRows={[
    { property: "items", description: "节点内容、标签、颜色和自定义圆点", type: "TimelineItem[]", defaultValue: "[]" },
    { property: "mode", description: "内容位置", type: "left | right | alternate", defaultValue: "left" },
    { property: "pending / pendingDot", description: "尾部待处理节点", type: "ReactNode | boolean", defaultValue: "false" },
    { property: "reverse", description: "反转节点顺序", type: "boolean", defaultValue: "false" },
  ]}>
    <DemoCard title="项目发布记录" description="颜色用于区分成功、异常和普通节点。" code={`<Timeline items={[{ children: "创建项目" }, { color: "green", children: "构建完成" }]} pending="等待发布" />`}>
      <Timeline pending="等待生产发布" items={[
        { children: <><strong>创建项目</strong><div>2026-07-18 09:30</div></> },
        { color: "green", children: <><strong>测试构建完成</strong><div>2026-07-19 14:20</div></> },
        { color: "red", children: <><strong>安全扫描发现 1 个问题</strong><div>2026-07-20 10:10</div></> },
      ]} />
    </DemoCard>
  </ComponentDocPage>;
}

export function TooltipPage() {
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Tooltip" title="Tooltip 文字提示" description="为控件或图标提供简短、非交互的补充说明。" name="Tooltip" apiRows={[
    { property: "title", description: "提示内容", type: "ReactNode", defaultValue: "-" },
    { property: "placement", description: "浮层位置", type: "FloatingPlacement", defaultValue: "top" },
    { property: "trigger", description: "悬停、聚焦或点击", type: "FloatingTrigger | FloatingTrigger[]", defaultValue: "hover" },
    { property: "mouseEnterDelay / mouseLeaveDelay", description: "显示和隐藏延迟（秒）", type: "number", defaultValue: "0.1" },
  ]}>
    <DemoCard title="不同方向" description="键盘聚焦也能显示提示。" code={`<Space size="large">
  <Tooltip title="左侧提示" placement="left" trigger={["hover", "focus"]}><Button>Left</Button></Tooltip>
  <Tooltip title="上方提示" placement="top" trigger={["hover", "focus"]}><Button>Top</Button></Tooltip>
  <Tooltip title="下方提示" placement="bottom" trigger={["hover", "focus"]}><Button>Bottom</Button></Tooltip>
  <Tooltip title="右侧提示" placement="right" trigger={["hover", "focus"]}><Button>Right</Button></Tooltip>
</Space>`}>
      <Space size="large"><Tooltip title="左侧提示" placement="left" trigger={["hover", "focus"]}><Button>Left</Button></Tooltip><Tooltip title="上方提示" trigger={["hover", "focus"]}><Button>Top</Button></Tooltip><Tooltip title="下方提示" placement="bottom" trigger={["hover", "focus"]}><Button>Bottom</Button></Tooltip><Tooltip title="右侧提示" placement="right" trigger={["hover", "focus"]}><Button>Right</Button></Tooltip></Space>
    </DemoCard>
  </ComponentDocPage>;
}

const treeData: readonly TreeNode[] = [
  { key: "product", title: "产品中心", children: [
    { key: "web", title: "Web 产品", children: [{ key: "admin", title: "管理后台" }, { key: "site", title: "官方网站" }] },
    { key: "desktop", title: "客户端产品" },
  ] },
  { key: "rd", title: "研发中心", children: [{ key: "frontend", title: "前端组" }, { key: "backend", title: "后端组" }] },
];
export function TreePage() {
  const [selected, setSelected] = useState<TreeKey[]>(["admin"]);
  const [checked, setChecked] = useState<TreeKey[]>(["frontend"]);
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Tree" title="Tree 树形控件" description="展示和操作层级数据，支持展开、选择、勾选、异步加载与拖拽。" name="Tree" apiRows={[
    { property: "treeData", description: "树形节点数据", type: "TreeNode[]", defaultValue: "[]" },
    { property: "selectedKeys / expandedKeys / checkedKeys", description: "选择、展开和勾选键", type: "Key[]", defaultValue: "[]" },
    { property: "checkable / checkStrictly", description: "勾选与父子独立模式", type: "boolean", defaultValue: "false" },
    { property: "loadData / draggable / onDrop", description: "异步节点与拖拽", type: "function / boolean / function", defaultValue: "-" },
    { property: "TreeNode.rowProps", description: "传递到节点整行容器的原生属性，可用于右键菜单与测试标识", type: "HTMLAttributes<HTMLDivElement>", defaultValue: "-" },
  ]}>
    <DemoCard title="选择与勾选" description={`选择 ${selected.length} 项，勾选 ${checked.length} 项`} code={`<Tree
  treeData={treeData}
  selectedKeys={selected}
  onSelect={setSelected}
  checkedKeys={checked}
  onCheck={setChecked}
  checkable
  showLine
  showIcon
  defaultExpandAll
  blockNode
/>`}>
      <Tree treeData={treeData} selectedKeys={selected} onSelect={setSelected} checkedKeys={checked} onCheck={setChecked} checkable showLine showIcon defaultExpandAll blockNode />
    </DemoCard>
  </ComponentDocPage>;
}
