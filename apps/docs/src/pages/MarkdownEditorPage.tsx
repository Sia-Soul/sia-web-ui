import { useState } from "react";
import { MarkdownEditor, Space, Tag, message } from "@sia-ui/react";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const initialMarkdown = `# 产品需求说明

## 验收标准

- [x] 支持所见即所得编辑
- [x] 支持 Markdown 源码模式
- [ ] 补充业务截图

| 能力 | 状态 |
| --- | --- |
| 智能粘贴 | 已支持 |
| 图片上传 | 可配置 |
`;

const editorCode = `import { useState } from "react";
import { MarkdownEditor, message } from "@sia-ui/react";

export default function Demo() {
  const [value, setValue] = useState("# 产品需求说明");
  return <MarkdownEditor
    value={value}
    onChange={setValue}
    mode="wysiwyg"
    minHeight={420}
    smartMarkdownPaste
    saveShortcut={() => message.success("草稿已保存")}
    onUploadImage={(file) => URL.createObjectURL(file)}
  />;
}`;

export function MarkdownEditorPage() {
  const [value, setValue] = useState(initialMarkdown);

  return <ComponentDocPage
    eyebrow="组件 / 数据录入 / MarkdownEditor"
    title="MarkdownEditor Markdown 编辑器"
    description="提供所见即所得、即时渲染和源码三种模式，并支持智能 Markdown 粘贴、图片上传与保存快捷键。"
    name="MarkdownEditor"
    apiRows={[
      { property: "value / defaultValue", description: "受控 Markdown 或初始内容", type: "string", defaultValue: "''" },
      { property: "mode", description: "所见即所得、即时渲染或源码模式", type: "'wysiwyg' | 'ir' | 'sv'", defaultValue: "'wysiwyg'" },
      { property: "placeholder", description: "空内容提示", type: "string", defaultValue: "'请输入 Markdown 正文'" },
      { property: "minHeight", description: "编辑器最小高度", type: "number | string", defaultValue: "320" },
      { property: "disabled", description: "禁用编辑器", type: "boolean", defaultValue: "false" },
      { property: "ariaLabel", description: "编辑区域的无障碍名称", type: "string", defaultValue: "'Markdown 编辑器'" },
      { property: "assetBaseUrl", description: "Vditor 静态资源地址；不传时使用组件库已安装的版本", type: "string", defaultValue: "内置依赖" },
      { property: "saveShortcut", description: "按 Ctrl / Command + S 时执行", type: "() => void", defaultValue: "-" },
      { property: "onUploadImage", description: "上传图片并返回图片地址；配置后显示上传按钮", type: "(file: File) => string | Promise<string>", defaultValue: "-" },
      { property: "smartMarkdownPaste", description: "识别剪贴板 Markdown 并保留语法结构", type: "boolean", defaultValue: "true" },
      { property: "onChange", description: "Markdown 内容变化回调", type: "(markdown: string) => void", defaultValue: "-" },
    ]}
  >
    <DemoCard title="全功能 Markdown 编辑" description="工具栏包含标题、文本格式、列表、引用、代码、表格、预览、目录和全屏操作。" code={editorCode}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div style={{ width: "100%", height: 460 }}>
          <MarkdownEditor
            value={value}
            onChange={setValue}
            minHeight={420}
            smartMarkdownPaste
            saveShortcut={() => message.success("草稿已保存")}
            onUploadImage={(file) => URL.createObjectURL(file)}
          />
        </div>
        <Tag status="processing">当前 {value.length} 个字符</Tag>
      </Space>
    </DemoCard>
    <DemoCard title="编辑模式" description="mode 可按写作习惯切换即时渲染和纯源码模式。" code={`<Space direction="vertical">
  <MarkdownEditor mode="ir" defaultValue="## 即时渲染模式" />
  <MarkdownEditor mode="sv" defaultValue="## 源码模式" />
</Space>`}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div style={{ width: "100%", height: 300 }}><MarkdownEditor mode="ir" defaultValue="## 即时渲染模式\n\n保留 Markdown 标记并同步渲染。" minHeight={260} /></div>
        <div style={{ width: "100%", height: 300 }}><MarkdownEditor mode="sv" defaultValue="## 源码模式\n\n直接编辑 Markdown 源码。" minHeight={260} /></div>
      </Space>
    </DemoCard>
  </ComponentDocPage>;
}
