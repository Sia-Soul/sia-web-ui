import { useState } from "react";
import { TextArea } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const basicCode = `import { useState } from "react";
import { TextArea } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [value, setValue] = useState("");
  return <TextArea
    value={value}
    onChange={(event) => setValue(event.target.value)}
    rows={5}
    maxLength={500}
    showCount
    placeholder="请输入项目说明"
  />;
}`;

const apiRows = [
  { property: "size", description: "调整字号和内边距；保留 rows 和内容决定的多行高度。默认继承 Form", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
  { property: "status", description: "校验状态", type: "'default' | 'warning' | 'error'", defaultValue: "'default'" },
  { property: "rows", description: "默认可见行数", type: "number", defaultValue: "2" },
  { property: "maxLength", description: "允许输入的最大字符数", type: "number", defaultValue: "-" },
  { property: "showCount", description: "显示当前字符数", type: "boolean", defaultValue: "false" },
  { property: "label", description: "字段标签", type: "ReactNode", defaultValue: "-" },
  { property: "hint", description: "帮助或校验信息", type: "ReactNode", defaultValue: "-" },
] as const;

export function TextAreaPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [value, setValue] = useState("项目用于统一管理工作台、任务、BUG 与文档。");

  return <>
    <PageHeader eyebrow="组件 / 数据录入 / TextArea" title="TextArea 多行输入框" description="录入项目说明、备注等多行文本，并统一处理状态与字符计数。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="基础用法" description="支持受控值、最大长度和字符计数。" code={basicCode}>
        <div className="component-demo component-demo--column demo-control-width">
          <TextArea
            aria-label="项目说明"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={5}
            maxLength={500}
            showCount
            placeholder="请输入项目说明"
          />
        </div>
      </DemoCard>
      <DemoCard title="字段状态" description="与 Input 和 Form.Item 使用相同的状态语义。" code={`<TextArea status="error" hint="请输入项目说明" />`}>
        <div className="component-demo demo-grid">
          <TextArea label="备注" hint="最多输入 200 个字符" rows={3} maxLength={200} showCount />
          <TextArea label="项目说明" status="error" hint="请输入项目说明" rows={3} />
        </div>
      </DemoCard>
    </div> : <ApiTable name="TextArea" rows={apiRows} />}
  </>;
}
