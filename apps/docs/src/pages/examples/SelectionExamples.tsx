import { useState } from "react";
import { Button, Cascader, ColorPicker, Input, InputNumber, InputSelect, NumberRange, SelectionPanel, Select, Space, Switch, TextArea, TreeSelect, Typography } from "@sia.soul/sia-react-ui";
import type { CascaderOption, ColorPickerMode, SelectionValue, TreeSelectValue } from "@sia.soul/sia-react-ui";

/** 选择组件补充样例：受控回填、搜索、懒加载与自定义入口。 */
export function SelectionExamples() {
  const [values, setValues] = useState<SelectionValue[]>(["a", "custom"]);
  const [input, setInput] = useState<SelectionValue | SelectionValue[] | undefined>(["a"]);
  const [search, setSearch] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [event, setEvent] = useState("等待操作");
  const [treeOpen, setTreeOpen] = useState(false);
  const [expanded, setExpanded] = useState<TreeSelectValue[]>(["root"]);
  const [mode, setMode] = useState<ColorPickerMode>("solid");
  const [cascades, setCascades] = useState<CascaderOption[]>([{ value: "root", label: "点击加载下级", isLeaf: false }]);
  const options = [{ value: "a", label: "北京", group: "华北", description: "城市 A" }, { value: "b", label: "天津", group: "华北" }, { value: "c", label: "停用城市", disabled: true, disabledTip: "当前不可用" }];
  const tree = [{ value: "root", title: "区域", children: [{ value: "a", title: "北京" }, { value: "b", title: "天津" }] }];
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Space><Switch checked={disabled} onCheckedChange={setDisabled} label="禁用" /><Switch checked={loading} onCheckedChange={setLoading} label="加载" /><Switch checked={selectedOnly} onCheckedChange={setSelectedOnly} label="只看已选" /></Space>
    <SelectionPanel options={options} value={values} onChange={setValues} multiple groupCheckable allowDeselect disabled={disabled} loading={loading} showSearch showActions includeUnknownValues searchValue={search} onSearch={setSearch} selectedOnly={selectedOnly} showValue displayField="label" columns={2} maxHeight={180} autoFocusSearch={false} />
    <InputSelect options={options} value={input} onChange={setInput} multiple displayField="value" showValue placeholder="输入逗号分隔编码" placeholderMode="floating" size="large" status="warning" disabled={disabled} loading={loading} allowClear hideSearch={false} inputMaxLength={40} parseInput={text => text.split(/[,，]/).map(value => value.trim()).filter(Boolean)} enableModal={{ title: "选择城市", width: 620, columns: 2, maxHeight: 240 }} suffix={<Typography.Text>编码</Typography.Text>} style={{ width: 340 }} className="property-input-select" id="property-cities" aria-required onOpenChange={next => setEvent(`输入选择打开：${next}`)} />
    <InputSelect options={options} defaultValue="b" placeholder="非受控初始值" />
    {/* 表单空字符串不生成自定义项；业务明确声明的空值选项仍按其名称显示。 */}
    <InputSelect options={options} defaultValue="" placeholder="空值不会生成空白选项" />
    <InputSelect options={[{ value: "", label: "全部城市" }, ...options]} defaultValue="" placeholder="显式空值选项" />
    <Cascader options={cascades} size="large" changeOnSelect expandTrigger="click" placeholderMode="floating" placeholder="懒加载级联" disabled={disabled} fieldNames={{ label: "label", value: "value", children: "children" }} displayRender={labels => labels.join(" → ")} loadData={async () => { await new Promise(resolve => setTimeout(resolve, 400)); setCascades([{ value: "root", label: "已加载区域", children: [{ value: "city", label: "示例城市" }] }]); }} />
    <TreeSelect treeData={tree} multiple treeCheckable placeholder="受控树选择" placeholderMode="floating" searchPlaceholder="按名称筛选" maxTagCount={1} disabled={disabled} size="large" status="warning" open={treeOpen} onDropdownVisibleChange={setTreeOpen} searchValue={search} onSearch={setSearch} treeExpandedKeys={expanded} onTreeExpand={setExpanded} filterTreeNode={(text, node) => String(node.title).includes(text)} treeCheckStrictly showCheckedStrategy="all" loading={loading} listHeight={180} popupClassName="property-tree-popup" popupStyle={{ minWidth: 320 }} dropdownFooter={<Typography.Text>支持搜索与清空</Typography.Text>} displayRender={nodes => nodes.map(node => node.title).join(" / ")} onClear={() => setEvent("清空树选择")} onSelect={value => setEvent(`选中 ${value}`)} onDeselect={value => setEvent(`取消 ${value}`)} />
    <TreeSelect treeData={tree} defaultOpen={false} treeDefaultExpandedKeys={["root"]} renderTrigger={({ toggle, clear }) => <Space><Button onClick={toggle}>自定义树入口</Button><Button onClick={clear}>清空</Button></Space>} />
    <ColorPicker size="large" defaultValue="#0e7490" mode={mode} modes={["solid", "gradient"]} onModeChange={setMode} disabled={disabled} allowClear onChangeComplete={color => setEvent(`颜色确认：${color}`)} onClear={() => setEvent("颜色已清空")} />
    <ColorPicker defaultMode="gradient" defaultValue="linear-gradient(90deg, #0e7490 0%, #16a34a 100%)" />
    <Select options={Array.from({ length: 200 }, (_, i) => ({ value: i, label: `项目 ${i}` }))} showSearch onSearch={text => setEvent(`搜索 ${text}`)} filterOption={(text, option) => String(option.label).includes(text)} virtual listHeight={180} optionHeight={36} />
    <Input placeholder="输入后点击清空" suffix="关键词" onClear={() => setEvent("输入框清空")} />
    <TextArea size="large" placeholderMode="floating" placeholder="浮动标签多行文本" />
    <InputNumber status="warning" defaultValue={10} />
    <NumberRange inputLabels={["最低数量", "最高数量"]} min={0} max={100} step={5} allowClear={false} defaultValue={[10, 50]} />
    <Typography.Text role="status">{event}；选中编码：{values.join(", ")}</Typography.Text>
  </Space>;
}
