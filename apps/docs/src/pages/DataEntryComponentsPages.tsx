import { FloatingPlaceholderDemo } from "./FloatingPlaceholderDemo";
import { FormSizeDemo } from "./FormSizeDemo";
import formSizeCode from "./FormSizeDemo.tsx?raw";
import { useState } from "react";
import {
  Button,
  Checkbox,
  ColorPicker,
  DatePicker,
  Divider,
  Form,
  Input,
  Radio,
  Slider,
  Space,
  TimePicker,
  TreeSelect,
  message,
} from "@sia.soul/sia-react-ui";
import type { CheckboxValue, FormRule, SliderValue, TreeSelectNode } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

type DocPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  name: string;
  apiRows: readonly { property: string; description: string; type: string; defaultValue: string }[];
  children: React.ReactNode;
};

function DocPage({ eyebrow, title, description, name, apiRows, children }: DocPageProps) {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  return <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">{children}</div> : <ApiTable name={name} rows={apiRows} />}
  </>;
}

const checkboxCode = `import { useState } from "react";
import { Checkbox, Space } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const options = ["查看", "编辑", "管理"];
  const [selected, setSelected] = useState(["查看"]);
  const allChecked = selected.length === options.length;

  return (
    <Space direction="vertical" align="start">
      <Checkbox
        checked={allChecked}
        indeterminate={selected.length > 0 && !allChecked}
        onChange={(checked) => setSelected(checked ? options : [])}
      >
        全选
      </Checkbox>
      <Checkbox.Group value={selected} options={options} onChange={setSelected} />
      <Checkbox disabled>禁用选项</Checkbox>
    </Space>
  );
}`;

// 使用真实业务选项演示等宽三列，无需额外的布局 className 或 style。
const scopeOptions = ["店铺", "商品", "订单", "售后单", "库存", "店铺商品资料", "采购退货", "其它出入库", "库存盘点", "采购入库", "合作方商品", "平台报文", "胜算报文", "销售退仓", "销售出库", "调拨出", "调拨入"];
const checkboxColumnsCode = `import { Checkbox } from "@sia.soul/sia-react-ui";

const options = ${JSON.stringify(scopeOptions)};

export default function Demo() {
  // columns 指定等宽列数，gap 按 [行间距, 列间距] 设置像素间距。
  return <Checkbox.Group columns={3} gap={[20, 24]} options={options} />;
}`;

export function CheckboxPage() {
  const allOptions = ["查看", "编辑", "管理"];
  const [selected, setSelected] = useState<readonly CheckboxValue[]>(["查看"]);
  const allChecked = selected.length === allOptions.length;
  return <DocPage eyebrow="组件 / 数据录入 / Checkbox" title="Checkbox 多选框" description="在一组独立选项中选择零项、多项或全部。" name="Checkbox" apiRows={[
    { property: "size", description: "图形尺寸为 14 / 16 / 18px；支持 Form、Group 继承及单项覆盖", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
    { property: "checked / defaultChecked", description: "受控或默认选中状态", type: "boolean", defaultValue: "false" },
    { property: "indeterminate", description: "半选状态", type: "boolean", defaultValue: "false" },
    { property: "onChange", description: "选中状态变化", type: "(checked, event) => void", defaultValue: "-" },
    { property: "Checkbox.Group", description: "成组管理值和禁用状态", type: "value / options / onChange", defaultValue: "-" },
    { property: "Group.columns", description: "正整数启用等宽网格，按行排列并占满容器宽度；优先于 direction，无效值回退到方向布局", type: "number", defaultValue: "-" },
    { property: "Group.direction", description: "横向自动换行或纵向单列排列；未设置有效 columns 时生效", type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'" },
    { property: "Group.gap", description: "像素间距：数字设置统一间距，二元组为 [行间距, 列间距]；支持 0，负数按 0 处理", type: "number | readonly [number, number]", defaultValue: "[12, 18]" },
  ]}>
    <DemoCard title="分组与全选" description={`已选择 ${selected.length} 项`} code={checkboxCode}>
      <Space direction="vertical" align="start">
        <Checkbox checked={allChecked} indeterminate={selected.length > 0 && !allChecked} onChange={(checked) => setSelected(checked ? allOptions : [])}>全选</Checkbox>
        <Checkbox.Group value={selected} options={allOptions} onChange={setSelected} />
        <Checkbox disabled>禁用选项</Checkbox>
      </Space>
    </DemoCard>
    <DemoCard title="同步范围：等宽多列" description="设置 columns={3} 即可排成三列，gap={[20, 24]} 设置行列间距。" code={checkboxColumnsCode}>
      <Checkbox.Group columns={3} gap={[20, 24]} options={scopeOptions} />
    </DemoCard>
    <DemoCard title="纵向排列" description="direction 控制排列方向，gap 设置间距；也支持直接嵌套 Checkbox。" code={`<Checkbox.Group direction="vertical" gap={16}>
  <Checkbox value="view">查看</Checkbox>
  <Checkbox value="edit">编辑</Checkbox>
  <Checkbox value="manage" disabled>管理</Checkbox>
</Checkbox.Group>`}>
      <Checkbox.Group direction="vertical" gap={16}>
        <Checkbox value="view">查看</Checkbox>
        <Checkbox value="edit">编辑</Checkbox>
        <Checkbox value="manage" disabled>管理</Checkbox>
      </Checkbox.Group>
    </DemoCard>
  </DocPage>;
}

const colorCode = `import { ColorPicker } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <ColorPicker
      defaultValue="#1677FF"
      showText
      showAlpha
      allowClear
      presets={[{ label: "品牌色", colors: ["#1677FF", "#52C41A", "#FA8C16"] }]}
    />
  );
}`;

export function ColorPickerPage() {
  const [color, setColor] = useState("#1677FF");
  return <DocPage eyebrow="组件 / 数据录入 / ColorPicker" title="ColorPicker 颜色选择器" description="选择单色、渐变色、透明度或无色，并输出可直接使用的 CSS 颜色值。" name="ColorPicker" apiRows={[
    { property: "size", description: "small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
    { property: "value / defaultValue", description: "颜色值", type: "HEX | linear-gradient | ''", defaultValue: "'#1677FF'" },
    { property: "mode / defaultMode", description: "当前或默认颜色模式", type: "'solid' | 'gradient'", defaultValue: "'solid'" },
    { property: "modes", description: "允许切换的颜色模式", type: "ColorPickerMode[]", defaultValue: "['solid', 'gradient']" },
    { property: "showText / showAlpha", description: "显示色值与透明度", type: "boolean | formatter", defaultValue: "false" },
    { property: "presets", description: "预设色组", type: "ColorPickerPreset[]", defaultValue: "-" },
    { property: "allowClear", description: "允许选择无色", type: "boolean", defaultValue: "true" },
  ]}>
    <DemoCard title="单色、渐变色、透明度与预设" description={`当前颜色：${color || "无色"}`} code={colorCode}>
      <ColorPicker value={color} onChange={setColor} showText showAlpha allowClear presets={[
        { label: "品牌色", colors: ["#1677FF", "#4096FF", "#0958D9"] },
        { label: "状态色", colors: ["#52C41A", "#FAAD14", "#FF4D4F"] },
      ]} />
    </DemoCard>
  </DocPage>;
}

const dateBasicCode = `import { DatePicker, Space } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <Space wrap>
      <DatePicker allowClear />
      <DatePicker needConfirm />
      {/* 点击“此刻”填入当前日期和时分秒，再点击确定提交。 */}
      <DatePicker showTime={{ showSecond: true }} needConfirm />
    </Space>
  );
}`;

const dateSelectionCode = `import { DatePicker, Space } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <Space direction="vertical">
      <DatePicker multiple defaultValue={["2026-07-01", "2026-07-05"]} />
      <DatePicker.RangePicker defaultValue={["2026-07-01", "2026-07-18"]} />
    </Space>
  );
}`;

const dateAdvancedCode = `import { DatePicker, Space } from "@sia.soul/sia-react-ui";

const presets = [
  { label: "最近 7 天", value: ["2026-07-14 00:00", "2026-07-20 23:59"] },
  { label: "最近 30 天", value: ["2026-06-21 00:00", "2026-07-20 23:59"] },
];

export default function Demo() {
  return (
    <Space direction="vertical">
      {/* 任一端允许为空时立即回显所选日期时间，确认流程完成后再提交。 */}
      {/* 点选结束日期自动填入 23:59:59；此刻和快捷范围仍使用各自的时间。 */}
      <DatePicker.RangePicker showTime={{ showSecond: true }} allowEmpty={[true, true]} needConfirm presets={presets} />
      <DatePicker.RangePicker maxRangeDays={7} />
    </Space>
  );
}`;

export function DatePickerPage() {
  const [range, setRange] = useState<readonly [string, string]>(["", ""]);
  const [multipleDates, setMultipleDates] = useState<readonly string[]>(["2026-07-01", "2026-07-05", "2026-07-14"]);
  const [dateTimeRange, setDateTimeRange] = useState<readonly [string, string]>(["", ""]);
  return <DocPage eyebrow="组件 / 数据录入 / DatePicker" title="DatePicker 日期选择器" description="选择日期、多个日期、日期时间或受约束的日期范围。" name="DatePicker" apiRows={[
    { property: "size", description: "日期与范围日期高度为 22 / 30 / 38px、字号为 12 / 13 / 16px；默认继承 Form，组件自身 size 优先", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
    { property: "value / defaultValue", description: "单值或多选日期值", type: "string | readonly string[]", defaultValue: "''" },
    { property: "picker", description: "日期粒度", type: "date | week | month | year | quarter", defaultValue: "'date'" },
    { property: "multiple", description: "在同一面板内选择多个日期", type: "boolean", defaultValue: "false" },
    { property: "needConfirm", description: "选择后需要点击确定才提交；带时间的范围始终使用确定按钮分步确认并提交", type: "boolean", defaultValue: "showTime 时为 true" },
    // 沿用 showToday 属性名，说明快捷入口按开启的时间精度填值。
    { property: "showToday", description: "显示“此刻”入口；点击填入本机当前日期，开启 showTime 后填入当前时分，showSecond 开启后包含秒；遵循确认流程和日期限制，范围仅更新当前端点", type: "boolean", defaultValue: "true" },
    { property: "showTime", description: "组合时间面板，可显示秒；范围点选结束日期自动填入 23:59，开启秒后为 23:59:59，可再手动修改；开始日期保留原时间，此刻取当前时间。范围使用单面板分步确认两端后提交", type: "boolean | { showSecond, defaultValue }", defaultValue: "false" },
    { property: "presets", description: "面板左侧纵向显示的快捷日期或范围；带时间范围回填后点击一次确定即提交关闭", type: "DatePickerPreset[]", defaultValue: "-" },
    { property: "disabledDate / minDate / maxDate", description: "禁用或限制可选日期", type: "function / string", defaultValue: "-" },
    { property: "RangePicker.allowEmpty", description: "分别允许开始、结束为空；任一端允许为空时，选值立即回显；纯日期点选即保存合法值，带时间必须确定后保存；均为 false 时两端完整确认后一起更新", type: "readonly [boolean, boolean]", defaultValue: "[false, false]" },
    { property: "RangePicker.maxRangeDays", description: "限制一次最多可选择的天数", type: "number", defaultValue: "-" },
  ]}>
    <DemoCard title="基础日期与手动确认" description="面板使用统一的圆角日期单元格；手动确认模式不会在点选日期后立即关闭。" code={dateBasicCode}>
      <Space wrap>
        <DatePicker aria-label="选择日期" />
        <DatePicker needConfirm aria-label="手动确认日期" />
        <DatePicker showTime={{ showSecond: true }} needConfirm aria-label="选择日期时间" />
      </Space>
    </DemoCard>
    <DemoCard title="范围选择与多日期选择" description={`范围：${range[0] || "未选择"} 至 ${range[1] || "未选择"}；多选：${multipleDates.join("、") || "未选择"}`} code={dateSelectionCode}>
      <Space direction="vertical" size={16}>
        <DatePicker multiple value={multipleDates} onChange={(next) => setMultipleDates(Array.isArray(next) ? next : [])} />
        <DatePicker.RangePicker value={range} onChange={setRange} />
      </Space>
    </DemoCard>
    <DemoCard title="日期时间、快捷范围与选择限制" description={`点击起止输入框切换编辑，底线标识当前端点；手动选择两端确认后提交，左侧快捷范围只需一次确认；当前日期时间范围：${dateTimeRange[0] || "未选择"} 至 ${dateTimeRange[1] || "未选择"}`} code={dateAdvancedCode}>
      <Space direction="vertical" size={16}>
        <DatePicker.RangePicker
          value={dateTimeRange}
          onChange={setDateTimeRange}
          showTime={{ showSecond: true }}
          allowEmpty={[true, true]}
          needConfirm
          presets={[
            { label: "今天", value: ["2026-07-20 00:00", "2026-07-20 23:59"] },
            { label: "最近 7 天", value: ["2026-07-14 00:00", "2026-07-20 23:59"] },
            { label: "最近 14 天", value: ["2026-07-07 00:00", "2026-07-20 23:59"] },
            { label: "最近 30 天", value: ["2026-06-21 00:00", "2026-07-20 23:59"] },
          ]}
        />
        <DatePicker.RangePicker maxRangeDays={7} placeholder={["开始日期", "最多选择 7 天"]} />
      </Space>
    </DemoCard>
  </DocPage>;
}

const USERNAME_RULES: readonly FormRule[] = [{ required: true, message: "请输入用户名" }, { min: 3, message: "至少输入 3 个字符" }];
const EMAIL_RULES: readonly FormRule[] = [{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }];

const formCode = `import { Button, Checkbox, Form, Input, Space } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [form] = Form.useForm();
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ username: "", email: "", remember: true }}
      onFinish={console.log}
    >
      <Form.Item name="username" label="用户名" rules={[
        { required: true, message: "请输入用户名" },
        { min: 3, message: "至少输入 3 个字符" },
      ]}>
        <Input allowClear placeholder="至少 3 个字符" />
      </Form.Item>
      <Form.Item name="email" label="邮箱" rules={[
        { required: true, message: "请输入邮箱" },
        { type: "email", message: "邮箱格式不正确" },
      ]}>
        <Input allowClear placeholder="name@example.com" />
      </Form.Item>
      <Form.Item name="remember" valuePropName="checked">
        <Checkbox>记住当前设置</Checkbox>
      </Form.Item>
      <Space>
        <Button type="submit" variant="primary">提交</Button>
        <Button onClick={() => form.resetFields()}>重置</Button>
      </Space>
    </Form>
  );
}`;

export function FormPage() {
  const [form] = Form.useForm();
  const [result, setResult] = useState("尚未提交");
  // 默认标签列按当前表单最宽标签对齐，动态字段增删时自动更新。
  return <DocPage eyebrow="组件 / 数据录入 / Form" title="Form 表单" description="统一管理字段值、校验、气泡错误提示、提交和动态字段；水平及行内布局默认按同一表单最宽标签对齐，可通过 --sia-form-label-width 显式指定列宽；Form.Item 默认保留 8px 下外边距。" name="Form" apiRows={[
    { property: "form / Form.useForm", description: "表单实例与命令式 API", type: "FormInstance", defaultValue: "自动创建" },
    { property: "size", description: "统一子组件尺寸；small / medium / large 的单行控件高度为 22 / 30 / 38px。组件自身 size 优先，Checkbox.Group 和 Radio.Group 可覆盖组内默认尺寸", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
    { property: "placeholderMode", description: "统一设置输入和选择组件的占位符模式；组件自身的同名属性优先", type: "'default' | 'floating'", defaultValue: "'default'" },
    { property: "initialValues", description: "表单初始值", type: "FormValues", defaultValue: "{}" },
    { property: "onFinish / onFinishFailed", description: "提交成功和失败回调", type: "function", defaultValue: "-" },
    { property: "submit", description: "提交失败时自动滚动并聚焦首个错误字段", type: "() => void", defaultValue: "-" },
    { property: "Form.Item", description: "字段绑定、标签、校验规则和非占位错误气泡", type: "name / rules / valuePropName", defaultValue: "-" },
    { property: "Form.Item.align", description: "横向布局中 start 对齐首行控件，center 对齐整个内容区中心；纵向、行内及窄屏堆叠不受影响", type: "'start' | 'center'", defaultValue: "'start'" },
    { property: "Form.List", description: "动态数组字段", type: "render function", defaultValue: "-" },
  ]}>
    <DemoCard title="只读信息居中" description="通过 Form.Item 的语义属性对齐纯文字和多行内容，无需业务页面覆盖表单样式。" code={`<Form><Form.Item label="是否同步" align="center">是</Form.Item><Form.Item label="同步范围" align="center"><div>商品、订单<br />店铺、库存</div></Form.Item></Form>`}>
      <Form><Form.Item label="是否同步" align="center">是</Form.Item><Form.Item label="同步范围" align="center"><div>商品、订单<br />店铺、库存</div></Form.Item></Form>
    </DemoCard>
    <DemoCard title="统一组件尺寸" description="输入、选择、日期、按钮、颜色与分段控件统一为 22 / 30 / 38px，日期和时间文字为 12 / 13 / 16px；Checkbox 和 Radio 图形为 14 / 16 / 18px，标准 Switch 高度为 16 / 22 / 28px，Rate 星形为 15 / 20 / 25px。多行文本保留多行高度。支持 Form 继承、组尺寸和组件单独覆盖，切换尺寸不丢失已输入内容。" code={formSizeCode}>
      <FormSizeDemo />
    </DemoCard>
    <DemoCard title="统一浮动标签" description="空值时显示占位文字，聚焦、展开或已有值时浮到边框；可填入示例值，再清空检查所有组件。范围日期合并显示两端标签，范围时间分别显示。" code={`<Form placeholderMode="floating" layout="vertical">
  <Form.Item name="name"><Input placeholder="姓名" /></Form.Item>
  <Form.Item name="type"><Select options={options} placeholder="业务类型" /></Form.Item>
  <Form.Item name="notes"><TextArea placeholder="备注" /></Form.Item>
  <Form.Item name="normal"><Input placeholderMode="default" placeholder="普通占位符" /></Form.Item>
</Form>`}>
      <FloatingPlaceholderDemo />
    </DemoCard>
    <DemoCard title="字段绑定与实时校验" description={`${result}；提交失败会自动定位到首个错误字段。`} code={formCode}>
      <Form form={form} layout="vertical" initialValues={{ username: "", email: "", remember: true }} onFinish={(values) => {
        setResult(`提交成功：${JSON.stringify(values)}`);
        message.success("表单校验通过");
      }} onFinishFailed={() => setResult("请修正表单中的错误")}>
        <Form.Item name="username" label="用户名" rules={USERNAME_RULES}><Input allowClear placeholder="至少 3 个字符" /></Form.Item>
        <Form.Item name="email" label="邮箱" rules={EMAIL_RULES}><Input allowClear placeholder="name@example.com" /></Form.Item>
        <Form.Item name="remember" valuePropName="checked"><Checkbox>记住当前设置</Checkbox></Form.Item>
        <Space>
          <Button type="submit" variant="primary">提交</Button>
          <Button onClick={() => form.resetFields()}>重置</Button>
        </Space>
      </Form>
    </DemoCard>
  </DocPage>;
}

const radioCode = `import { useState } from "react";
import { Divider, Radio } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [value, setValue] = useState("daily");
  const options = [
    { label: "每天", value: "daily" },
    { label: "每周", value: "weekly" },
    { label: "每月", value: "monthly" },
  ];
  return <>
    <Radio.Group value={value} onChange={setValue} options={options} />
    <Divider />
    <Radio.Group
      value={value}
      onChange={setValue}
      optionType="button"
      buttonStyle="solid"
      options={options}
    />
  </>;
}`;

export function RadioPage() {
  const [value, setValue] = useState("daily");
  return <DocPage eyebrow="组件 / 数据录入 / Radio" title="Radio 单选框" description="在一组互斥选项中选择一个值，支持按钮形态。" name="Radio" apiRows={[
    { property: "size", description: "图形尺寸为 14 / 16 / 18px，按钮形态高度为 22 / 30 / 38px；支持 Form、Group 继承及单项覆盖", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
    { property: "value / checked", description: "选项值与选中状态", type: "string | number / boolean", defaultValue: "-" },
    { property: "Radio.Group", description: "统一管理互斥值", type: "value / options / onChange", defaultValue: "-" },
    { property: "optionType", description: "普通或按钮形态", type: "'default' | 'button'", defaultValue: "'default'" },
    { property: "buttonStyle", description: "按钮选中样式", type: "'outline' | 'solid'", defaultValue: "'outline'" },
  ]}>
    <DemoCard title="普通与按钮单选" description={`当前周期：${value}`} code={radioCode}>
      <Radio.Group value={value} onChange={(next) => setValue(String(next))}>
        <Radio value="daily">每天</Radio><Radio value="weekly">每周</Radio><Radio value="monthly">每月</Radio>
      </Radio.Group>
      <Divider />
      <Radio.Group value={value} onChange={(next) => setValue(String(next))} optionType="button" buttonStyle="solid" options={[
        { label: "每天", value: "daily" }, { label: "每周", value: "weekly" }, { label: "每月", value: "monthly" },
      ]} />
    </DemoCard>
  </DocPage>;
}

const sliderCode = `import { Divider, Slider } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <>
    <Slider
      range
      defaultValue={[20, 70]}
      marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }}
      tooltip={{ formatter: (value) => value + "%" }}
    />
    <Divider />
    <Slider defaultValue={35} step={5} />
  </>;
}`;

export function SliderPage() {
  const [value, setValue] = useState<SliderValue>([20, 70]);
  return <DocPage eyebrow="组件 / 数据录入 / Slider" title="Slider 滑动输入条" description="在连续或离散范围中选择单值或区间。" name="Slider" apiRows={[
    { property: "value / defaultValue", description: "单值或范围值", type: "number | [number, number]", defaultValue: "min" },
    { property: "min / max / step", description: "范围和步长", type: "number", defaultValue: "0 / 100 / 1" },
    { property: "range / vertical / reverse", description: "范围、垂直和反向模式", type: "boolean", defaultValue: "false" },
    { property: "marks", description: "刻度标记", type: "Record<number, ReactNode | SliderMark>", defaultValue: "-" },
    { property: "onChangeComplete", description: "拖动完成回调", type: "(value) => void", defaultValue: "-" },
  ]}>
    <DemoCard title="范围、刻度与提示" description={`当前值：${Array.isArray(value) ? value.join(" - ") : value}`} code={sliderCode}>
      <Slider value={value} range onChange={setValue} marks={{ 0: "0", 25: "25", 50: "50", 75: "75", 100: "100" }} tooltip={{ formatter: (item) => `${item}%` }} />
      <Divider />
      <Slider defaultValue={35} step={5} />
    </DemoCard>
  </DocPage>;
}

const timeCode = `import { TimePicker } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <>
      <TimePicker showSecond />
      <TimePicker.RangePicker />
    </>
  );
}`;

export function TimePickerPage() {
  const [range, setRange] = useState<readonly [string, string]>(["09:00", "18:00"]);
  return <DocPage eyebrow="组件 / 数据录入 / TimePicker" title="TimePicker 时间选择器" description="选择时、分、秒或时间范围。" name="TimePicker" apiRows={[
    { property: "size", description: "small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
    { property: "value / defaultValue", description: "标准时间字符串", type: "string", defaultValue: "''" },
    { property: "showSecond / use12Hours", description: "秒和 12 小时制", type: "boolean", defaultValue: "false" },
    { property: "disabledTime", description: "禁用时间判断", type: "(value) => boolean", defaultValue: "-" },
    { property: "min / max / step", description: "可选时间边界与步长（秒）", type: "string / string / number", defaultValue: "-" },
    { property: "onChange / onOpenChange", description: "点击确定后提交时间 / 面板实际展开状态变化", type: "(value: string) => void / (open: boolean) => void", defaultValue: "-" },
    { property: "TimePicker.RangePicker", description: "时间范围选择", type: "RangePicker props", defaultValue: "-" },
  ]}>
    <DemoCard title="时间与范围" description={`工作时间：${range[0]} - ${range[1]}`} code={timeCode}>
      <Space wrap><TimePicker aria-label="选择时间" /><TimePicker showSecond defaultValue="14:30:45" aria-label="选择精确时间" /></Space>
      <Divider />
      <TimePicker.RangePicker value={range} onChange={setRange} />
    </DemoCard>
    <DemoCard title="12 小时制" description="以 AM / PM 显示，回调值保持标准 24 小时制。选择后点击确定提交，点击外部或按 Esc 取消本次选择。" code={'<TimePicker use12Hours defaultValue="14:30" />'}>
      <TimePicker use12Hours defaultValue="14:30" />
    </DemoCard>
    <DemoCard title="尺寸与状态" description="统一输入框的尺寸、边框、禁用和校验状态。" code={'<TimePicker size="small" />\n<TimePicker status="error" />\n<TimePicker disabled defaultValue="09:00" />'}>
      <Space wrap><TimePicker size="small" /><TimePicker /><TimePicker size="large" /><TimePicker status="error" /><TimePicker disabled defaultValue="09:00" /></Space>
    </DemoCard>
  </DocPage>;
}

const TREE_DATA: readonly TreeSelectNode[] = [
  { title: "产品中心", value: "product", children: [
    { title: "Web 产品", value: "web", children: [{ title: "管理后台", value: "admin" }, { title: "官网", value: "site" }] },
    { title: "客户端产品", value: "client" },
  ] },
  { title: "研发中心", value: "rd", children: [{ title: "前端组", value: "frontend" }, { title: "后端组", value: "backend" }] },
];

const treeSelectCode = `import { TreeSelect } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <TreeSelect
      treeData={treeData}
      treeCheckable
      showSearch
      allowClear
      treeDefaultExpandAll
      placeholder="选择团队"
    />
  );
}`;

export function TreeSelectPage() {
  const [value, setValue] = useState<readonly (string | number)[]>(["frontend"]);
  return <DocPage eyebrow="组件 / 数据录入 / TreeSelect" title="TreeSelect 树选择" description="在层级结构中搜索、展开并选择一个或多个节点。" name="TreeSelect" apiRows={[
    { property: "size", description: "small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
    { property: "treeData", description: "树形选项数据", type: "TreeSelectNode[]", defaultValue: "[]" },
    { property: "multiple / treeCheckable", description: "多选和勾选模式", type: "boolean", defaultValue: "false" },
    { property: "showSearch", description: "显示节点搜索", type: "boolean", defaultValue: "false" },
    { property: "treeDefaultExpandAll", description: "默认展开全部节点", type: "boolean", defaultValue: "false" },
    { property: "maxTagCount / allowClear", description: "标签数量和清除", type: "number / boolean", defaultValue: "3 / true" },
  ]}>
    <DemoCard title="搜索、多选与展开" description={`已选择 ${value.length} 个节点`} code={treeSelectCode}>
      <TreeSelect treeData={TREE_DATA} value={value} onChange={(next) => setValue(Array.isArray(next) ? [...next] : next === undefined ? [] : [next])} treeCheckable showSearch allowClear treeDefaultExpandAll placeholder="选择团队" />
    </DemoCard>
  </DocPage>;
}

// 上传示例独立维护，覆盖目录、OSS 和完全受控模式。
export { UploadPage } from "./UploadPage";
