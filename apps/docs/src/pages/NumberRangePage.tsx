import { useState } from "react";
import { Form, NumberRange, QueryForm } from "@sia.soul/sia-react-ui";
import type { NumberRangeValue } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { PageHeader } from "./PageHeader";

/** 演示区间的空端点、数值 0、表单绑定及无固定宽度的查询布局。 */
export function NumberRangePage() {
  const [value, setValue] = useState<NumberRangeValue>([0, null]);
  return <>
    <PageHeader eyebrow="组件 / 数据录入 / NumberRange" title="NumberRange 数字区间" description="日期区间风格的双数字输入，以波浪线分隔，支持只填写一端。" />
    <div className="demo-stack">
      <DemoCard title="受控区间" description="失焦或按 Enter 提交；不自动交换上下限，业务可使用表单规则校验。" code={'<NumberRange value={value} onChange={setValue} placeholder={["最低金额", "最高金额"]} precision={2} />'}>
        <NumberRange value={value} onChange={setValue} placeholder={["最低金额", "最高金额"]} precision={2} />
        <p>当前值：{JSON.stringify(value)}</p>
      </DemoCard>
      <DemoCard title="尺寸与状态" description="继承 Form 尺寸，支持浮动占位、只读、禁用和错误状态。" code={'<Form size="small"><Form.Item name="range"><NumberRange /></Form.Item></Form>'}>
        <Form size="small"><Form.Item name="range"><NumberRange placeholderMode="floating" /></Form.Item></Form>
        <NumberRange size="large" defaultValue={[0, 100]} disabled />
        <NumberRange defaultValue={[1, 10]} readOnly />
        <NumberRange status="error" placeholder={["最小值", "最大值"]} />
      </DemoCard>
      <DemoCard title="查询区与快捷查询" description="区间自动占两列；收起条件后保留快捷查询栏，重置和快捷回填由 Form 管理。" code={'<QueryForm<{ count?: NumberRangeValue }> fields={[{key:"count", name:"count", children:<NumberRange />}]} onSearch={console.log} />'}>
        <QueryForm<{ count?: NumberRangeValue }> fields={[{ key: "count", name: "count", children: <NumberRange placeholder={["最小限定写入次数", "最大限定写入次数"]} /> }]}
          savedQueries={[{ key: "zero", label: "下限为零", values: { count: [0, null] } }]}
          onSearch={(values) => { setValue(values.count ?? [null, null]); }} />
      </DemoCard>
      <ApiTable name="NumberRange" rows={[
        { property: "value / defaultValue", type: "[number | null, number | null]", defaultValue: "[null, null]", description: "受控值 / 初始值；null 端点表示不限，0 是有效值" },
        { property: "onChange", type: "(value: NumberRangeValue) => void", defaultValue: "—", description: "一端提交或清空时返回完整区间；不自动排序" },
        { property: "placeholder / inputLabels", type: "[string, string]", defaultValue: "[最小值, 最大值]", description: "两端占位文案 / 可访问名称" },
        { property: "min / max / step / precision", type: "number", defaultValue: "step: 1", description: "每端边界、步长和小数位数，沿用 InputNumber" },
        { property: "size / status / placeholderMode", type: "同 InputNumber", defaultValue: "继承表单", description: "尺寸、校验状态和占位模式" },
        { property: "allowClear", type: "boolean", defaultValue: "true", description: "清空两端；只读或禁用时不显示" },
        { property: "disabled / readOnly", type: "boolean", defaultValue: "false", description: "禁用 / 只读，两种状态都不允许改值" },
      ]} />
    </div>
  </>;
}
