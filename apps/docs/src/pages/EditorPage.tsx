import { useState } from "react";
import { Editor } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const DEFAULT_MARKDOWN = `# 产品需求文档

## 背景

使用统一编辑器编写 PRD、需求说明和日常记录。

- [ ] 补充验收标准
- [ ] 关联项目任务
`;

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  wordWrap: "on" as const,
};

const basicCode = `import { useState } from "react";
import { Editor } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [value, setValue] = useState("# 产品需求文档");
  return <div style={{ height: 360 }}>
    <Editor language="markdown" value={value} onChange={setValue} />
  </div>;
}`;

const apiRows = [
  { property: "value", description: "编辑器内容", type: "string", defaultValue: "-" },
  { property: "onChange", description: "内容变化回调", type: "(value: string) => void", defaultValue: "-" },
  { property: "language", description: "Monaco 语言标识", type: "string", defaultValue: "'plaintext'" },
  { property: "theme", description: "编辑器主题", type: "'light' | 'dark'", defaultValue: "'light'" },
  { property: "options", description: "Monaco 编辑器配置", type: "IStandaloneEditorConstructionOptions", defaultValue: "-" },
  { property: "markers", description: "在指定文本范围显示错误、警告或信息波浪线", type: "readonly EditorMarker[]", defaultValue: "[]" },
  { property: "completionProvider", description: "按当前文本和光标上下文异步提供智能提示", type: "EditorCompletionProvider", defaultValue: "-" },
  { property: "completionTriggerCharacters", description: "主动触发智能提示的字符", type: "readonly string[]", defaultValue: "['.']" },
  { property: "refreshSuggestionOnSpace", description: "按空格时正常输入空格、关闭当前提示，并根据新的光标位置重新触发智能提示", type: "boolean", defaultValue: "false" },
  { property: "EditorCompletionItem.commitCharacters", description: "输入指定字符时接受当前选中的提示项", type: "readonly string[]", defaultValue: "-" },
  { property: "onKeyDown", description: "编辑器键盘事件，可拦截快捷键并执行自定义操作", type: "(event: EditorKeyDownEvent) => void", defaultValue: "-" },
  { property: "onReady", description: "返回选择区、插入、定位和聚焦命令", type: "(api: EditorHandle | null) => void", defaultValue: "-" },
  { property: "EditorHandle.replaceValue", description: "以一次可撤销编辑替换全文，适用于格式化等操作", type: "(content: string) => void", defaultValue: "-" },
] as const;

export function EditorPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [value, setValue] = useState(DEFAULT_MARKDOWN);

  return <>
    <PageHeader eyebrow="组件 / 数据录入 / Editor" title="Editor 编辑器" description="基于 Monaco 封装的通用编辑器，业务层无需直接管理实例、模型、Worker 与主题。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="Markdown 编辑" description="编辑器按需加载 Monaco，并暴露受控值与常用命令。" code={basicCode}>
        <div style={{ width: "100%", height: 360, border: "1px solid var(--sia-color-border)", borderRadius: 6, overflow: "hidden" }}>
          <Editor
            ariaLabel="Markdown 示例编辑器"
            language="markdown"
            path="inmemory://sia-docs/editor-demo.md"
            value={value}
            options={EDITOR_OPTIONS}
            onChange={setValue}
          />
        </div>
      </DemoCard>
    </div> : <ApiTable name="Editor" rows={apiRows} />}
  </>;
}
