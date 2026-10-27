import { useState } from "react";
import { Button, Card, Col, Flex, Icon, Row, Segmented, Space, Splitter, Steps, Toolbar, Typography, Badge, Tabs, Tag, Switch, ThemeSwitch } from "@sia.soul/sia-react-ui";

/** 基础组件补充样例：切换禁用、折叠和选项后可直接观察结果。 */
export function BasicExamples() {
  const [disabled, setDisabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [event, setEvent] = useState("等待操作");
  const [text, setText] = useState("可编辑的说明文字");
  const [dark, setDark] = useState(false);
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Switch size="small" checked={disabled} onCheckedChange={setDisabled} label="禁用样例" />
    <ThemeSwitch checked={dark} onCheckedChange={next => { setDark(next); setEvent(`主题切换回调：${next ? "暗色" : "亮色"}`); }} lightLabel="选择亮色" darkLabel="选择暗色" />
    <Button block variant="filled" disabled={disabled} onClick={() => setEvent("点击整行按钮")}>填充样式与整行按钮</Button>
    <div style={{ width: 210 }}><Toolbar items={[
      { key: "save", label: "保存", icon: <Icon name="check" /> },
      { key: "export", label: "导出", split: true, children: [{ key: "csv", label: "CSV" }] },
      { key: "remove", label: "删除", danger: true },
      { key: "locked", label: "无权限", disabled: true },
    ]} onAction={setEvent} disabled={disabled} size="medium" variant="default" overflowLabel="收纳的操作" /></div>
    <Icon name="refresh" strokeWidth={1} pulse label="正在同步" />
    {/* 普通选择指针适合桌面式卡片，折叠按钮仍可点击和键盘操作。 */}
    <Card title="受控折叠卡片" interactionCursor="default" extra={<Tag>附加内容</Tag>} disabled={disabled} accentColor="#0e7490" collapsible collapsed={collapsed} onCollapsedChange={setCollapsed} bodyStyle={{ padding: 20 }}>正文内边距为 20px；悬停标题保持普通指针</Card>
    <Card title="默认收起" collapsible defaultCollapsed>展开后看到正文</Card>
    <Row align="middle" justify="space-around" wrap gutter={12}>
      <Col span={8} sm={10} xl={8} xxl={6} offset={1} order={2} push={1} pull={0} flex="1 1 180px"><Card>响应式列：改变窗口宽度观察列宽</Card></Col>
      <Col span={8}><Card>对照列</Card></Col>
    </Row>
    <Flex orientation="vertical" flex="1 1 auto" component="section" gap={8}><Button>纵向第一项</Button><Button>纵向第二项</Button></Flex>
    <Space.Compact direction="vertical"><Button>上一项</Button><Button>下一项</Button></Space.Compact>
    <Splitter orientation="vertical" style={{ height: 220 }} onResizeEnd={sizes => setEvent(`分区尺寸：${sizes.join(", ")}`)}>
      <Splitter.Panel defaultSize={100} min={40} max={160} collapsible defaultCollapsed collapsedSize={32} collapsedContent="已收起" collapsedAriaLabel="展开上方分区" resizable>拖动分隔线调整高度</Splitter.Panel>
      <Splitter.Panel>下方内容</Splitter.Panel>
    </Splitter>
    <Segmented options={["日", "周", "月"]} vertical disabled={disabled} />
    <Steps initial={1} current={2} direction="vertical" type="navigation" size="small" status="error" items={[{ title: "创建" }, { title: "处理" }, { title: "完成" }]} />
    <Badge count={0} showZero overflowCount={9} color="#0e7490" offset={[6, 2]}><Button>零计数</Button></Badge>
    <Badge.Ribbon text="左侧缎带" color="#0e7490" placement="start"><Card>自定义缎带颜色</Card></Badge.Ribbon>
    <Tabs size="small" orientation="vertical" centered items={[{ key: "a", label: "项目 A", children: "右键标签可操作" }, { key: "b", label: "项目 B", children: "第二个面板" }]}
      onAfterChange={key => setEvent(`切换完成：${key}`)} tabContextMenu={[{ key: "inspect", label: "查看标签" }]} onTabContextMenuClick={info => setEvent(`标签 ${info.tabKey}：${info.key}`)} />
    {/* 同一组文字属性分别用于标题、文本和段落，编辑回调更新真实内容。 */}
    <Typography.Title level={4} type="secondary" disabled={disabled} strong italic underline delete={false} mark code={false} keyboard={false} copyable editable={{ onChange: setText }} ellipsis>{text}</Typography.Title>
    <Typography.Text type="success" disabled={disabled} strong italic underline delete={false} mark code keyboard={false} copyable editable={{ onChange: setText }} ellipsis>{text}</Typography.Text>
    <Typography.Paragraph disabled={disabled} strong italic underline delete={false} mark={false} code={false} keyboard copyable editable={{ onChange: setText }} ellipsis>{text}</Typography.Paragraph>
    <Typography.Link href="#" disabled={disabled}>可禁用链接</Typography.Link>
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
