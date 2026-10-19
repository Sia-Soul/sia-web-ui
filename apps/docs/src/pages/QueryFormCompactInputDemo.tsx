import { DatePicker, Form, Input, QueryForm, Select, Space } from "@sia.soul/sia-react-ui";

/** 演示组合查询条件的默认四六比例；noStyle 绑定两个独立字段且不增加布局包装。 */
export function QueryFormCompactInputDemo() {
  return <QueryForm initialValues={{ matchMode: "exact", dateType: "created" }} onSearch={() => undefined} fields={[
    { key: "product", width: "100%", children: <Space.Compact block>
      <Form.Item name="matchMode" noStyle>
        <Select placeholderMode="default" placeholder="匹配模式" options={[
          { label: "精确查询", value: "exact" },
          { label: "模糊查询", value: "contains" },
        ]} />
      </Form.Item>
      <Form.Item name="productCode" noStyle><Input placeholder="商品编码" allowClear /></Form.Item>
    </Space.Compact> },
    // 日期区间与类型选择共享宽度；类型提示保持普通模式，不叠加浮动标签。
    { key: "dateRange", children: <Space.Compact block>
      <Form.Item name="dateType" noStyle><Select placeholderMode="default" placeholder="日期类型" options={[
        { label: "创建时间", value: "created" }, { label: "修改时间", value: "modified" },
      ]} /></Form.Item>
      <Form.Item name="dates" noStyle><DatePicker.RangePicker showTime placeholder={["开始时间", "结束时间"]} /></Form.Item>
    </Space.Compact> },
  ]} />;
}
