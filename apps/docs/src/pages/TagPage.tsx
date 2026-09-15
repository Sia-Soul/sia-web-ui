import { Icon, Space, Tag } from "@sia.soul/sia-react-ui";
import { useState } from "react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const statusCode = `import { Icon, Space, Tag } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <Space wrap>
    <Tag>默认</Tag>
    <Tag status="processing" icon={<Icon name="loader" spin />}>处理中</Tag>
    <Tag status="success" icon={<Icon name="check" />}>已完成</Tag>
    <Tag status="warning">待确认</Tag>
    <Tag status="error">失败</Tag>
  </Space>;
}`;

const variantCode = `import { Space, Tag } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <Space wrap>
    <Tag status="processing" variant="soft">柔和</Tag>
    <Tag status="processing" variant="outlined">描边</Tag>
    <Tag status="processing" variant="filled">实色</Tag>
    <Tag compact>紧凑</Tag>
    <Tag disabled>禁用</Tag>
  </Space>;
}`;

const closeCode = `import { useState } from "react";
import { Space, Tag } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [tags, setTags] = useState(["React", "TypeScript", "Vite"]);
  return <Space wrap>
    {tags.map((tag) => <Tag key={tag} closable onClose={() => setTags((items) => items.filter((item) => item !== tag))}>{tag}</Tag>)}
  </Space>;
}`;

const apiRows = [
  { property: "status", description: "语义状态", type: "'default' | 'success' | 'processing' | 'warning' | 'error'", defaultValue: "'default'" },
  { property: "variant", description: "视觉样式", type: "'soft' | 'outlined' | 'filled'", defaultValue: "'soft'" },
  { property: "icon", description: "标签前置图标", type: "ReactNode", defaultValue: "-" },
  { property: "closeOnHover", description: "悬停或聚焦时向右展开关闭按钮；QueryForm 的快捷标签默认开启", type: "boolean", defaultValue: "false" },
  { property: "closable / onClose", description: "显示关闭按钮及其回调", type: "boolean / (event) => void", defaultValue: "false / -" },
  { property: "compact", description: "紧凑尺寸", type: "boolean", defaultValue: "false" },
  { property: "disabled", description: "禁用关闭操作", type: "boolean", defaultValue: "false" },
] as const;

export function TagPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [tags, setTags] = useState(["React", "TypeScript", "Vite"]);
  return <>
    <PageHeader eyebrow="组件 / 数据展示 / Tag" title="Tag 标签" description="用于标记状态、属性和可移除的筛选条件。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="语义状态" description="颜色、图标与文字共同表达状态，不只依赖颜色。" code={statusCode}>
        <Space wrap>
          <Tag>默认</Tag>
          <Tag status="processing" icon={<Icon name="loader" size={12} spin />}>处理中</Tag>
          <Tag status="success" icon={<Icon name="check" size={12} />}>已完成</Tag>
          <Tag status="warning">待确认</Tag>
          <Tag status="error">失败</Tag>
        </Space>
      </DemoCard>
      <DemoCard title="样式与尺寸" description="柔和、描边和实色三种样式适配不同信息密度。" code={variantCode}>
        <Space wrap>
          <Tag status="processing">柔和</Tag>
          <Tag status="processing" variant="outlined">描边</Tag>
          <Tag status="processing" variant="filled">实色</Tag>
          <Tag compact>紧凑</Tag>
          <Tag disabled>禁用</Tag>
        </Space>
      </DemoCard>
      <DemoCard title="可关闭标签" description="关闭按钮阻止事件冒泡，并可通过 onClose 同步业务状态。" code={closeCode}>
        <Space wrap>
          {tags.map((tag) => <Tag key={tag} closable onClose={() => setTags((items) => items.filter((item) => item !== tag))}>{tag}</Tag>)}
          {tags.length === 0 ? <span className="demo-result">标签已全部移除</span> : null}
        </Space>
      </DemoCard>
    </div> : <ApiTable name="Tag" rows={apiRows} />}
  </>;
}
