import { useState } from "react";
import { Button, RichTextContent, RichTextEditor, Space, message } from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const initialHtml = `<h2>版本发布说明</h2>
<p>本次发布完善了<strong>编辑器</strong>、日期筛选和数据展示能力。</p>
<ul><li><p>支持基础文本格式</p></li><li><p>支持列表与链接</p></li></ul>`;

const initialMarkdown = `## 迭代计划

- [x] 完成交互设计
- [ ] 补充测试用例

> 使用 Ctrl / Command + S 触发保存。`;

const basicCode = `import { useState } from "react";
import { RichTextContent, RichTextEditor } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [value, setValue] = useState("<p>开始编辑内容</p>");
  return <>
    <RichTextEditor value={value} onChange={setValue} />
    <RichTextContent content={value} />
  </>;
}`;

const fullCode = `import { useState } from "react";
import { RichTextEditor, message } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [value, setValue] = useState("## 迭代计划");
  return <RichTextEditor
    toolbar="full"
    contentFormat="markdown"
    value={value}
    onChange={setValue}
    minHeight={260}
    saveShortcut={() => message.success("内容已保存")}
    onPasteImage={(file) => URL.createObjectURL(file)}
  />;
}`;

export function RichTextEditorPage() {
  const [html, setHtml] = useState(initialHtml);
  const [markdown, setMarkdown] = useState(initialMarkdown);

  return <ComponentDocPage
    eyebrow="组件 / 数据录入 / RichTextEditor"
    title="RichTextEditor 富文本编辑器"
    description="基于 Tiptap 的轻量富文本编辑器，支持 HTML、Markdown、完整工具栏、表格和图片粘贴。"
    name="RichTextEditor"
    apiRows={[
      { property: "value / defaultValue", description: "受控内容或初始内容", type: "string", defaultValue: "''" },
      { property: "contentFormat", description: "输入和输出的内容格式", type: "'html' | 'markdown'", defaultValue: "'html'" },
      { property: "toolbar", description: "基础或完整格式工具栏", type: "'basic' | 'full'", defaultValue: "'basic'" },
      { property: "placeholder", description: "空内容提示", type: "string", defaultValue: "'请输入内容'" },
      { property: "minHeight", description: "编辑区域最小高度", type: "number | string", defaultValue: "150" },
      { property: "disabled", description: "禁用编辑和工具栏", type: "boolean", defaultValue: "false" },
      { property: "onChange", description: "内容变化回调，格式由 contentFormat 决定", type: "(content: string) => void", defaultValue: "-" },
      { property: "onPasteImage", description: "处理剪贴板图片并返回可访问地址", type: "(file: File) => string | Promise<string>", defaultValue: "-" },
      { property: "pasteImageHint", description: "图片粘贴能力的工具栏提示", type: "ReactNode", defaultValue: "'可直接粘贴图片'" },
      { property: "saveShortcut", description: "按 Ctrl / Command + S 时执行", type: "() => void", defaultValue: "-" },
      { property: "RichTextContent.content", description: "安全渲染富文本 HTML 内容", type: "string", defaultValue: "-" },
      { property: "RichTextContent.emptyText", description: "空内容时的占位内容", type: "ReactNode", defaultValue: "'暂无内容'" },
    ]}
  >
    <DemoCard title="编辑与安全预览" description="基础工具栏适合评论和说明字段；下方 RichTextContent 使用同一份受控内容。" code={basicCode}>
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <RichTextEditor value={html} onChange={setHtml} placeholder="请输入发布说明" />
        <div className="card-demo-surface">
          <strong>渲染结果</strong>
          <RichTextContent content={html} />
        </div>
      </Space>
    </DemoCard>
    <DemoCard title="完整工具栏与 Markdown" description="包含撤销重做、标题、链接、任务列表、引用、代码块和可编辑表格；支持图片粘贴与保存快捷键。" code={fullCode}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <RichTextEditor
          toolbar="full"
          contentFormat="markdown"
          value={markdown}
          onChange={setMarkdown}
          minHeight={260}
          saveShortcut={() => message.success("内容已保存")}
          onPasteImage={(file) => URL.createObjectURL(file)}
        />
        <Space>
          <Button size="small" onClick={() => setMarkdown(initialMarkdown)}>恢复示例</Button>
          <span className="demo-result">当前 Markdown：{markdown.length} 个字符</span>
        </Space>
      </Space>
    </DemoCard>
    <DemoCard title="禁用状态" description="禁用时保留内容可读性，同时关闭编辑和格式操作。" code={`<RichTextEditor disabled defaultValue="<p>只读内容</p>" />`}>
      <RichTextEditor disabled defaultValue="<p>这是一段不可编辑的审批归档内容。</p>" />
    </DemoCard>
  </ComponentDocPage>;
}
