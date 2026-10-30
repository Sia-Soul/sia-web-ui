import { useState } from "react";
import { Cascader, DatePicker, Form, Input, InputNumber, NumberRange, Select, Space, Switch, TextArea, TimePicker, TreeSelect } from "@sia.soul/sia-react-ui";

/** 对照直接禁用与 Form 继承禁用的背景、边框及浮动标签，切换主题可检查亮暗配色。 */
export function DisabledControlsDemo() {
  const [disabled, setDisabled] = useState(true);
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Switch checked={disabled} onCheckedChange={setDisabled} label="禁用控件" />
    <div className="disabled-controls-demo" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
      <Input disabled={disabled} defaultValue="商品名称" placeholder="名称" />
      <Input disabled={disabled} defaultValue="SP001" placeholder="商品编码" placeholderMode="floating" />
      <InputNumber disabled={disabled} defaultValue={100} placeholder="价格" />
      <Select disabled={disabled} defaultValue="a" options={[{ label: "品牌 A", value: "a" }]} />
      <DatePicker disabled={disabled} defaultValue="2026-10-30" />
      <TimePicker disabled={disabled} defaultValue="09:30" />
      <TreeSelect disabled={disabled} style={{ width: "100%" }} treeData={[{ key: "a", value: "a", title: "商品分类" }]} defaultValue="a" />
      <Cascader disabled={disabled} style={{ width: "100%" }} options={[{ value: "a", label: "服饰", children: [{ value: "b", label: "上衣" }] }]} defaultValue={["a", "b"]} />
      <NumberRange disabled={disabled} defaultValue={[10, 100]} />
      {/* 区间控件包含两层禁用容器，同样不应叠加透明度。 */}
      <TimePicker.RangePicker disabled={disabled} defaultValue={["09:00", "18:00"]} />
      <TextArea disabled={disabled} defaultValue="商品备注" rows={2} />
    </div>
    {/* 原生 fieldset 禁用同样使用柔和边框，浮动标签底色应与输入框连贯。 */}
    <Form disabled={disabled} layout="vertical">
      <Form.Item label="通过 Form 继承禁用"><Input defaultValue="继承禁用状态" placeholder="名称" placeholderMode="floating" /></Form.Item>
    </Form>
  </Space>;
}
