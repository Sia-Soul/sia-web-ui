import { useState } from "react";
import {
  Button, Cascader, Checkbox, ColorPicker, DatePicker, Form, Icon, Input,
  InputNumber, InputSelect, Pagination, Radio, Rate, Segmented, Select,
  SelectDateRange, Space, Switch, TextArea, TimePicker, TreeSelect,
} from "@sia.soul/sia-react-ui";
import type { ControlSize } from "@sia.soul/sia-react-ui";

const options = [{ value: "design", label: "设计" }, { value: "develop", label: "研发" }];
const heights = { small: 22, medium: 30, large: 38 };

export function FormSizeDemo() {
  const [size, setSize] = useState<ControlSize>("medium");
  const [floating, setFloating] = useState(false);
  return <Space direction="vertical" size={16} style={{ width: "100%" }}>
    <Space wrap>
      <Segmented aria-label="表单尺寸" value={size} onChange={(next) => setSize(next as ControlSize)} options={[
        { value: "small", label: "small · 22px" },
        { value: "medium", label: "medium · 30px" },
        { value: "large", label: "large · 38px" },
      ]} />
      <Checkbox checked={floating} onChange={setFloating}>浮动占位符</Checkbox>
    </Space>
    <Form className="form-size-demo" size={size} layout="vertical" placeholderMode={floating ? "floating" : "default"}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 310px), 1fr))", gap: "0 24px" }}>
        <Form.Item label="Input 文本输入"><div data-size-control="input"><Input placeholder="输入内容" allowClear /></div></Form.Item>
        <Form.Item label="InputNumber 数字输入"><div data-size-control="number"><InputNumber placeholder="数量" defaultValue={10} /></div></Form.Item>
        <Form.Item label="InputSelect 输入选择"><div data-size-control="input-select"><InputSelect options={options} placeholder="选择部门" /></div></Form.Item>
        <Form.Item label="Select 下拉选择"><div data-size-control="select"><Select options={options} placeholder="选择部门" /></div></Form.Item>
        <Form.Item label="Select 多选"><div data-size-control="multiple-select"><Select mode="multiple" options={options} defaultValue={["design", "develop"]} placeholder="选择多个部门" /></div></Form.Item>
        <Form.Item label="TreeSelect 树选择"><div data-size-control="tree"><TreeSelect treeData={[{ value: "root", title: "全部部门", children: options.map(item => ({ value: item.value, title: item.label })) }]} treeCheckable defaultValue={["design", "develop"]} placeholder="选择部门树" /></div></Form.Item>
        <Form.Item label="Cascader 级联选择"><div data-size-control="cascader"><Cascader options={[{ value: "company", label: "公司", children: options }]} placeholder="选择组织" /></div></Form.Item>
        <Form.Item label="Cascader 级联多选"><div data-size-control="multiple-cascader"><Cascader multiple options={[{ value: "company", label: "公司", children: options }]} defaultValue={[["company", "design"], ["company", "develop"]]} placeholder="选择多个组织" /></div></Form.Item>
        <Form.Item label="DatePicker 日期"><div data-size-control="date"><DatePicker placeholder="选择日期" /></div></Form.Item>
        <Form.Item label="DatePicker.RangePicker 日期范围"><div data-size-control="date-range"><DatePicker.RangePicker /></div></Form.Item>
        <Form.Item label="TimePicker 时间"><div data-size-control="time"><TimePicker placeholder="选择时间" /></div></Form.Item>
        <Form.Item label="TimePicker.RangePicker 时间范围"><div data-size-control="time-range"><TimePicker.RangePicker /></div></Form.Item>
        <Form.Item label="SelectDateRange 组合范围"><div data-size-control="select-date-range"><SelectDateRange options={[{ value: "created", label: "创建时间" }]} selectWidth={100} /></div></Form.Item>
        <Form.Item label="Checkbox 多选框"><div data-size-control="checkbox"><Checkbox.Group options={options} defaultValue={["design"]} /></div></Form.Item>
        <Form.Item label="Radio 单选框"><div data-size-control="radio"><Radio.Group options={options} defaultValue="design" /></div></Form.Item>
        <Form.Item label="Radio 按钮组"><div data-size-control="radio-button"><Radio.Group optionType="button" options={options} defaultValue="design" /></div></Form.Item>
        <Form.Item label="Switch 开关"><div data-size-control="switch"><Switch label="启用" defaultChecked /></div></Form.Item>
        <Form.Item label="Switch 文字开关"><div data-size-control="switch-text"><Switch checkedContent="开启" uncheckedContent="关闭" /></div></Form.Item>
        <Form.Item label="Switch 分段开关"><div data-size-control="switch-segmented"><Switch variant="segmented" checkedContent="开启" uncheckedContent="关闭" /></div></Form.Item>
        <Form.Item label="ColorPicker 颜色"><div data-size-control="color"><ColorPicker showText /></div></Form.Item>
        <Form.Item label="Segmented 分段选择"><div data-size-control="segmented"><Segmented options={["日", "周", "月"]} defaultValue="周" /></div></Form.Item>
        <Form.Item label="Rate 评分"><div data-size-control="rate"><Rate defaultValue={3} /></div></Form.Item>
        <Form.Item label="TextArea 多行输入"><div data-size-control="textarea"><TextArea placeholder="多行高度由 rows 和内容决定，size 调整字号与内边距" rows={2} /></div></Form.Item>
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <span data-size-control="button"><Button variant="primary" icon={<Icon name="check" />}>继承 Form：{heights[size]}px</Button></span>
        <span data-size-control="override-button"><Button size="small">独立指定 small：22px</Button></span>
      </Space>
      <Space wrap style={{ marginBottom: 16 }}>
        <span data-size-control="override-input"><Input size="large" placeholder="独立指定 large：38px" /></span>
        <span data-size-control="override-checkbox"><Checkbox.Group size="large"><Checkbox value="large">组内 large</Checkbox><Checkbox value="small" size="small">单项 small</Checkbox></Checkbox.Group></span>
        <span data-size-control="override-radio"><Radio.Group size="large" defaultValue="large"><Radio value="large">组内 large</Radio><Radio value="small" size="small">单项 small</Radio></Radio.Group></span>
      </Space>
      <div data-size-control="pagination"><Pagination total={125} defaultPageSize={25} /></div>
    </Form>
  </Space>;
}
