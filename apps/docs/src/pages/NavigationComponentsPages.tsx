import { useState } from "react";
import { Button, Dropdown, Icon, Menu, Pagination, Segmented, Space, Steps } from "@sia-ui/react";
import type { MenuItem, SegmentedValue } from "@sia-ui/react";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const menuItems: readonly MenuItem[] = [
  { key: "dashboard", label: "工作台", icon: <Icon name="home" /> },
  { key: "product", label: "产品中心", icon: <Icon name="component" />, children: [
    { key: "list", label: "产品列表" }, { key: "category", label: "分类管理" },
  ] },
  { type: "divider", key: "divider" },
  { key: "settings", label: "系统设置", icon: <Icon name="settings" />, danger: true },
];
const menuCode = `import { Icon, Menu } from "@sia-ui/react";

const items = [
  { key: "dashboard", label: "工作台", icon: <Icon name="home" /> },
  { key: "product", label: "产品中心", children: [
    { key: "list", label: "产品列表" },
    { key: "category", label: "分类管理" },
  ] },
];

export default function Demo() {
  return <Menu mode="inline" items={items} defaultSelectedKeys={["dashboard"]} />;
}`;
export function MenuPage() {
  return <ComponentDocPage eyebrow="组件 / 导航 / Menu" title="Menu 菜单" description="组织页面和功能入口，支持横向、纵向、内嵌、折叠与多级结构。" name="Menu" apiRows={[
    { property: "items", description: "菜单、分组、分割线与子菜单数据", type: "MenuItem[]", defaultValue: "[]" },
    { property: "mode", description: "菜单布局模式", type: "vertical | horizontal | inline", defaultValue: "vertical" },
    { property: "selectedKeys / openKeys", description: "受控选中项与展开项", type: "string[]", defaultValue: "[]" },
    { property: "multiple / selectable", description: "多选和是否可选择", type: "boolean", defaultValue: "false / true" },
    { property: "inlineCollapsed", description: "收起内嵌菜单", type: "boolean", defaultValue: "false" },
  ]}>
    <DemoCard title="内嵌多级菜单" description="子菜单、选中状态和危险操作均由 items 描述。" code={menuCode}>
      <div style={{ width: 280 }}><Menu mode="inline" items={menuItems} defaultSelectedKeys={["dashboard"]} defaultOpenKeys={["product"]} /></div>
    </DemoCard>
    <DemoCard title="顶部导航" description="同一份数据切换为横向模式。" code={`<Menu mode="horizontal" items={items} defaultSelectedKeys={["dashboard"]} />`}>
      <Menu mode="horizontal" items={menuItems.slice(0, 2)} defaultSelectedKeys={["dashboard"]} />
    </DemoCard>
  </ComponentDocPage>;
}

const dropdownItems: readonly MenuItem[] = [
  { key: "edit", label: "编辑项目", icon: <Icon name="edit" /> },
  { key: "copy", label: "复制项目", icon: <Icon name="copy" /> },
  { key: "more", label: "更多操作", icon: <Icon name="more-horizontal" />, children: [
    { key: "archive", label: "归档项目" },
    { key: "export", label: "导出数据" },
  ] },
  { type: "divider", key: "divider" },
  { key: "delete", label: "删除项目", icon: <Icon name="trash" />, danger: true },
];
const dropdownCode = `import { Button, Dropdown } from "@sia-ui/react";

const items = [
  { key: "edit", label: "编辑项目" },
  { key: "copy", label: "复制项目" },
  { key: "delete", label: "删除项目", danger: true },
];

export default function Demo() {
  return (
    <Dropdown
      menu={{ items, onClick: ({ key }) => console.log(key) }}
      trigger={["click"]}
      arrow={{ pointAtCenter: true }}
    >
      <Button>项目操作</Button>
    </Dropdown>
  );
}`;

export function DropdownPage() {
  const [lastAction, setLastAction] = useState("尚未选择");
  return <ComponentDocPage eyebrow="组件 / 导航 / Dropdown" title="Dropdown 下拉菜单" description="从触发器展开页面级菜单，支持点击、悬停、右键、多级菜单和组合按钮。" name="Dropdown" apiRows={[
    { property: "menu", description: "菜单项、选中状态与点击回调", type: "DropdownMenuProps", defaultValue: "-" },
    { property: "trigger", description: "触发方式，可以组合使用", type: "(click | hover | contextMenu)[]", defaultValue: "[hover]" },
    { property: "placement", description: "相对触发器的展开方向", type: "bottomLeft | bottomRight | topLeft | topRight", defaultValue: "bottomLeft" },
    { property: "open / defaultOpen", description: "受控或非受控打开状态", type: "boolean", defaultValue: "false" },
    { property: "arrow", description: "显示箭头及是否指向触发器中心", type: "boolean | { pointAtCenter }", defaultValue: "false" },
    { property: "popupRender", description: "自定义菜单浮层内容", type: "(menu) => ReactNode", defaultValue: "-" },
    { property: "onOpenChange", description: "打开状态变化，区分触发器与菜单来源", type: "(open, { source }) => void", defaultValue: "-" },
  ]}>
    <DemoCard title="点击展开" description={`当前操作：${lastAction}。浮层挂载到页面根节点，不受 Card 的 overflow 影响。`} code={dropdownCode}>
      <Dropdown
        menu={{ items: dropdownItems, onClick: ({ item }) => setLastAction(String(item.label)) }}
        trigger={["click"]}
        arrow={{ pointAtCenter: true }}
      >
        <Button icon={<Icon name="settings" />}>项目操作</Button>
      </Dropdown>
    </DemoCard>
    <DemoCard title="悬停与多级菜单" description="鼠标在触发器与浮层之间移动时保持打开，子菜单自动向可用空间展开。" code={`<Dropdown menu={{ items }} trigger={["hover"]} placement="bottomLeft"><Button>悬停展开</Button></Dropdown>`}>
      <Space>
        <Dropdown menu={{ items: dropdownItems }} trigger={["hover"]}>
          <Button>悬停展开</Button>
        </Dropdown>
        <Dropdown menu={{ items: dropdownItems }} trigger={["click"]} placement="topRight">
          <Button>向上展开</Button>
        </Dropdown>
      </Space>
    </DemoCard>
    <DemoCard title="组合按钮与右键菜单" description="主按钮执行默认动作，箭头展开更多操作；也可以在指定区域使用右键菜单。" code={`<Dropdown.Button menu={{ items }} onClick={save}>保存</Dropdown.Button>\n\n<Dropdown menu={{ items }} trigger={["contextMenu"]} style={{ width: 420, maxWidth: "100%", minHeight: 92, border: "1px dashed #d9d9d9" }}>在此区域单击右键</Dropdown>`}>
      <Space direction="vertical" size={16}>
        <Dropdown.Button menu={{ items: dropdownItems }} buttonProps={{ variant: "primary" }} onClick={() => setLastAction("立即保存")}>立即保存</Dropdown.Button>
        <Dropdown menu={{ items: dropdownItems }} trigger={["contextMenu"]} className="dropdown-context-demo">
          在此区域单击右键
        </Dropdown>
      </Space>
    </DemoCard>
  </ComponentDocPage>;
}

const paginationCode = `import { Pagination } from "@sia-ui/react";

export default function Demo() {
  return (
    <Pagination
      defaultCurrent={3}
      total={286}
      defaultPageSize={25}
      onChange={(page, pageSize) => console.log(page, pageSize)}
    />
  );
}`;
export function PaginationPage() {
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(25);
  return <ComponentDocPage eyebrow="组件 / 导航 / Pagination" title="Pagination 分页" description="从 Table 提取的统一分页组件，支持每页条数、总记录数、首尾页切换与总数刷新。" name="Pagination" apiRows={[
    { property: "total", description: "数据总数", type: "number", defaultValue: "0" },
    { property: "current / pageSize", description: "当前页与每页条数", type: "number", defaultValue: "1 / 25" },
    { property: "pageSizeOptions", description: "每页条数候选项", type: "number[]", defaultValue: "10, 25, 50 ... 5000" },
    { property: "showSizeChanger / showTotal", description: "显示每页条数和总记录数", type: "boolean", defaultValue: "true" },
    { property: "onRefreshTotal / refreshing", description: "刷新总数的回调与加载状态", type: "() => void | Promise<void> / boolean", defaultValue: "-" },
    { property: "onChange", description: "页码或每页条数变化", type: "(page, pageSize) => void", defaultValue: "-" },
  ]}>
    <DemoCard title="基础分页" description={`当前第 ${page} 页，每页 ${pageSize} 条；与 Table 分页使用同一份实现。`} code={paginationCode}>
      <Pagination current={page} pageSize={pageSize} onChange={(nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} total={286} />
    </DemoCard>
    <DemoCard title="自定义总数展示" description="可以隐藏每页条数，并自定义总数与当前范围。" code={`<Pagination total={100} showSizeChanger={false} showTotal={(total, range) => \`\${range[0]}-\${range[1]} / 共 \${total} 条\`} />`}>
      <Pagination total={100} showSizeChanger={false} showTotal={(total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`} />
    </DemoCard>
  </ComponentDocPage>;
}

const stepsCode = `import { Steps } from "@sia-ui/react";

export default function Demo() {
  return <Steps current={1} items={[
    { title: "填写信息", description: "录入项目资料" },
    { title: "配置权限", description: "选择成员权限" },
    { title: "完成创建", description: "检查并提交" },
  ]} />;
}`;
export function StepsPage() {
  const [current, setCurrent] = useState(1);
  return <ComponentDocPage eyebrow="组件 / 导航 / Steps" title="Steps 步骤条" description="展示任务流程和当前进度，支持横向、纵向、点状与可点击导航。" name="Steps" apiRows={[
    { property: "items", description: "步骤标题、说明、状态和图标", type: "StepItem[]", defaultValue: "[]" },
    { property: "current", description: "当前步骤索引", type: "number", defaultValue: "0" },
    { property: "direction", description: "排列方向", type: "horizontal | vertical", defaultValue: "horizontal" },
    { property: "type / progressDot", description: "导航或点状形态", type: "default | navigation | dot / boolean", defaultValue: "default" },
    { property: "onChange", description: "点击步骤时触发", type: "(current) => void", defaultValue: "-" },
  ]}>
    <DemoCard title="可切换步骤" description={`当前步骤：${current + 1}`} code={stepsCode}>
      <Steps current={current} onChange={setCurrent} items={[
        { title: "填写信息", description: "录入项目资料" }, { title: "配置权限", description: "选择成员权限" }, { title: "完成创建", description: "检查并提交" },
      ]} />
    </DemoCard>
    <DemoCard title="点状进度" description="弱化序号，强调流程节点。" code={`<Steps current={2} progressDot items={items} />`}><Steps current={2} progressDot items={[{ title: "创建" }, { title: "审核" }, { title: "发布" }]} /></DemoCard>
  </ComponentDocPage>;
}

const segmentedCode = `import { Icon, Segmented } from "@sia-ui/react";

export default function Demo() {
  return <Segmented block options={[
    { label: "列表", value: "list", icon: <Icon name="menu" /> },
    { label: "看板", value: "board", icon: <Icon name="component" /> },
    { label: "日历", value: "calendar", icon: <Icon name="calendar" /> },
  ]} />;
}`;
export function SegmentedPage() {
  const [value, setValue] = useState<SegmentedValue>("list");
  return <ComponentDocPage eyebrow="组件 / 数据展示 / Segmented" title="Segmented 分段控制器" description="在少量互斥选项之间即时切换视图或状态。" name="Segmented" apiRows={[
    { property: "options", description: "文本、数值或带图标选项", type: "SegmentedOption[]", defaultValue: "[]" },
    { property: "value / defaultValue", description: "受控值或默认值", type: "string | number", defaultValue: "首项" },
    { property: "block / vertical", description: "撑满容器或纵向排列", type: "boolean", defaultValue: "false" },
    { property: "size / disabled", description: "尺寸与禁用状态", type: "small | medium | large / boolean", defaultValue: "medium / false" },
  ]}>
    <DemoCard title="图标与块级模式" description={`当前视图：${value}`} code={segmentedCode}>
      <Space direction="vertical" style={{ width: "100%" }}><Segmented value={value} onChange={setValue} block options={[
        { label: "列表", value: "list", icon: <Icon name="menu" /> }, { label: "看板", value: "board", icon: <Icon name="component" /> }, { label: "日历", value: "calendar", icon: <Icon name="calendar" /> },
      ]} /></Space>
    </DemoCard>
  </ComponentDocPage>;
}
