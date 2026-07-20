import { Button, Divider, Space } from "@sia-ui/react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";
import { useState } from "react";

const basicCode = `import { Divider } from "@sia-ui/react";

export default function Demo() {
  return <>
    <p>上方内容</p>
    <Divider />
    <p>下方内容</p>
    <Divider textAlign="start">基本信息</Divider>
    <Divider textAlign="center">居中标题</Divider>
    <Divider textAlign="end">操作记录</Divider>
  </>;
}`;

const variantCode = `import { Button, Divider, Space } from "@sia-ui/react";

export default function Demo() {
  return <>
    <Divider variant="solid">实线</Divider>
    <Divider variant="dashed">虚线</Divider>
    <Divider variant="dotted" plain>点线</Divider>
    <Space>
      <Button variant="text">编辑</Button>
      <Divider orientation="vertical" />
      <Button variant="text">复制</Button>
      <Divider orientation="vertical" variant="dashed" />
      <Button variant="text" danger>删除</Button>
    </Space>
  </>;
}`;

const apiRows = [
  { property: "orientation", description: "分割线方向", type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'" },
  { property: "variant", description: "线条样式", type: "'solid' | 'dashed' | 'dotted'", defaultValue: "'solid'" },
  { property: "textAlign", description: "文字在横向分割线中的位置", type: "'start' | 'center' | 'end'", defaultValue: "'center'" },
  { property: "plain", description: "使用普通字重", type: "boolean", defaultValue: "false" },
  { property: "children", description: "分割线文字", type: "ReactNode", defaultValue: "-" },
] as const;

export function DividerPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  return <>
    <PageHeader eyebrow="组件 / 通用 / Divider" title="Divider 分割条" description="分隔不同内容区域，支持文字、对齐、线型和垂直方向。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="基础与文字位置" description="无文字时是一条完整分割线，也可以把标题放在开始、中间或末尾。" code={basicCode}>
        <div className="divider-demo-copy">上方内容</div>
        <Divider />
        <div className="divider-demo-copy">下方内容</div>
        <Divider textAlign="start">基本信息</Divider>
        <Divider>居中标题</Divider>
        <Divider textAlign="end">操作记录</Divider>
      </DemoCard>
      <DemoCard title="线型与垂直分割" description="实线、虚线和点线可用于不同层级，垂直分割线适合紧凑操作区。" code={variantCode}>
        <Divider variant="solid">实线</Divider>
        <Divider variant="dashed">虚线</Divider>
        <Divider variant="dotted" plain>点线</Divider>
        <Space>
          <Button variant="text">编辑</Button>
          <Divider orientation="vertical" />
          <Button variant="text">复制</Button>
          <Divider orientation="vertical" variant="dashed" />
          <Button variant="text" danger>删除</Button>
        </Space>
      </DemoCard>
    </div> : <ApiTable name="Divider" rows={apiRows} />}
  </>;
}
