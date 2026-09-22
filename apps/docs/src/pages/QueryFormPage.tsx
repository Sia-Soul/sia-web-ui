import { useState } from "react";
import { DatePicker, Form, Input, QueryForm, Select, Space, Table } from "@sia.soul/sia-react-ui";
import type { FormValues, QueryFormShortcut } from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const initialValues = { coId: "", coName: "", remark: "", status: [], dates: ["", ""], labels: { searchType: 1, value: [] } };
const statuses = [{ label: "待审核", value: "pending" }, { label: "启用", value: "enabled" }, { label: "停用", value: "disabled" }];
const rows = [{ id: "1001", name: "成都趣睡", status: "pending" }, { id: "1002", name: "示例品牌", status: "enabled" }, { id: "1003", name: "办公用品", status: "disabled" }];
const exampleCode = `import { useState } from "react";
import { QueryForm, Input, Select, DatePicker, Form, Space } from "@sia.soul/sia-react-ui";
import type { QueryFormShortcut } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [form] = Form.useForm();
  const [saved, setSaved] = useState<QueryFormShortcut[]>([]);
  return <QueryForm
    form={form}
    initialValues={{ status: [], labels: { searchType: 1, value: [] } }}
    quickQuerySize="medium"
    quickQueries={[{ key: "pending", label: "待审核", count: 12, values: { status: ["pending"] } }]}
    fields={[
      { key: "code", name: "coId", children: <Input placeholder="品牌方编码" /> },
      { key: "name", name: "coName", children: <Input placeholder="品牌方名称" /> },
      { key: "status", name: "status", children: <Select placeholder="状态" mode="multiple" options={[{ label: "待审核", value: "pending" }]} /> },
      { key: "dates", name: "dates", children: <DatePicker.RangePicker placeholder={["创建开始日期", "创建结束日期"]} /> },
      { key: "labels", children: <Space.Compact block>
        <Form.Item name={["labels", "searchType"]} noStyle><Select placeholder="标签匹配模式" options={[{ label: "包含标签", value: 1 }, { label: "排除标签", value: 2 }]} /></Form.Item>
        <Form.Item name={["labels", "value"]} noStyle><Select placeholder="品牌方标签" mode="multiple" popupMode="modal" options={[{ label: "重点品牌", value: "重点品牌" }]} /></Form.Item>
      </Space.Compact> },
    ]}
    onSearch={async (values, info) => {
      // 在这里调用查询接口，并更新表格数据、分页；返回 Promise 可自动显示加载状态。
      console.log(values, info.source);
    }}
    savedQueries={saved}
    onSaveQuery={async ({ name, values }) => {
      // 可在此调用云端保存接口，然后刷新 savedQueries。
      setSaved(current => [...current, { key: crypto.randomUUID(), label: name, values }]);
    }}
    onRemoveQuery={async query => {
      // 可在此调用云端删除接口，然后刷新 savedQueries。
      setSaved(current => current.filter(item => item.key !== query.key));
    }}
  />;
}`;

export function QueryFormPage() {
  const [form] = Form.useForm();
  const [saved, setSaved] = useState<QueryFormShortcut[]>([{ key: "chengdu", label: "成都趣睡", values: { coName: "成都趣睡", status: [] } }]);
  const [result, setResult] = useState(rows);
  const [lastQuery, setLastQuery] = useState<FormValues>({});
  const [queryCount, setQueryCount] = useState(0);
  const [source, setSource] = useState("尚未查询");
  return <ComponentDocPage name="QueryForm" eyebrow="组件 / 数据录入 / QueryForm" title="QueryForm 查询表单"
    description="封装业务查询区的字段布局、查询重置、展开收起及快捷查询；直接复用 Form 与框架输入组件。"
    apiRows={[
      { property: "fields", description: "字段配置：key、width 与 Form.Item 属性；children 可放输入组件或组合字段", type: "QueryFormField[]", defaultValue: "-" },
      { property: "children", description: "不使用 fields 时，直接传入 Form.Item 或组合字段，每个直接子项独占一个字段布局单元", type: "ReactNode", defaultValue: "-" },
      { property: "form / initialValues", description: "复用 Form 实例与初始值，支持嵌套字段、校验与外部设置条件", type: "FormInstance / FormValues", defaultValue: "-" },
      { property: "onSearch", description: "校验成功后查询；info.source 区分 submit、reset、quick、saved；Promise 自动控制查询加载状态", type: "(values, info) => void | Promise<void>", defaultValue: "必填" },
      { property: "quickQueries", description: "顶部预设查询；每项 key、label、values、disabled，点击先重置为初始值再覆盖条件并查询", type: "QueryFormShortcut[]", defaultValue: "[]" },
      { property: "quickQuerySize / quickQueries[].size", description: "顶部快捷查询按钮统一尺寸，单项 size 优先", type: "small | medium | large", defaultValue: "small" },
      { property: "quickQueries[].count / badgeProps", description: "快捷条件对应数据总量，由业务接口提供；0 默认显示，badgeProps 可配置颜色、大小、overflowCount 和 showZero 等", type: "number / BadgeProps", defaultValue: "未传 count 则不显示徽标" },
      { property: "savedQueries", description: "底部已保存快捷查询标签，支持 status 配色；收起时隐藏", type: "QueryFormShortcut[]", defaultValue: "[]" },
      { property: "onSaveQuery / onRemoveQuery", description: "保存接收 {name, values}，删除接收快捷项；业务端负责持久化并更新 savedQueries，失败提示且保留弹窗", type: "callbacks (支持 Promise)", defaultValue: "不配置时隐藏对应操作" },
      { property: "collapsed / defaultCollapsed / onCollapsedChange", description: "默认展开全部条件，多行时也不自动收起；显式设置收起状态或点击收起后才折叠，隐藏字段仍保持挂载和表单值", type: "boolean / boolean / callback", defaultValue: "false" },
      // 字段间距与双列控件宽度共用同一变量，覆盖时保持列边缘对齐。
      { property: "--sia-query-field-gap", description: "字段横向及纵向间距，使用 CSS 长度；可在 style 或 className 中覆盖，双列字段宽度同步计算", type: "CSS 长度", defaultValue: "6px" },
      { property: "collapsedCount / collapsible / fieldWidth", description: "收起时字段数上限、是否可收起和默认单列宽度（区间和组合字段自动占双列，SelectDateRange 占三列并包含两处间距，字段 width 可覆盖）；全部字段及操作能单行显示时隐藏展开/收起并展示全部字段，否则收起时预留按钮空间", type: "number / boolean / number | string", defaultValue: "3 / true / 220" },
      { property: "loading / shortcutsLoading", description: "查询加载、快捷查询加载状态；阻止重复操作", type: "boolean", defaultValue: "false" },
      { property: "resetSearch", description: "重置为 initialValues 后立即查询", type: "boolean", defaultValue: "true" },
      { property: "searchText / resetText / saveText / actionsExtra", description: "按钮文案与额外操作区", type: "ReactNode", defaultValue: "查询 / 重置 / 另存为快捷查询" },
      { property: "onError", description: "异步查询、保存、删除失败回调，组件同时显示错误提示", type: "(error, operation) => void", defaultValue: "-" },
      { property: "其他 Form 属性", description: "支持 size、disabled、placeholderMode、onValuesChange、onFinishFailed 等", type: "FormProps", defaultValue: "placeholderMode: floating" },
    ]}>
    <DemoCard title="品牌方查询与快捷查询" description="普通字段占一列，日期区间和标签组合自动占两列（含间距）。顶部“待审核”回填条件并查询；底部标签可回填、保存及删除。示例快捷查询保存在当前页面内存，刷新后恢复。" code={exampleCode}>
      <QueryForm aria-label="品牌方查询" form={form} initialValues={initialValues} fieldWidth={200} quickQuerySize="medium"
        quickQueries={[{ key: "pending", label: "待审核", count: rows.filter(row => row.status === "pending").length, values: { status: ["pending"] } }, { key: "enabled", label: "已启用", count: rows.filter(row => row.status === "enabled").length, values: { status: ["enabled"] } }]}
        fields={[
          { key: "code", name: "coId", children: <Input aria-label="品牌方编码" placeholder="品牌方编码" /> },
          { key: "name", name: "coName", children: <Input aria-label="品牌方名称" placeholder="品牌方名称" /> },
          { key: "remark", name: "remark", children: <Input aria-label="备注" placeholder="备注" /> },
          { key: "status", name: "status", children: <Select aria-label="状态" placeholder="状态" mode="multiple" allowClear options={statuses} /> },
          { key: "dates", name: "dates", children: <DatePicker.RangePicker placeholder={["创建开始日期", "创建结束日期"]} /> },
          { key: "labels", children: <Space.Compact block>
            <Form.Item name={["labels", "searchType"]} noStyle><Select aria-label="标签匹配模式" placeholder="标签匹配模式" options={[{ label: "包含标签", value: 1 }, { label: "排除标签", value: 2 }]} /></Form.Item>
            <Form.Item name={["labels", "value"]} noStyle><Select aria-label="品牌方标签" placeholder="品牌方标签" mode="multiple" allowClear popupMode="modal" options={[{ label: "重点品牌", value: "重点品牌" }, { label: "合作品牌", value: "合作品牌" }]} /></Form.Item>
          </Space.Compact> },
        ]}
        onSearch={async (values, info) => {
          setLastQuery(values); setSource(info.source); setQueryCount(count => count + 1);
          setResult(rows.filter(row => (!values.coId || row.id.includes(String(values.coId))) && (!values.coName || row.name.includes(String(values.coName))) && (!Array.isArray(values.status) || !values.status.length || values.status.includes(row.status))));
        }} savedQueries={saved}
        onSaveQuery={async ({ name, values }) => setSaved(current => [...current, { key: crypto.randomUUID(), label: name, values }])}
        onRemoveQuery={async query => setSaved(current => current.filter(item => item.key !== query.key))} />
      <p aria-label="查询结果说明">已查询 {queryCount} 次，触发来源：{source}，共 {result.length} 条</p>
      <Table rowKey="id" columns={[{ key: "id", dataIndex: "id", title: "品牌方编码" }, { key: "name", dataIndex: "name", title: "品牌方名称" }, { key: "status", dataIndex: "status", title: "状态", render: value => statuses.find(item => item.value === value)?.label }]} dataSource={result} />
      <pre aria-label="当前查询条件" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(lastQuery, null, 2)}</pre>
    </DemoCard>
    <DemoCard title="复用现有 Form.Item" description="已有页面可以保留 Form.Item 和组合字段，只替换外层布局与操作按钮；查询、重置和收起操作由 QueryForm 统一提供。" code={'<QueryForm form={searchForm} onSearch={search} initialValues={initialValues}>\n  <Form.Item name="coId" noStyle><Input placeholder="品牌方编码" /></Form.Item>\n  <Form.Item name="coName" noStyle><Input placeholder="品牌方名称" /></Form.Item>\n</QueryForm>'}>
      <QueryForm collapsible={false} onSearch={values => { setLastQuery(values); setSource("兼容原有字段"); }}>
        <Form.Item name="code" noStyle><Input aria-label="兼容查询编码" placeholder="品牌方编码" /></Form.Item>
        <Form.Item name="name" noStyle><Input aria-label="兼容查询名称" placeholder="品牌方名称" /></Form.Item>
      </QueryForm>
    </DemoCard>
  </ComponentDocPage>;
}
