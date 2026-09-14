import { Markdown } from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const markdown = `# 版本 2.0 发布说明

Sia Web UI 新增了 **Markdown 渲染**、富文本编辑器和日期组合查询组件。

> Markdown 内容会先经过安全净化，再输出到页面。

## 能力清单

- 支持 GFM 表格和任务列表
- 支持代码块与行内代码
- 支持图片懒加载和点击预览

| 模块 | 状态 |
| --- | --- |
| 文档渲染 | 已完成 |
| 图片预览 | 已完成 |

\`\`\`tsx
<Markdown content={content} />
\`\`\``;

const markdownCode = `import { Markdown } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <Markdown content={\`# 发布说明

- 支持 GFM
- 自动净化 HTML
\`} />;
}`;

export function MarkdownPage() {
  return <ComponentDocPage
    eyebrow="组件 / 数据展示 / Markdown"
    title="Markdown 内容渲染"
    description="安全渲染 GFM Markdown，内置排版样式、异步图片地址解析和图片预览。"
    name="Markdown"
    apiRows={[
      { property: "content", description: "需要渲染的 Markdown 内容", type: "string", defaultValue: "-" },
      { property: "emptyText", description: "内容为空时显示的占位内容", type: "ReactNode", defaultValue: "'暂无 Markdown 内容'" },
      { property: "resolveImageSrc", description: "图片加载失败时异步解析真实地址", type: "(src: string) => string | Promise<string>", defaultValue: "-" },
      { property: "imagePreview", description: "允许点击或键盘打开图片预览", type: "boolean", defaultValue: "true" },
    ]}
  >
    <DemoCard title="GFM 内容渲染" description="支持标题、列表、引用、表格、任务和代码块，危险 HTML 会被自动清理。" code={markdownCode}>
      <div className="card-demo-surface"><Markdown content={markdown} /></div>
    </DemoCard>
    <DemoCard title="空内容与图片地址解析" description="resolveImageSrc 适合把附件标识或私有协议转换为临时访问地址。" code={`<Markdown
  content="![架构图](attachment://architecture)"
  resolveImageSrc={(src) => resolveAttachment(src)}
  imagePreview
/>`}>
      <Markdown content="" emptyText="还没有可展示的文档" />
    </DemoCard>
  </ComponentDocPage>;
}
