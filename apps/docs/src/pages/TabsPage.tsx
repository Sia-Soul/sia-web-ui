import { Button, Icon, Tabs } from "@sia-ui/react";
import { useRef, useState } from "react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const basicCode = `import { Tabs } from "@sia-ui/react";

const items = [
  { key: "overview", label: "项目概览", children: <p>这里展示项目概览。</p> },
  { key: "members", label: "成员管理", children: <p>这里展示成员列表。</p> },
  { key: "settings", label: "项目设置", children: <p>这里展示项目设置。</p> },
];

export default function Demo() {
  return <Tabs items={items} defaultActiveKey="overview" />;
}`;

const positionCode = `import { Tabs } from "@sia-ui/react";

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

const variantCode = `import { Tabs } from "@sia-ui/react";

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

const controlledCode = `import { useRef, useState } from "react";
import { Button, Tabs } from "@sia-ui/react";

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
import { Tabs } from "@sia-ui/react";

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
  { property: "type", description: "线型、卡片型或胶囊型", type: "'line' | 'card' | 'pill'", defaultValue: "'line'" },
  { property: "tabPosition", description: "标签栏位于内容的上、右、下或左侧", type: "'top' | 'right' | 'bottom' | 'left'", defaultValue: "'top'" },
  { property: "orientation", description: "兼容旧版横向、纵向排列，推荐使用 tabPosition", type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'" },
  { property: "size / centered", description: "尺寸与居中排列", type: "ControlSize / boolean", defaultValue: "'medium' / false" },
  { property: "tabBarExtraContent", description: "标签栏右侧额外操作", type: "ReactNode", defaultValue: "-" },
  { property: "destroyInactiveTabPane", description: "是否卸载非激活面板", type: "boolean", defaultValue: "true" },
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
  const positionItems = [
    { key: "overview", label: "概览", children: <p>这里展示概览内容。</p> },
    { key: "members", label: "成员", children: <p>这里展示成员内容。</p> },
    { key: "settings", label: "设置", children: <p>这里展示设置内容。</p> },
  ];
  return <>
    <PageHeader eyebrow="组件 / 导航 / Tabs" title="Tabs 标签页" description="在同一层级的内容分组之间切换，支持完整键盘与无障碍语义。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="基础用法" description="使用方向键切换标签，Home 和 End 可快速跳转首尾。" code={basicCode}>
        <Tabs items={basicItems} defaultActiveKey="overview" />
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
