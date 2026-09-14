import { Button, Cascader, DatePicker, Form, Input, InputNumber, InputSelect, MarkdownEditor, RichTextEditor, Select, SelectDateRange, Space, TextArea, TimePicker, TreeSelect } from "@sia.soul/sia-react-ui";

const options = [{ label: "订单", value: "order" }, { label: "采购退货", value: "return" }];
const treeData = [{ title: "业务中心", value: "business", children: options.map(item => ({ title: item.label, value: item.value })) }];
const cascaderOptions = [{ label: "业务中心", value: "business", children: options }];

export function FloatingPlaceholderDemo() {
  const [form] = Form.useForm();
  return <Form form={form} layout="vertical" placeholderMode="floating" className="floating-placeholder-demo">
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "12px 24px", paddingTop: 12 }}>
      <Form.Item name="name"><Input placeholder="姓名" aria-label="浮动姓名" allowClear /></Form.Item>
      <Form.Item name="password"><Input type="password" placeholder="密码" aria-label="浮动密码" /></Form.Item>
      <Form.Item name="quantity"><InputNumber placeholder="数量（支持 0）" aria-label="浮动数量" /></Form.Item>
      <Form.Item name="select"><Select options={options} placeholder="业务类型" aria-label="浮动业务类型" allowClear /></Form.Item>
      <Form.Item name="multiple"><Select options={options} mode="multiple" placeholder="同步范围" aria-label="浮动同步范围" allowClear /></Form.Item>
      <Form.Item name="tree"><TreeSelect treeData={treeData} placeholder="业务部门" aria-label="浮动业务部门" allowClear showSearch /></Form.Item>
      <Form.Item name="cascader"><Cascader options={cascaderOptions} placeholder="业务路径" aria-label="浮动业务路径" allowClear /></Form.Item>
      <Form.Item name="inputSelect"><InputSelect options={options} placeholder="输入选择" aria-label="浮动输入选择" /></Form.Item>
      <Form.Item name="date"><DatePicker placeholder="单据日期" aria-label="浮动单据日期" /></Form.Item>
      <Form.Item name="dateRange"><DatePicker.RangePicker placeholder={["开始日期", "结束日期"]} aria-label="浮动日期范围" /></Form.Item>
      <Form.Item name="time"><TimePicker placeholder="开始时间" aria-label="浮动开始时间" /></Form.Item>
      <Form.Item name="timeRange"><TimePicker.RangePicker placeholder={["上班时间", "下班时间"]} aria-label="浮动时间范围" /></Form.Item>
      <Form.Item name="normal"><Input placeholder="单独保留普通占位符" placeholderMode="default" aria-label="普通占位符" /></Form.Item>
      <Form.Item><Input placeholder="禁用状态" value="已停用" disabled /></Form.Item>
    </div>
    <Form.Item name="combined"><SelectDateRange options={options} selectPlaceholder="日期类型" rangePlaceholder={["统计开始", "统计结束"]} /></Form.Item>
    <Form.Item name="notes"><TextArea placeholder="备注" aria-label="浮动备注" showCount maxLength={200} /></Form.Item>
    <Form.Item name="rich"><RichTextEditor placeholder="详细说明" aria-label="浮动详细说明" /></Form.Item>
    <Form.Item name="markdown"><MarkdownEditor placeholder="Markdown 正文" ariaLabel="浮动 Markdown 正文" minHeight={220} /></Form.Item>
    <Space wrap>
      <Button onClick={() => form.setFieldsValue({ name: "张三", password: "123456", quantity: 0, select: "order", multiple: ["order", "return"], tree: "order", cascader: ["business", "order"], inputSelect: "order", date: "2026-09-14", dateRange: ["2026-09-14", "2026-09-20"], time: "09:00", timeRange: ["09:00", "18:00"], combined: { select: "order", range: ["2026-09-14", "2026-09-20"] }, notes: "检查聚焦、清空和重置后的标签位置。", rich: "<p>已填写说明</p>", markdown: "已填写正文" })}>填入示例值</Button>
      <Button onClick={() => form.resetFields()}>清空并重置</Button>
    </Space>
  </Form>;
}
