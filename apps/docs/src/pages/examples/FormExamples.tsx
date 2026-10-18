import { useRef, useState } from "react";
import { Button, Checkbox, Form, Input, QueryForm, Radio, Slider, Space, Switch, Table, Typography } from "@sia.soul/sia-react-ui";
import type { TableRef } from "@sia.soul/sia-react-ui";

/** 表单依赖更新、动态列表、查询状态和表格事件的完整交互样例。 */
export function FormExamples() {
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [event, setEvent] = useState("等待操作");
  const table = useRef<TableRef<{ id: number; name: string }>>(null);
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Space><Switch checked={disabled} onCheckedChange={setDisabled} label="禁用" /><Switch checked={loading} onCheckedChange={setLoading} label="加载" /></Space>
    <Form disabled={disabled} requiredMark="optional" onValuesChange={(changed, all) => setEvent(JSON.stringify({ changed, all }))} initialValues={{ contacts: [{ name: "张三" }] }}>
      <Form.Item name="name" label="名称" required extra="失焦校验" help="请输入两个以上字符" validateStatus="warning" trigger="onChange" validateTrigger="onBlur" getValueFromEvent={event => (event as React.ChangeEvent<HTMLInputElement>).target.value.trim()} rules={[{ min: 2, message: "至少两个字符" }]} className="property-form-item"><Input /></Form.Item>
      <Form.Item dependencies={["name"]} shouldUpdate={(before, after) => before.name !== after.name}>{form => <Typography.Text>名称预览：{String(form.getFieldValue("name") ?? "")}</Typography.Text>}</Form.Item>
      <Form.List name="contacts">{(fields, { add, remove }) => <Space direction="vertical">{fields.map(field => <Space key={field.key}><Form.Item name={[field.name, "name"]} label="联系人"><Input /></Form.Item><Button onClick={() => remove(field.name)}>移除</Button></Space>)}<Button onClick={() => add({ name: "新联系人" })}>添加联系人</Button></Space>}</Form.List>
      <Form.ErrorList errors={["示例：联系人不能为空"]} />
    </Form>
    <Checkbox.Group options={["阅读", "编辑"]} disabled={disabled} name="permissions" className="property-checkbox-group" />
    <Radio value="one" button onChange={e => setEvent(`Radio 选中：${e}`)}>按钮外观</Radio>
    <Radio.Button size="large" value="two" onChange={e => setEvent(`Radio.Button 选中：${e}`)}>独立按钮单选</Radio.Button>
    <Radio.Group name="property-radio" className="property-radio-group" options={["日", "周"]} />
    <div style={{ height: 130 }}><Slider disabled={disabled} reverse vertical defaultValue={30} onChangeComplete={value => setEvent(`滑动结束：${value}`)} /></div>
    <QueryForm loading={loading} collapsed={collapsed} onCollapsedChange={setCollapsed} collapsedCount={1} shortcutsLoading={loading} disabled={disabled} size="large" placeholderMode="floating" layout="vertical" requiredMark searchText="筛选" resetText="清除条件" saveText="保存方案" resetSearch={false} actionsExtra={<Button onClick={() => setEvent("导出当前结果")}>导出</Button>}
      fields={[{ key: "name", name: "name", label: "名称", children: <Input /> }, { key: "code", name: "code", label: "编码", children: <Input /> }]}
      onSearch={async values => { if (values.name === "error") throw new Error("输入 error 演示失败"); setEvent(`查询：${JSON.stringify(values)}`); }} onSaveQuery={query => setEvent(`保存方案：${query.name}`)} onError={(error, operation) => setEvent(`${operation} 失败：${String(error)}`)} onFinishFailed={info => setEvent(`校验失败 ${info.errorFields.length} 项`)} onValuesChange={changed => setEvent(`条件变更：${JSON.stringify(changed)}`)} />
    <QueryForm defaultCollapsed={false} fields={[{ key: "keyword", name: "keyword", children: <Input placeholder="默认展开的独立查询区" /> }]} onSearch={values => setEvent(JSON.stringify(values))} />
    <Table ref={table} dataSource={disabled ? [] : [{ id: 1, name: "张三" }, { id: 2, name: "李四" }]} columns={[{ key: "name", title: "姓名", dataIndex: "name" }]} rowKey="id" loading={loading} emptyText="暂无匹配人员" tableHeight={200} bordered toolbarBordered striped renderMode="dom" virtualThreshold={1} stickyHeader resizable cellSelection showIndex onRowClick={row => setEvent(`单击 ${row.name}`)} onRowDoubleClick={row => setEvent(`双击 ${row.name}`)} onCellContextMenu={(row, column, index, e) => { e.preventDefault(); setEvent(`右键 ${row.name}，列 ${column.key}，行 ${index}`); }} rowClassName={(_, index) => index === 0 ? "property-first-row" : ""} tableStyle={{ minWidth: 400 }} />
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
