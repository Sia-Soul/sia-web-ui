import { useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb, Icon, Typography } from "@sia-ui/react";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";
import { ApiTable } from "./ApiTable";

const basicCode = `import { Breadcrumb } from "@sia-ui/react";

<Breadcrumb items={[
  { title: "首页", href: "/introduction" },
  { title: "组件", href: "/components/button" },
  { title: "面包屑" },
]} />`;
const apiRows = [
  { property: "items", description: "按层级排列的项目，最后一项表示当前页面", type: "BreadcrumbItem[]", defaultValue: "-" },
  { property: "separator", description: "全局分隔符，可传入图标或文字", type: "ReactNode", defaultValue: "'/'" },
  { property: "itemRender", description: "自定义项目内容，可接入路由 Link", type: "(item, index, items) => ReactNode", defaultValue: "-" },
  { property: "items[].title / icon / key", description: "标题、可选图标和稳定标识", type: "ReactNode / ReactNode / string", defaultValue: "-" },
  { property: "items[].href / target", description: "链接地址及打开方式", type: "string", defaultValue: "-" },
  { property: "items[].onClick / disabled", description: "点击回调和禁用状态", type: "MouseEventHandler / boolean", defaultValue: "- / false" },
  { property: "items[].separator", description: "覆盖该项后方的分隔符，null 隐藏", type: "ReactNode", defaultValue: "继承 separator" },
  { property: "items[].menu", description: "层级下拉菜单，复用 Dropdown 的菜单配置", type: "DropdownMenuProps", defaultValue: "-" },
] as const;

export function BreadcrumbPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [project, setProject] = useState("项目 A");
  const [section, setSection] = useState("任务详情");
  return <>
    <PageHeader eyebrow="组件 / 导航 / Breadcrumb" title="Breadcrumb 面包屑" description="展示当前页面所处的信息层级，支持链接、图标、分隔符和同级菜单。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "api" ? <ApiTable name="Breadcrumb" rows={apiRows} /> : <div className="demo-stack">
      <DemoCard title="基础用法" description="前面的层级可以跳转，最后一项突出显示当前位置。" code={basicCode}>
        <Breadcrumb items={[{ title: "首页", href: "/introduction" }, { title: "组件", href: "/components/button" }, { title: "面包屑" }]} />
      </DemoCard>
      <DemoCard title="图标与自定义分隔符" description="标题支持图标，分隔符可以统一设置，也可以针对某一层单独覆盖。" code={'<Breadcrumb separator={<Icon name="chevron-right" size={12} />} items={[\n  { title: "首页", icon: <Icon name="home" size={15} />, href: "/introduction" },\n  { title: "项目", separator: ":" },\n  { title: "项目详情" },\n]} />'}>
        <Breadcrumb separator={<Icon name="chevron-right" size={12} />} items={[{ title: "首页", icon: <Icon name="home" size={15} />, href: "/introduction" }, { title: "项目", icon: <Icon name="folder" size={15} />, separator: ":" }, { title: "项目详情" }]} />
      </DemoCard>
      <DemoCard title="同级菜单" description="点击项目旁的箭头切换项目，菜单选择后同步更新当前路径。" code={'const [project, setProject] = useState("项目 A");\n\n<Breadcrumb items={[\n  { title: "工作台" },\n  { title: project, menu: {\n    items: ["项目 A", "项目 B", "项目 C"].map((key) => ({ key, label: key })),\n    onClick: ({ key }) => setProject(key),\n  } },\n  { title: "项目概览" },\n]} />'}>
        <Breadcrumb items={[{ title: "工作台" }, { title: project, menu: { items: ["项目 A", "项目 B", "项目 C"].map((key) => ({ key, label: key })), onClick: ({ key }) => setProject(key) } }, { title: "项目概览" }]} />
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>当前项目：{project}</Typography.Paragraph>
      </DemoCard>
      <DemoCard title="点击回调与禁用" description="页面内切换可以使用点击回调；禁用层级不触发跳转或回调。" code={'<Breadcrumb items={[\n  { title: "任务列表", onClick: () => setSection("任务列表") },\n  { title: "归档区", disabled: true },\n  { title: section },\n]} />'}>
        <Breadcrumb items={[{ title: "任务列表", onClick: () => setSection("任务列表") }, { title: "归档区", disabled: true, href: "/introduction" }, { title: section }]} />
      </DemoCard>
      <DemoCard title="路由集成" description="通过 itemRender 使用 React Router Link，跳转时保持单页应用行为。" code={'import { Link } from "react-router-dom";\n\n<Breadcrumb items={[\n  { title: "组件", href: "/components/button" },\n  { title: "面包屑" },\n]} itemRender={(item) => item.href\n  ? <Link to={item.href}>{item.title}</Link>\n  : item.title\n} />'}>
        <Breadcrumb items={[{ title: "组件", href: "/components/button" }, { title: "面包屑" }]} itemRender={(item) => item.href ? <Link to={item.href}>{item.title}</Link> : item.title} />
      </DemoCard>
    </div>}
  </>;
}
