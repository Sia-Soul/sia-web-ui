import { useState } from "react";
import { DateRangeQuery, SelectDateRange, Space, Tag } from "@sia-ui/react";
import type { DateRangeQueryValue, SelectDateRangeValue, SelectOption } from "@sia-ui/react";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const typeOptions: readonly SelectOption[] = [
  { label: "创建时间", value: "createdAt" },
  { label: "更新时间", value: "updatedAt" },
  { label: "完成时间", value: "completedAt" },
];

const presets = [
  { label: "今天", value: ["2026-09-04", "2026-09-04"] as const },
  { label: "最近 7 天", value: ["2026-08-29", "2026-09-04"] as const },
  { label: "本月", value: ["2026-09-01", "2026-09-30"] as const },
];

const selectDateRangeCode = `import { useState } from "react";
import { SelectDateRange } from "@sia-ui/react";

const options = [
  { label: "创建时间", value: "createdAt" },
  { label: "更新时间", value: "updatedAt" },
];

export default function Demo() {
  const [value, setValue] = useState({
    select: "createdAt",
    range: ["2026-09-01", "2026-09-04"],
  });

  return <SelectDateRange
    options={options}
    value={value}
    onChange={setValue}
    presets={[{ label: "本月", value: ["2026-09-01", "2026-09-30"] }]}
  />;
}`;

const dateRangeQueryCode = `import { useState } from "react";
import { DateRangeQuery } from "@sia-ui/react";

export default function Demo() {
  const [value, setValue] = useState({
    type: "updatedAt",
    range: ["2026-08-29", "2026-09-04"],
  });

  return <DateRangeQuery
    label="任务时间筛选"
    typeLabel="字段"
    rangeLabel="起止日期"
    options={[
      { label: "创建时间", value: "createdAt" },
      { label: "更新时间", value: "updatedAt" },
    ]}
    value={value}
    onChange={setValue}
  />;
}`;

export function SelectDateRangePage() {
  const [value, setValue] = useState<SelectDateRangeValue>({
    select: "createdAt",
    range: ["2026-09-01", "2026-09-04"],
  });

  return <ComponentDocPage
    eyebrow="组件 / 数据录入 / SelectDateRange"
    title="SelectDateRange 组合日期范围"
    description="把类型选择器和日期范围选择器组合为一个连续控件，适合紧凑的筛选栏。"
    name="SelectDateRange"
    apiRows={[
      { property: "options", description: "左侧选择器的候选项", type: "readonly SelectOption[]", defaultValue: "[]" },
      { property: "value / defaultValue", description: "选择值与日期范围", type: "SelectDateRangeValue", defaultValue: "首个选项 / 空范围" },
      { property: "selectPlaceholder", description: "选择器占位内容", type: "ReactNode", defaultValue: "'请选择类型'" },
      { property: "rangePlaceholder", description: "开始和结束日期占位内容", type: "readonly [string, string]", defaultValue: "['开始日期', '结束日期']" },
      { property: "presets", description: "日期范围快捷选项", type: "readonly DateRangePickerPreset[]", defaultValue: "-" },
      { property: "size / status", description: "统一设置两个子控件的尺寸和校验状态", type: "ControlSize / ControlStatus", defaultValue: "'medium' / 'default'" },
      { property: "disabled", description: "禁用整个组合控件", type: "boolean", defaultValue: "false" },
      { property: "onChange", description: "任一子控件变化时返回完整组合值", type: "(value: SelectDateRangeValue) => void", defaultValue: "-" },
    ]}
  >
    <DemoCard title="紧凑组合筛选" description="两个子控件共享尺寸、状态和禁用配置，同时保持完整键盘操作。" code={selectDateRangeCode}>
      <Space direction="vertical" size={12}>
        <SelectDateRange options={typeOptions} value={value} onChange={setValue} presets={presets} />
        <Tag status="processing">{String(value.select)}：{value.range[0] || "未选择"} 至 {value.range[1] || "未选择"}</Tag>
      </Space>
    </DemoCard>
    <DemoCard title="尺寸、状态与禁用" description="组合控件会把状态一致地传递给 Select 和 RangePicker。" code={`<Space direction="vertical">
  <SelectDateRange size="small" options={options} />
  <SelectDateRange status="warning" options={options} />
  <SelectDateRange disabled options={options} />
</Space>`}>
      <Space direction="vertical" size={12}>
        <SelectDateRange size="small" options={typeOptions} defaultValue={{ select: "createdAt", range: ["", ""] }} />
        <SelectDateRange status="warning" options={typeOptions} defaultValue={{ select: "updatedAt", range: ["", ""] }} />
        <SelectDateRange disabled options={typeOptions} defaultValue={{ select: "completedAt", range: ["2026-09-01", "2026-09-04"] }} />
      </Space>
    </DemoCard>
  </ComponentDocPage>;
}

export function DateRangeQueryPage() {
  const [value, setValue] = useState<DateRangeQueryValue>({
    type: "updatedAt",
    range: ["2026-08-29", "2026-09-04"],
  });

  return <ComponentDocPage
    eyebrow="组件 / 数据录入 / DateRangeQuery"
    title="DateRangeQuery 日期范围查询"
    description="提供带标题和字段标签的完整日期范围查询区，适合表单与高级筛选面板。"
    name="DateRangeQuery"
    apiRows={[
      { property: "options", description: "时间字段候选项", type: "readonly SelectOption[]", defaultValue: "[]" },
      { property: "value / defaultValue", description: "时间字段和日期范围", type: "DateRangeQueryValue", defaultValue: "首个选项 / 空范围" },
      { property: "label", description: "组合查询标题", type: "ReactNode", defaultValue: "'时间范围'" },
      { property: "typeLabel / rangeLabel", description: "两个子字段的可见标签", type: "ReactNode", defaultValue: "'时间范围类型' / '日期范围'" },
      { property: "typePlaceholder / rangePlaceholder", description: "两个子字段的占位内容", type: "ReactNode / [string, string]", defaultValue: "内置中文提示" },
      { property: "presets", description: "日期范围快捷选项", type: "readonly DateRangePickerPreset[]", defaultValue: "-" },
      { property: "size / status / disabled", description: "组合控件的统一外观和状态", type: "ControlSize / ControlStatus / boolean", defaultValue: "medium / default / false" },
      { property: "onChange", description: "字段或日期变化时返回完整值", type: "(value: DateRangeQueryValue) => void", defaultValue: "-" },
    ]}
  >
    <DemoCard title="带标签的查询面板" description="标签已与内部控件建立无障碍关联，适合直接放入筛选表单。" code={dateRangeQueryCode}>
      <Space direction="vertical" size={12}>
        <DateRangeQuery
          label="任务时间筛选"
          typeLabel="字段"
          rangeLabel="起止日期"
          options={typeOptions}
          value={value}
          onChange={setValue}
          presets={presets}
        />
        <Tag status="processing">{String(value.type)}：{value.range[0]} 至 {value.range[1]}</Tag>
      </Space>
    </DemoCard>
  </ComponentDocPage>;
}
