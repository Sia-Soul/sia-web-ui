import { useState } from "react";
import { Button, Dropdown, Menu, Pagination, Space, Switch, Typography } from "@sia.soul/sia-react-ui";

/** 展示菜单受控选择、下拉浮层定制以及分页事件。 */
export function NavigationExamples() {
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>(["group"]);
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [event, setEvent] = useState("等待操作");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const [gridKey, setGridKey] = useState("entry-0");
  const menu = { items: [{ key: "edit", label: "编辑" }, { key: "copy", label: "复制" }], onClick: ({ key }: { key: string }) => setEvent(key) };
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Switch checked={disabled} onCheckedChange={setDisabled} label="禁用操作" />
    {/* 确定高度制造菜单内部滚动；外部选择末项时只滚动此菜单。 */}
    <Space><Button onClick={() => setGridKey("entry-0")}>定位首项</Button><Button onClick={() => setGridKey("entry-29")}>定位末项</Button></Space>
    <Menu aria-label="自动定位网格菜单" mode="grid" gridColumns={3} interactionCursor="default" autoScrollSelected
      style={{ height: 180, overflowY: "auto", width: 360 }} selectedKeys={[gridKey]}
      items={Array.from({ length: 30 }, (_, index) => ({ key: `entry-${index}`, label: `应用 ${index + 1}` }))}
      onSelect={({ key }) => { setGridKey(key); setEvent(`网格选中：${key}`); }} />
    <Menu items={[{ key: "group", label: "文档", children: menu.items }]} mode="inline" theme="dark" selectedKeys={selected} openKeys={expanded} multiple selectable inlineCollapsed={disabled} inlineIndent={28} triggerSubMenuAction="click"
      onClick={info => setEvent(`点击 ${info.key}`)} onSelect={info => setSelected(info.selectedKeys)} onDeselect={info => setSelected(info.selectedKeys)} onOpenChange={setExpanded} />
    <Dropdown menu={menu} open={open} onOpenChange={(next, info) => { setOpen(next); setEvent(JSON.stringify(info)); }} disabled={disabled} showTriggerIcon={false} autoFocus openDelay={150} closeDelay={300} popupClassName="property-dropdown" popupStyle={{ minWidth: 240 }} popupRender={content => <div>{content}<Typography.Text>浮层附加说明</Typography.Text></div>}><Button>受控下拉</Button></Dropdown>
    <Dropdown menu={menu} defaultOpen={false}><Button>非受控下拉</Button></Dropdown>
    <Dropdown.Button menu={menu} placement="bottomRight" className="property-dropdown-button" autoFocus onOpenChange={next => setEvent(`分组下拉：${next}`)} trigger={["click"]} defaultOpen={false} showTriggerIcon arrow openDelay={100} closeDelay={200} popupClassName="property-popup" popupStyle={{ minWidth: 200 }} popupRender={content => <div>{content}<Typography.Text>主操作与菜单各自触发</Typography.Text></div>}>默认关闭</Dropdown.Button>
    <Dropdown.Button menu={menu} open={open} onOpenChange={setOpen}>共享受控打开状态</Dropdown.Button>
    <Pagination total={123} current={page} pageSize={size} onChange={(next, nextSize) => { setPage(next); setSize(nextSize); }} size="small" pageSizeOptions={[5, 10, 25]} disabled={disabled} hideOnSinglePage refreshing={refreshing}
      onRefreshTotal={async () => { setRefreshing(true); await new Promise(resolve => setTimeout(resolve, 600)); setRefreshing(false); setEvent("总数刷新完成"); }} onShowSizeChange={(next, nextSize) => setEvent(`页码 ${next}，每页 ${nextSize}`)} />
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
