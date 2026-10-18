import { useRef, useState } from "react";
import { Button, Carousel, Collapse, FloatButton, FloatingScrollbarProvider, Icon, Image, Input, Rate, Space, Switch, Timeline, ToolPanel, Tree, Treemap, Typography, WindowControls, WindowFrame, WindowTitleBar } from "@sia.soul/sia-react-ui";
import type { TreeKey, TreeNode } from "@sia.soul/sia-react-ui";

/** 展示默认值、展开与聚焦、拖放事件及局部滚动容器。 */
export function DisplayExamples() {
  const [event, setEvent] = useState("等待操作");
  const [disabled, setDisabled] = useState(false);
  const [expanded, setExpanded] = useState<TreeKey[]>(["root"]);
  const [focused, setFocused] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([{ key: "root", title: "按需加载", children: [{ key: "a", title: "拖动此节点" }, { key: "b", title: "目标节点" }] }]);
  const [loadingKeys, setLoadingKeys] = useState<TreeKey[]>([]);
  const scroll = useRef<HTMLDivElement>(null);
  const picture = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#0e7490"/><text x="30" y="50" fill="white">SiaWebUI</text></svg>');
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Switch checked={disabled} onCheckedChange={setDisabled} label="禁用评分" />
    <Rate size="large" count={7} allowClear disabled={disabled} onHoverChange={value => setEvent(`悬停评分 ${value}`)} />
    <Carousel autoplay autoplaySpeed={3500} dots={{ className: "property-dots" }} arrows effect="fade" infinite initialSlide={1} pauseOnHover beforeChange={(from, to) => setEvent(`切换 ${from} → ${to}`)} afterChange={index => setEvent(`停留在第 ${index + 1} 张`)} style={{ width: 360 }}><div style={{ height: 100 }}>第一页</div><div style={{ height: 100 }}>第二页</div></Carousel>
    <Collapse defaultActiveKey="a" bordered={false} destroyInactivePanel expandIconPosition="end" items={[{ key: "a", label: "关闭后销毁输入框", children: <Input placeholder="输入后折叠再展开观察重置" /> }]} />
    <Image src="data:image/png;base64,invalid" fallback={picture} placeholder="图片加载中" preview={{ src: picture }} rootClassName="property-image" alt="加载失败后展示本地后备图片" width={160} />
    <Timeline items={[{ children: "已创建" }, { children: "已审核" }]} pending="正在发布" pendingDot={<Icon name="refresh" spin />} reverse />
    <Tree treeData={nodes} defaultSelectedKeys={["a"]} expandedKeys={expanded} onExpand={setExpanded} defaultCheckedKeys={["a"]} loadingKeys={loadingKeys} checkable checkStrictly multiple selectable highlightSelectedAncestors indentSize={28} switcherWidth={28} stickyAncestors stickyRowHeight={32} virtual virtualThreshold={1} virtualItemHeight={32} draggable
      loadData={async node => { setLoadingKeys([node.key]); await new Promise(resolve => setTimeout(resolve, 300)); setLoadingKeys([]); setEvent(`加载完成：${node.key}`); }}
      onDrop={({ dragNode, node }) => { setNodes(current => current.map(root => ({ ...root, children: [...(root.children ?? [])].reverse() }))); setEvent(`拖动 ${dragNode.key} 到 ${node.key}，此例将子节点反序`); }} style={{ maxHeight: 180, overflow: "auto" }} />
    <Tree treeData={nodes} defaultExpandedKeys={["root"]} />
    <Treemap data={[{ key: "root", label: "项目", value: 78, children: Array.from({ length: 12 }, (_, i) => ({ key: `item-${i}`, label: `模块 ${i}`, value: i + 1 })) }]} defaultExpandedKeys={["root"]} focusedKey={focused} onFocusedChange={setFocused} gap={5} headerHeight={28} minLabelWidth={50} minLabelHeight={25} minTileWidth={35} minTileHeight={20} maxVisibleNodes={8} aggregateOverflow overflowLabel={count => `另 ${count} 项`} showValueInCompactTiles style={{ height: 220 }} />
    <Treemap data={[{ key: "a", label: "初始聚焦节点", value: 10 }]} defaultFocusedKey="a" style={{ height: 80 }} />
    <div ref={scroll} style={{ height: 150, overflow: "auto", position: "relative" }}><FloatingScrollbarProvider targetRef={scroll} disabled={disabled} /><div style={{ height: 450 }}>向下滚动测试返回顶部</div></div>
    <FloatButton.BackTop target={() => scroll.current} visibilityHeight={30} behavior="auto" icon={<Icon name="arrow-up" />} description="顶部" tooltip="返回局部容器顶部" type="primary" shape="square" badge={{ dot: true }} htmlType="button" style={{ position: "static" }} />
    <FloatButton.Group icon={<Icon name="plus" />} closeIcon={<Icon name="close" />} placement="right" defaultOpen={false} trigger="click" style={{ position: "static" }}><FloatButton htmlType="button" tooltip="示例操作" onClick={() => setEvent("浮动按钮操作")} /></FloatButton.Group>
    <ToolPanel title="可调尺寸工具面板" defaultOpen onResizeEnd={size => setEvent(`面板尺寸 ${size}px`)}><Typography.Text>拖动边缘后查看尺寸</Typography.Text></ToolPanel>
    <WindowFrame titleBar={<WindowTitleBar controls draggable={false} disabledActions={["close"]} controlLabels={{ minimize: "最小化示例", maximize: "最大化示例", close: "关闭示例" }}>内嵌窗口</WindowTitleBar>}><WindowControls maximized={disabled} showMinimize showMaximize showClose disabledActions={["close"]} labels={{ minimize: "最小化", maximize: "最大化", restore: "还原", close: "关闭" }} onAction={action => setEvent(`窗口操作 ${action}`)} /></WindowFrame>
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
