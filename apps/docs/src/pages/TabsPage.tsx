import { Badge, Button, Flex, Icon, Input, Table, Tabs, createPaginationPlugin } from "@sia.soul/sia-react-ui";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const capsuleCode = `<Tabs type="capsule" defaultActiveKey="motion" items={[
  { key: "design", label: "设计", children: "设计规范" },
  { key: "motion", label: "动效", children: "动效规范" },
  { key: "tokens", label: "令牌", children: "设计令牌" },
]} />`;
const underlineCode = `import { Badge, Tabs } from "@sia.soul/sia-react-ui";
import type { CSSProperties } from "react";

<Tabs type="underline" defaultActiveKey="tasks"
  style={{ "--sia-tabs-accent": "#00b578" } as CSSProperties}
  items={[
    { key: "messages", label: <Badge count={12} size="small">消息</Badge>, children: "消息内容" },
    { key: "tasks", label: <Badge count={3} size="small">任务</Badge>, children: "待办任务" },
    { key: "archive", label: "归档", disabled: true },
  ]}
/>`;

const basicCode = `import { Tabs } from "@sia.soul/sia-react-ui";

const items = [
  { key: "overview", label: "项目概览", children: <p>这里展示项目概览。</p> },
  { key: "members", label: "成员管理", children: <p>这里展示成员列表。</p> },
  { key: "settings", label: "项目设置", children: <p>这里展示项目设置。</p> },
];

export default function Demo() {
  // 默认首次访问才挂载，切换后保留内容；需要切走销毁时设置 destroyInactiveTabPane。
  return <Tabs items={items} defaultActiveKey="overview" />;
}`;

/** 用组件内部的输入状态演示切走后保留内容，避免外部状态掩盖重新挂载。 */
function RetainedPanel({ name }: { /** 面板名称，用于区分各自保存的输入。 */ name: string }) {
  const [value, setValue] = useState("");
  return <Input aria-label={`${name}备注`} placeholder={`填写${name}备注，切换标签后再回来`} value={value} onChange={event => setValue(event.target.value)} />;
}

/** 默认按需挂载的示例，标签内容使用稳定组件类型以保留内部状态。 */
function RetainedContentDemo() {
  return <Tabs items={[
    { key: "overview", label: "概览", children: <RetainedPanel name="概览" /> },
    { key: "members", label: "成员", children: <RetainedPanel name="成员" /> },
  ]} />;
}

/** 空数据、少量数据和大量数据共用有界内容区，用于验收分页位置不随行数变化。 */
function RemainingHeightDemo() {
  const [expanded, setExpanded] = useState(false);
  return <div data-testid="tabs-fill-demo" style={{ height: 420 }}>
    <Tabs style={{ height: "100%" }} destroyInactiveTabPane={false} items={[0, 2, 80].map(count => ({
      key: String(count), label: `${count} 条数据`, children: <Flex vertical gap={6} style={{ height: "100%", minHeight: 0 }}>
        <Button onClick={() => setExpanded(value => !value)}>{expanded ? "收起查询条件" : "展开查询条件"}</Button>
        {expanded && <div style={{ height: 60, flexShrink: 0 }}>查询条件占据空间后，表格使用其余高度。</div>}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Table rowKey="id" height="100%" columns={[{ key: "id", code: "id", name: "编号" }, { key: "name", code: "name", name: "名称" }]}
            dataSource={Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `数据 ${index + 1}` }))}
            plugins={[createPaginationPlugin({ pageSize: 100 })]} />
        </div>
      </Flex>,
    }))} />
  </div>;
}

const positionCode = `import { Tabs } from "@sia.soul/sia-react-ui";

const items = [
  { key: "overview", label: "概览", children: "概览内容" },
  { key: "members", label: "成员", children: "成员内容" },
  { key: "settings", label: "设置", children: "设置内容" },
];

export default function Demo() {
  return <>
    <Tabs tabPosition="top" items={items} />
    <Tabs tabPosition="right" items={items} />
    <Tabs tabPosition="bottom" items={items} />
    <Tabs tabPosition="left" items={items} />
  </>;
}`;

const variantCode = `import { Tabs } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const items = [
    { key: "all", label: "全部", children: "全部内容" },
    { key: "active", label: "进行中", children: "进行中的内容" },
    { key: "done", label: "已完成", children: "已完成的内容" },
  ];
  return <>
    <Tabs type="card" items={items} />
    <Tabs type="pill" items={items} />
  </>;
}`;

const techCode = `import { Tabs } from "@sia.soul/sia-react-ui";

const items = [
  { key: "all", label: "全部部门", children: "全部部门数据" },
  { key: "search", label: "搜索电商", children: "搜索电商数据" },
  { key: "interest", label: "兴趣电商", children: "兴趣电商数据" },
  { key: "private", label: "私域", children: "私域数据" },
  { key: "ka", label: "KA", children: "KA 数据" },
];

export default function Demo() {
  return <Tabs
    type="tech"
    tabBarTitle="查看部门"
    items={items}
    defaultActiveKey="private"
  />;
}`;

const techLineCode = `import { Tabs } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <Tabs
    type="tech-line"
    tabBarTitle="今日销售分布"
    defaultActiveKey="amount"
    style={{ width: 636, maxWidth: "100%" }}
    items={[
      { key: "amount", label: "金额" },
      { key: "orders", label: "合作门店订单数" },
      { key: "quantity", label: "件数" },
    ]}
  />;
}`;

const controlledCode = `import { useRef, useState } from "react";
import { Button, Tabs } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [activeKey, setActiveKey] = useState("design");
  const nextTabId = useRef(1);
  const [items, setItems] = useState([
    { key: "design", label: "设计", children: "设计内容" },
    { key: "develop", label: "开发", children: "开发内容" },
    { key: "release", label: "发布", children: "发布内容", disabled: true },
  ]);
  function addTab() {
    const id = nextTabId.current++;
    const key = "new-" + id;
    setItems((current) => [...current, { key, label: "新标签 " + id, children: "新标签 " + id + " 的内容" }]);
    setActiveKey(key);
  }
  return <Tabs
    activeKey={activeKey}
    onChange={setActiveKey}
    items={items}
    tabBarExtraContent={<Button size="small" onClick={addTab}>新增</Button>}
  />;
}`;

const closableCode = `import { useState } from "react";
import { Tabs } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [items, setItems] = useState([
    { key: "query-1", label: "查询 1" },
    { key: "query-2", label: "查询 2" },
  ]);
  return <Tabs
    type="card"
    items={items}
    closable={items.length > 1}
    onEdit={(key, action) => {
      if (action === "remove") setItems((current) => current.filter((item) => item.key !== key));
    }}
  />;
}`;

const apiRows = [
  { property: "items", description: "标签项，包含 key、label、children、icon、disabled 和 closable", type: "TabItem[]", defaultValue: "[]" },
  { property: "activeKey / defaultActiveKey", description: "受控激活项与默认激活项", type: "string", defaultValue: "首个可用项" },
  { property: "onChange", description: "激活项变化回调", type: "(key: string) => void", defaultValue: "-" },
  { property: "deferContent", description: "动画结束后切换面板，等待期间保留旧内容；未访问的目标面板在动画结束后首次挂载，连续切换跳过未显示的中间目标；不改变是否保留面板", type: "boolean", defaultValue: "false" },
  { property: "onAfterChange", description: "动画结束后通知最终目标，可用于更新外部表格或路由；首次渲染不触发，连续切换取消中间任务", type: "(key: string) => void", defaultValue: "-" },
  { property: "type", description: "线型、卡片型、胶囊型、圆角胶囊、紧凑下划线或科技样式", type: "'line' | 'card' | 'pill' | 'capsule' | 'underline' | 'tech' | 'tech-line'", defaultValue: "'line'" },
  { property: "tabPosition", description: "标签栏位于内容的上、右、下或左侧", type: "'top' | 'right' | 'bottom' | 'left'", defaultValue: "'top'" },
  { property: "orientation", description: "兼容旧版横向、纵向排列，推荐使用 tabPosition", type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'" },
  { property: "size / centered", description: "尺寸与居中排列", type: "ControlSize / boolean", defaultValue: "'medium' / false" },
  { property: "contentGap", description: "导航与内容面板的间距（px），仅作用于当前实例", type: "number", defaultValue: "上下 16 / 左右 20" },
  { property: "tabBarTitle", description: "标签栏左侧标题，科技大屏型会附带装饰线", type: "ReactNode", defaultValue: "-" },
  { property: "tabBarExtraContent", description: "标签栏右侧额外操作", type: "ReactNode", defaultValue: "-" },
  { property: "destroyInactiveTabPane", description: "默认首次访问时挂载，切走后隐藏并保留状态；true 时切走卸载、切回重新初始化。删除标签或卸载 Tabs 时释放内容，仅管理 items[].children", type: "boolean", defaultValue: "false" },
  { property: "closable / onEdit", description: "显示关闭操作，并在移除标签时回调", type: "boolean / (key, 'remove') => void", defaultValue: "false / -" },
] as const;

export function TabsPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [activeKey, setActiveKey] = useState("design");
  const nextTabId = useRef(1);
  const [controlledItems, setControlledItems] = useState([
    { key: "design", label: "设计", children: <p>设计内容</p> },
    { key: "develop", label: "开发", children: <p>开发内容</p> },
    { key: "release", label: "发布", children: <p>发布内容</p>, disabled: true },
  ]);
  function addTab() {
    const id = nextTabId.current++;
    const key = `new-${id}`;
    setControlledItems((current) => [...current, { key, label: `新标签 ${id}`, children: <p>新标签 {id} 的内容</p> }]);
    setActiveKey(key);
  }
  const [closableItems, setClosableItems] = useState([
    { key: "query-1", label: "查询 1" },
    { key: "query-2", label: "查询 2" },
    { key: "query-3", label: "查询 3" },
  ]);
  const basicItems = [
    { key: "overview", label: "项目概览", icon: <Icon name="component" size={15} />, children: <p>这里展示项目概览和近期动态。</p> },
    { key: "members", label: "成员管理", icon: <Icon name="user" size={15} />, children: <p>这里展示项目成员及其权限。</p> },
    { key: "settings", label: "项目设置", icon: <Icon name="settings" size={15} />, children: <p>这里展示项目级配置。</p> },
  ];
  const variantItems = [
    { key: "all", label: "全部", children: <p>全部内容</p> },
    { key: "active", label: "进行中", children: <p>进行中的内容</p> },
    { key: "done", label: "已完成", children: <p>已完成的内容</p> },
  ];
  const techItems = [
    { key: "all", label: "全部部门", children: <p>全部部门数据</p> },
    { key: "search", label: "搜索电商", children: <p>搜索电商数据</p> },
    { key: "interest", label: "兴趣电商", children: <p>兴趣电商数据</p> },
    { key: "private", label: "私域", children: <p>私域数据</p> },
    { key: "ka", label: "KA", children: <p>KA 数据</p> },
  ];
  const positionItems = [
    { key: "overview", label: "概览", children: <p>这里展示概览内容。</p> },
    { key: "members", label: "成员", children: <p>这里展示成员内容。</p> },
    { key: "settings", label: "设置", children: <p>这里展示设置内容。</p> },
  ];
  return <>
    <PageHeader eyebrow="组件 / 导航 / Tabs" title="Tabs 标签页" description="在同一层级的内容分组之间切换，支持完整键盘与无障碍语义。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="基础用法" description="底部指示条随选中项平滑滑动；使用方向键切换标签，Home 和 End 可快速跳转首尾。" code={basicCode}>
        <Tabs items={basicItems} defaultActiveKey="overview" />
      </DemoCard>
      <DemoCard title="首次访问挂载并保留状态" description="默认只挂载当前面板，其他面板首次访问时才挂载。输入备注后切换标签再回来，输入状态仍保留，挂载时的初始化请求不会因切回而重复执行。保留挂载不阻止 props、state 或 Context 更新；标签 key 与内容组件类型需保持稳定。" code={`// 默认按需挂载并保留内容，无需额外配置。
<Tabs items={items} />

// 需要切走后释放内容、切回重新初始化时，显式启用销毁。
<Tabs items={items} destroyInactiveTabPane />`}>
        <RetainedContentDemo />
      </DemoCard>
      <DemoCard title="填充剩余高度" description="Tabs 获得确定高度后，面板自动占满导航之外的空间。查询区之外的 Table 使用 height=100%，空数据、少量数据和大量数据均保持分页在底部。" code={'<Tabs style={{ height: "100%" }} items={items} />'}>
        <RemainingHeightDemo />
      </DemoCard>
      <DemoCard title="四个标签位置" description="标签栏可以放在内容区域的上、右、下、左四个方向。" code={positionCode}>
        <div className="tabs-position-demo">
          <section><strong>上方</strong><Tabs tabPosition="top" items={positionItems} /></section>
          <section><strong>下方</strong><Tabs tabPosition="bottom" items={positionItems} /></section>
          <section><strong>左侧</strong><Tabs tabPosition="left" items={positionItems} /></section>
          <section><strong>右侧</strong><Tabs tabPosition="right" items={positionItems} /></section>
        </div>
      </DemoCard>
      <DemoCard title="卡片与胶囊样式" description="不同视觉类型共用相同的数据结构和交互。" code={variantCode}>
        <div className="tabs-demo-stack">
          <Tabs type="card" items={variantItems} />
          <Tabs type="pill" items={variantItems} />
        </div>
      </DemoCard>
      <DemoCard title="圆角胶囊导航" description="白色圆角外框搭配浅色选中胶囊，切换时以 180ms 滑动到目标项并适应宽度，通过 --sia-tabs-accent 和 --sia-tabs-selection-bg 自定义颜色。" code={capsuleCode}>
        <Tabs type="capsule" defaultActiveKey="motion" items={[
          { key: "design", label: "设计", children: <p>设计规范：统一界面中的视觉语言。</p> },
          { key: "motion", label: "动效", children: <div style={{ background: "var(--sia-color-primary-light)", padding: 24, borderRadius: 16 }}><h3>动效规范</h3><p>标签栏、内容面板、选中态可以通过外部样式定制。</p><span>Duration: 180ms</span></div> },
          { key: "tokens", label: "令牌", children: <p>通过设计令牌统一颜色、间距和圆角。</p> },
        ]} />
      </DemoCard>
      <DemoCard title="下划线导航与角标" description="紧凑相邻标签、整项下划线，使用框架 Badge 展示数量；禁用项跳过点击和键盘切换。" code={underlineCode}>
        <Tabs type="underline" defaultActiveKey="tasks" style={{ "--sia-tabs-accent": "#00b578" } as CSSProperties} items={[
          { key: "messages", label: <Badge count={12} size="small">消息</Badge>, children: <p>共 12 条消息。</p> },
          { key: "tasks", label: <Badge count={3} size="small">任务</Badge>, children: <div style={{ background: "color-mix(in srgb, var(--sia-color-warning) 7%, var(--sia-color-surface))", padding: 24, borderRadius: 16 }}><h3>待办任务</h3><p>禁用前也可以参与排序与分组。</p><span>待处理 3 项</span></div> },
          { key: "archive", label: "归档", disabled: true },
        ]} />
      </DemoCard>
      <DemoCard title="科技大屏样式" description="选中背景以 180ms 滑动切换，使用框架主题实色，顶部装饰线由深到浅，并自动适配亮色与暗色模式。" code={techCode}>
        <Tabs type="tech" tabBarTitle="查看部门" items={techItems} defaultActiveKey="private" />
      </DemoCard>
      <DemoCard title="折线科技大屏样式" description="导航栏最小高度为 50px，左右内边距为 12px；左侧宽度随标题内容自适应，空间不足时，剩余标签收起到末尾的更多菜单，悬停或点击省略号即可选择；选中框在 180ms 内同步移动和伸缩，支持明暗主题。" code={techLineCode}>
        <Tabs type="tech-line" tabBarTitle="今日销售分布" style={{ width: 636, maxWidth: "100%" }} items={[
          { key: "amount", label: "金额" },
          { key: "orders", label: "合作门店订单数" },
          { key: "quantity", label: "件数" },
        ]} />
      </DemoCard>
      <DemoCard title="更多选项卡" description="横向空间不足时，剩余选项收起到省略号菜单；支持悬停、点击和键盘下方向键展开，禁用项不可选择。" code={'<Tabs style={{ width: 480, maxWidth: "100%" }} items={items} />'}>
        <Tabs type="tech-line" style={{ width: 480, maxWidth: "100%" }} items={[
          { key: "base", label: "基础设置", children: "基础设置内容" },
          { key: "partner", label: "合作方管理", children: "合作方管理内容" },
          { key: "store", label: "合作方店铺管理", children: "合作方店铺管理内容" },
          { key: "distributor", label: "合作分销商管理", children: "合作分销商管理内容" },
          { key: "job", label: "自动作业", disabled: true },
          { key: "request", label: "补拉申请", children: "补拉申请内容" },
        ]} />
      </DemoCard>
      <DemoCard title="动画结束后切换内容" description="deferContent 让旧面板保持到动画结束，再显示目标面板；未访问的目标此时才挂载，已访问的默认保留状态。外部表格或路由应在 onAfterChange 中更新，缓存需由业务自行管理。" code={`// 面板在 Tabs 内部：动画结束后显示目标组件，首次访问才挂载，切走后默认保留。
<Tabs type="tech-line" deferContent items={[
  { key: "amount", label: "金额", children: <AmountTable /> },
  { key: "orders", label: "合作门店订单数", children: <OrderTable /> },
]} />

// 内容在 Tabs 外部：分别管理标签状态与内容状态。
<Tabs type="tech-line" activeKey={activeKey}
  onChange={setActiveKey} onAfterChange={setContentKey} items={items} />
{contentKey === "amount" ? <AmountTable /> : <OrderTable />}`}>
        <Tabs type="tech-line" deferContent items={[
          { key: "amount", label: "金额", children: <p>金额面板：切换时保留此内容，直到选中框动画结束。</p> },
          { key: "orders", label: "合作门店订单数", children: <p>订单面板：选中框到位后才显示此内容。</p> },
        ]} />
      </DemoCard>
      {/* 嵌套示例验证外层科技装饰不穿透到内层竖向导航。 */}
      <DemoCard title="嵌套页签与内容间距" description="contentGap 控制导航与面板之间的像素间距；内层 Tabs 独立使用自己的样式和间距。" code={'<Tabs type="tech-line" contentGap={0} items={[{ key: "settings", label: "基础设置", children: <Tabs tabPosition="left" items={items} /> }]} />'}>
        <Tabs type="tech-line" contentGap={0} items={[
          { key: "settings", label: "基础设置", children: <Tabs tabPosition="left" items={[
            { key: "application", label: "合作申请设置", children: "内容与导航紧凑排列，左侧不应出现科技装饰横线。" },
            { key: "sync", label: "数据同步设置", children: "内层选中态保持普通竖向线条。" },
          ]} /> },
        ]} />
      </DemoCard>
      <DemoCard title="受控、禁用与额外操作" description="发布项不可选择，激活状态由页面统一管理。" code={controlledCode}>
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={controlledItems}
          tabBarExtraContent={<Button size="small" icon={<Icon name="plus" size={14} />} onClick={addTab}>新增</Button>}
        />
      </DemoCard>
      <DemoCard title="可关闭标签" description="工作台类应用可以关闭标签；仅剩一项时可通过 closable 禁止关闭。" code={closableCode}>
        <Tabs
          type="card"
          items={closableItems}
          closable={closableItems.length > 1}
          onEdit={(key, action) => {
            if (action === "remove") setClosableItems((items) => items.filter((item) => item.key !== key));
          }}
        />
      </DemoCard>
    </div> : <ApiTable name="Tabs" rows={apiRows} />}
  </>;
}
