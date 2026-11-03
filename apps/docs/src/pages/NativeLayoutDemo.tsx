import { useState } from "react";
import { AutoSizer, Button, Card, Checkbox, FloatingPanel, Input, Popover, Progress, SortableList, Space, type SortableKey } from "@sia.soul/sia-react-ui";

/** 用真实控件验证框架接管尺寸、任务浮层与排序后，输入及业务受控状态仍独立。 */
export function NativeLayoutDemo() {
  const [items, setItems] = useState<SortableKey[]>(["甲", "乙", "丙"]);
  const [disabled, setDisabled] = useState(false);
  const [vertical, setVertical] = useState(false);
  const [customHandle, setCustomHandle] = useState(false);
  const [open, setOpen] = useState(false);
  // 通过真实布局变化验证尺寸观察，而不是手工触发组件内部回调。
  const [wide, setWide] = useState(false);
  return <Space direction="vertical">
    <Space><Checkbox checked={disabled} onChange={setDisabled}>禁用排序</Checkbox>
      <Checkbox checked={vertical} onChange={setVertical}>纵向排序</Checkbox>
      <Checkbox checked={customHandle} onChange={setCustomHandle}>标题拖动</Checkbox>
      <Button onClick={() => setWide(value => !value)}>切换测量宽度</Button>
      <Button onClick={() => setOpen(value => !value)}>切换任务浮层</Button>
      <Popover contentSize="wide" title="宽内容预览" content="气泡使用框架宽内容预设，窄视口保持安全边距。"><Button>查看宽内容</Button></Popover>
    </Space>
    <div role="status" aria-label="当前顺序">{items.join("、")}</div>
    {/* 手柄拖动实时预览并平滑让位，松手后才提交顺序；Esc 取消，输入草稿保持。 */}
    <SortableList items={items} onOrderChange={setItems} disabled={disabled} direction={vertical ? "vertical" : "horizontal"} handlePlacement={customHandle ? "custom" : "before"} handleContent={customHandle ? key => `项目 ${key}` : undefined} renderItem={(key, _, handle) => <Card title={customHandle ? handle : `项目 ${key}`}><Input aria-label={`项目 ${key} 输入`} defaultValue={String(key)} /></Card>} />
    {/* 示例外层明确尺寸；框架监听缩放，子内容不反向撑高容器。 */}
    <div style={{ width: wide ? 480 : 360, height: 120 }}><AutoSizer>{size => <output aria-label="实测尺寸">{Math.round(size.width)} × {Math.round(size.height)}</output>}</AutoSizer></div>
    <FloatingPanel open={open} title="任务进度" placement="bottomRight"><Progress percent={45} /></FloatingPanel>
  </Space>;
}
