import { Form, Input, QueryForm, Select, Space } from "@sia.soul/sia-react-ui";

/** 演示组合查询条件的默认四六比例；noStyle 绑定两个独立字段且不增加布局包装。 */
export function QueryFormCompactInputDemo() {
  return <QueryForm initialValues={{ matchMode: "exact" }} onSearch={() => undefined} fields={[
    { key: "product", width: "100%", children: <Space.Compact block>
      <Form.Item name="matchMode" noStyle>
        <Select placeholder="匹配模式" options={[
          { label: "精确查询", value: "exact" },
          { label: "模糊查询", value: "contains" },
        ]} />
      </Form.Item>
      <Form.Item name="productCode" noStyle><Input placeholder="商品编码" allowClear /></Form.Item>
    </Space.Compact> },
  ]} />;
}
