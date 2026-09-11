import { useState } from "react";
import { InputNumber } from "@sia-ui/react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const controlledCode = `import { useState } from "react";
import { InputNumber } from "@sia-ui/react";

export default function Demo() {
  const [value, setValue] = useState<number | null>(3.5);
  return <InputNumber
    value={value}
    onChange={setValue}
    min={0}
    max={10}
    step={0.5}
    precision={1}
    suffix="件"
  />;
}`;

const precisionCode = `import { InputNumber } from "@sia-ui/react";

export default function Demo() {
  return <>
    <InputNumber defaultValue={25} min={0} max={100} suffix="%" />
    <InputNumber defaultValue={19.9} min={0} step={0.1} precision={2} prefix="¥" />
    <InputNumber defaultValue={8} controls={false} />
    <InputNumber defaultValue={4} disabled />
  </>;
}`;

const sizeCode = `import { InputNumber } from "@sia-ui/react";

export default function Demo() {
  return <>
    <InputNumber size="large" defaultValue={3} />
    <InputNumber defaultValue={3} />
    <InputNumber size="small" defaultValue={3} />
  </>;
}`;

const floatingPlaceholderCode = `import { InputNumber } from "@sia-ui/react";

export default function Demo() {
  return <>
    <InputNumber placeholder="数量" placeholderMode="floating" min={0} />
    <InputNumber placeholder="折扣" placeholderMode="floating" defaultValue={8.5} precision={1} suffix="折" />
  </>;
}`;

const apiRows = [
  { property: "value", description: "当前数值（受控）", type: "number | null", defaultValue: "-" },
  { property: "defaultValue", description: "初始数值", type: "number | null", defaultValue: "null" },
  { property: "min / max", description: "允许的数值边界", type: "number", defaultValue: "-" },
  { property: "step", description: "每次改变的步长", type: "number", defaultValue: "1" },
  { property: "precision", description: "固定小数位数", type: "number", defaultValue: "-" },
  { property: "controls", description: "是否显示增减按钮", type: "boolean", defaultValue: "true" },
  { property: "placeholderMode", description: "占位文案的显示模式", type: "'default' | 'floating'", defaultValue: "'default'" },
  { property: "onChange", description: "数值变化回调", type: "(value: number | null) => void", defaultValue: "-" },
] as const;

export function InputNumberPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [value, setValue] = useState<number | null>(3.5);

  return (
    <>
      <PageHeader eyebrow="组件 / 数据录入 / InputNumber" title="InputNumber 数字输入框" description="通过输入或步进按钮录入有边界的数值。" />
      <DocsTabs activeKey={tab} onChange={setTab} />
      {tab === "examples" ? <div className="demo-stack">
        <DemoCard title="受控数值" description="支持键盘上下方向键和按钮步进。" code={controlledCode}>
          <div className="component-demo">
            <InputNumber aria-label="商品数量" value={value} onChange={setValue} min={0} max={10} step={0.5} precision={1} suffix="件" />
            <span className="demo-result">当前值：{value ?? "（空）"}</span>
          </div>
        </DemoCard>
        <DemoCard title="精度与边界" description="失焦或按下 Enter 时自动校正边界和精度。" code={precisionCode}>
          <div className="component-demo">
            <InputNumber aria-label="百分比" defaultValue={25} min={0} max={100} suffix="%" />
            <InputNumber aria-label="金额" defaultValue={19.9} min={0} step={0.1} precision={2} prefix="¥" />
            <InputNumber aria-label="无控制按钮" defaultValue={8} controls={false} />
            <InputNumber aria-label="禁用数字输入" defaultValue={4} disabled />
          </div>
        </DemoCard>
        <DemoCard title="三种尺寸" description="数字输入框可以和同尺寸的其他表单控件对齐。" code={sizeCode}>
          <div className="component-demo">
            <InputNumber aria-label="大尺寸数字输入" size="large" defaultValue={3} />
            <InputNumber aria-label="中尺寸数字输入" defaultValue={3} />
            <InputNumber aria-label="小尺寸数字输入" size="small" defaultValue={3} />
          </div>
        </DemoCard>
        <DemoCard title="浮动占位文案" description="聚焦时占位文案会滑动到输入框顶部；输入数值后会保持浮动。" code={floatingPlaceholderCode}>
          <div className="component-demo">
            <InputNumber aria-label="数量" placeholder="数量" placeholderMode="floating" min={0} />
            <InputNumber aria-label="折扣" placeholder="折扣" placeholderMode="floating" defaultValue={8.5} precision={1} suffix="折" />
          </div>
        </DemoCard>
      </div> : <ApiTable name="InputNumber" rows={apiRows} />}
    </>
  );
}
