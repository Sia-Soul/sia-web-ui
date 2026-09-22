import { useState } from "react";
import { SelectDateRange, Space, Tag } from "@sia.soul/sia-react-ui";
import type { SelectDateRangeValue, SelectOption } from "@sia.soul/sia-react-ui";
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
import { SelectDateRange } from "@sia.soul/sia-react-ui";

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
      { property: "selectWidth", description: "左侧选择器宽度，数字单位为 px，也支持百分比等 CSS 宽度；右侧自动填充剩余宽度", type: "CSSProperties['width']", defaultValue: "180" },
      { property: "style.width", description: "默认三个字段宽度加两处间距；可显式设置整体宽度，100% 填满父容器", type: "CSSProperties['width']", defaultValue: "min(672px, 100%)" },
      { property: "rangePlaceholder", description: "开始和结束日期占位内容", type: "readonly [string, string]", defaultValue: "['开始日期', '结束日期']" },
      { property: "presets", description: "日期范围快捷选项", type: "readonly DateRangePickerPreset[]", defaultValue: "-" },
      { property: "size / status", description: "统一设置两个子控件的尺寸和校验状态，高度为 22 / 30 / 38px；默认继承 Form", type: "ControlSize / ControlStatus", defaultValue: "'medium' / 'default'" },
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
    <DemoCard title="自定义选择器宽度" description="通过 selectWidth 设置左侧宽度，右侧日期范围自动占满剩余空间。整体宽度使用 style.width 设置；容器过窄时建议调整整体宽度或减小左侧宽度。" code={`<Space direction="vertical" style={{ width: "100%" }}>
  <SelectDateRange options={options} selectWidth={120} style={{ width: "100%" }} />
  <SelectDateRange options={options} selectWidth="25%" style={{ width: "100%" }} />
</Space>`}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <SelectDateRange options={typeOptions} selectWidth={120} style={{ width: "100%" }} defaultValue={{ select: "createdAt", range: ["2026-09-01", "2026-09-04"] }} />
        <SelectDateRange options={typeOptions} selectWidth="25%" style={{ width: "100%" }} defaultValue={{ select: "updatedAt", range: ["2026-09-01", "2026-09-04"] }} />
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
