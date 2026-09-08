import { useState } from "react";
import { Space, Typography } from "@sia-ui/react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const { Title, Paragraph, Text, Link } = Typography;
const longText = "清晰的排版帮助用户理解信息的层级。标题概括主题，正文提供细节，辅助文字补充说明。保持合适的字号、行高与段落间距，可以让长内容更加易读。内容较长时，可以使用省略和展开功能，在有限空间内呈现必要信息。";
const apiRows = [
  { property: "Typography", description: "排版容器，提供统一文字颜色和行高", type: "HTMLAttributes<HTMLDivElement>", defaultValue: "-" },
  { property: "Title.level", description: "标题等级，对应 h1 至 h5", type: "1 | 2 | 3 | 4 | 5", defaultValue: "1" },
  { property: "Text / Paragraph", description: "行内文本 / 段落", type: "TypographyProps", defaultValue: "span / p" },
  { property: "type", description: "辅助、成功、警告或危险文本", type: "'secondary' | 'success' | 'warning' | 'danger'", defaultValue: "-" },
  { property: "strong / italic / underline / delete", description: "加粗、斜体、下划线、删除线", type: "boolean", defaultValue: "false" },
  { property: "mark / code / keyboard", description: "高亮、行内代码、键盘样式", type: "boolean", defaultValue: "false" },
  { property: "disabled", description: "禁用样式及复制、编辑操作", type: "boolean", defaultValue: "false" },
  { property: "copyable", description: "复制完整文本，可指定复制内容和成功回调", type: "boolean | { text?: string; onCopy?: () => void }", defaultValue: "false" },
  { property: "editable", description: "纯文本编辑；text 用于受控内容，onChange 在保存时触发", type: "boolean | { text?: string; onChange?: (text: string) => void; maxLength?: number }", defaultValue: "false" },
  { property: "ellipsis", description: "单行或多行省略，可展开和收起", type: "boolean | { rows?: number; expandable?: boolean }", defaultValue: "false" },
  { property: "Link.href / target / disabled", description: "链接地址、打开方式和禁用状态", type: "string / string / boolean", defaultValue: "-" },
] as const;

export function TypographyPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [text, setText] = useState("点击右侧编辑按钮，修改这段文字。");
  const [copyCount, setCopyCount] = useState(0);
  return <>
    <PageHeader eyebrow="组件 / 通用 / Typography" title="Typography 排版" description="统一标题、正文与辅助文本的视觉层级，支持复制、编辑与省略展开。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "api" ? <ApiTable name="Typography" rows={apiRows} /> : <div className="demo-stack">
      <DemoCard title="标题层级" description="五级标题使用真实的标题语义，建立清晰的信息层次。" code={'import { Typography } from "@sia-ui/react";\n\n<Typography.Title level={1}>一级标题</Typography.Title>\n<Typography.Title level={2}>二级标题</Typography.Title>\n<Typography.Title level={3}>三级标题</Typography.Title>\n<Typography.Title level={4}>四级标题</Typography.Title>\n<Typography.Title level={5}>五级标题</Typography.Title>'}>
        <Title>一级标题 · Sia Design</Title><Title level={2}>二级标题 · 页面章节</Title><Title level={3}>三级标题 · 内容分组</Title><Title level={4}>四级标题 · 小节标题</Title><Title level={5}>五级标题 · 局部说明</Title>
      </DemoCard>
      <DemoCard title="段落与文本状态" description="正文、辅助说明与状态信息共用主题令牌。" code={'<Typography.Paragraph>正文内容</Typography.Paragraph>\n<Typography.Text type="secondary">辅助说明</Typography.Text>\n<Typography.Text type="success">操作成功</Typography.Text>\n<Typography.Text type="warning">请留意</Typography.Text>\n<Typography.Text type="danger">操作失败</Typography.Text>'}>
        <Paragraph>{longText}</Paragraph>
        <Space wrap><Text>默认文本</Text><Text type="secondary">辅助说明</Text><Text type="success">操作成功</Text><Text type="warning">请留意</Text><Text type="danger">操作失败</Text><Text disabled>禁用文本</Text></Space>
      </DemoCard>
      <DemoCard title="文字修饰与链接" description="可组合使用语义化文字修饰，链接支持键盘访问和禁用状态。" code={'<Typography.Text strong>加粗</Typography.Text>\n<Typography.Text mark>高亮</Typography.Text>\n<Typography.Text code>npm run dev</Typography.Text>\n<Typography.Text keyboard>Ctrl + C</Typography.Text>\n<Typography.Link href="/components/button">查看按钮组件</Typography.Link>'}>
        <Space wrap size={20}><Text strong>加粗</Text><Text italic>斜体</Text><Text underline>下划线</Text><Text delete>删除线</Text><Text mark>高亮文字</Text><Text code>npm run dev</Text><Text keyboard>Ctrl + C</Text><Link href="/components/button">查看按钮组件</Link><Link disabled href="/components/button">禁用链接</Link></Space>
      </DemoCard>
      <DemoCard title="复制与编辑" description="复制按钮提供成功反馈。编辑时 Enter 保存，Shift + Enter 换行，Esc 取消。" code={'const [text, setText] = useState("这段内容可以编辑");\n\n<Typography.Paragraph copyable>这段内容可以复制</Typography.Paragraph>\n<Typography.Paragraph editable={{ text, onChange: setText }}>{text}</Typography.Paragraph>'}>
        <Paragraph copyable={{ onCopy: () => setCopyCount((count) => count + 1) }}>SiaWebUI · 可复制的完整文本</Paragraph>
        <Paragraph editable={{ text, onChange: setText, maxLength: 200 }}>{text}</Paragraph>
        <Text type="secondary">已成功复制 {copyCount} 次；编辑内容最多 200 字。</Text>
      </DemoCard>
      <DemoCard title="省略与展开" description="根据容器宽度省略长内容；展开按钮只在实际溢出时出现，复制始终获取全文。" code={'<Typography.Paragraph ellipsis>单行省略内容……</Typography.Paragraph>\n<Typography.Paragraph ellipsis={{ rows: 2, expandable: true }} copyable>多行内容……</Typography.Paragraph>'}>
        <div style={{ maxWidth: 460 }}><Paragraph ellipsis>{longText}</Paragraph><Paragraph ellipsis={{ rows: 2, expandable: true }} copyable>{longText.repeat(3)}</Paragraph></div>
      </DemoCard>
    </div>}
  </>;
}
