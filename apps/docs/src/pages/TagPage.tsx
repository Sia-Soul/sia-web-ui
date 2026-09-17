import { Button, Form, Icon, Space, Tag } from "@sia.soul/sia-react-ui";
import type { TagVariant } from "@sia.soul/sia-react-ui";
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
  { property: "size", description: "small / medium / large 最小高度为 20 / 24 / 32px；显式 size > compact=true > Form 尺寸 > medium", type: "'small' | 'medium' | 'large'", defaultValue: "继承 Form，否则 medium" },
  { property: "color", description: "自定义 CSS 基色，覆盖 status 的颜色；variant 决定呈现形式，style 可进一步覆盖", type: "string", defaultValue: "-" },
  { property: "status", description: "语义状态", type: "'default' | 'success' | 'processing' | 'warning' | 'error'", defaultValue: "'default'" },
  { property: "variant", description: "soft 浅色背景；outlined 彩色描边、透明背景；filled 实色背景、白字。同样适用于 color", type: "'soft' | 'outlined' | 'filled'", defaultValue: "'soft'" },
  { property: "icon", description: "标签前置图标", type: "ReactNode", defaultValue: "-" },
  { property: "closeOnHover", description: "配合 closable：默认隐藏且不占位，悬停或键盘聚焦时向右展开，离开后收回（180ms）；禁用不展开，触屏直接显示", type: "boolean", defaultValue: "false" },
  { property: "closable / onClose", description: "显示关闭按钮及其回调", type: "boolean / (event) => void", defaultValue: "false / -" },
  { property: "compact", description: "兼容旧版，未显式设置 size 时等同 small；新代码建议使用 size", type: "boolean", defaultValue: "false" },
  { property: "disabled", description: "禁用关闭操作", type: "boolean", defaultValue: "false" },
] as const;

// 示例同时展示颜色作用方式和业务 style 的覆盖顺序。
const colorCode = `<Tag color="#1677ff">柔和蓝色（默认）</Tag>
<Tag color="#1677ff" variant="outlined">蓝色边框</Tag>
<Tag color="#1677ff" variant="filled">蓝色背景</Tag>
<Tag color="#722ed1" variant="filled" closable>紫色背景</Tag>
<Tag color="var(--sia-color-success)" variant="outlined">主题变量</Tag>
<Tag color="#fff1b8" variant="filled" style={{ color: "#614700" }}>浅色背景搭配深色文字</Tag>`;

// 示例显式开启已有属性，与常驻关闭按钮对照；业务方在 onClose 后移除标签。
const hoverCloseCode = `const [visible, setVisible] = useState(true);

{visible && <Tag
  color="#1677ff"
  variant="outlined"
  closable
  closeOnHover
  onClose={() => setVisible(false)}
>
  移入展开关闭按钮
</Tag>}`;

// size 与颜色、视觉样式独立，表单上下文可统一设置，单个标签仍可覆盖。
const sizeCode = `<Tag size="small">小号标签</Tag>
<Tag size="medium">中号标签</Tag>
<Tag size="large">大号标签</Tag>

<Form size="large">
  <Tag>继承表单大号</Tag>
  <Tag size="small">显式小号优先</Tag>
  <Tag compact>兼容紧凑标签</Tag>
</Form>`;

/** 标签文档包含尺寸继承、自定义配色及常驻/悬停展开的关闭交互。 */
export function TagPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [tags, setTags] = useState(["React", "TypeScript", "Vite"]);
  const [hoverTags, setHoverTags] = useState<readonly TagVariant[]>(["soft", "outlined", "filled"]);
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
      <DemoCard title="标签尺寸" description="small、medium、large 最小高度分别为 20、24、32px。未指定时继承 Form；compact 兼容旧版小号，显式 size 优先。" code={sizeCode}>
        <Space direction="vertical" size={16}>
          <Space wrap>
            <Tag size="small" color="#1677ff">小号标签</Tag>
            <Tag size="medium" color="#1677ff">中号标签</Tag>
            <Tag size="large" color="#1677ff">大号标签</Tag>
          </Space>
          <Form size="large"><Space wrap>
            <Tag color="#722ed1" variant="outlined">继承表单大号</Tag>
            <Tag size="small" color="#722ed1" variant="outlined">显式小号优先</Tag>
            <Tag compact color="#722ed1" variant="outlined">兼容紧凑标签</Tag>
          </Space></Form>
        </Space>
      </DemoCard>
      <DemoCard title="自定义颜色" description="color 指定基色，variant 统一决定浅底、描边或实色效果；默认 soft。自定义颜色覆盖 status，style 可进一步调整文字等细节。" code={colorCode}>
        <Space wrap>
          <Tag color="#1677ff">柔和蓝色（默认）</Tag>
          <Tag color="#1677ff" variant="outlined">蓝色边框</Tag>
          <Tag color="#1677ff" variant="filled">蓝色背景</Tag>
          <Tag color="#722ed1" variant="filled" closable>紫色背景</Tag>
          <Tag color="var(--sia-color-success)" variant="outlined">主题变量</Tag>
          <Tag color="#fff1b8" variant="filled" style={{ color: "#614700" }}>浅色背景搭配深色文字</Tag>
        </Space>
      </DemoCard>
      <DemoCard title="悬停展开关闭按钮" description="开启 closable 和 closeOnHover 后，关闭按钮默认隐藏且不占宽度；移入标签后向右展开，移出后收回。键盘聚焦也可展开，触屏直接显示。" code={hoverCloseCode}>
        <Space wrap>
          {hoverTags.map(variant => <Tag key={variant} color="#1677ff" variant={variant} closable closeOnHover onClose={() => setHoverTags(items => items.filter(item => item !== variant))}>
            {variant === "soft" ? "柔和标签" : variant === "outlined" ? "描边标签" : "实色标签"}
          </Tag>)}
          <Tag color="#1677ff" closable closeOnHover disabled>禁用时不展开</Tag>
          <Button size="small" onClick={() => setHoverTags(["soft", "outlined", "filled"])}>重置标签</Button>
        </Space>
      </DemoCard>
      <DemoCard title="可关闭标签" description="未开启 closeOnHover 时关闭按钮常驻；关闭按钮阻止事件冒泡，并可通过 onClose 同步业务状态。" code={closeCode}>
        <Space wrap>
          {tags.map((tag) => <Tag key={tag} closable onClose={() => setTags((items) => items.filter((item) => item !== tag))}>{tag}</Tag>)}
          {tags.length === 0 ? <span className="demo-result">标签已全部移除</span> : null}
        </Space>
      </DemoCard>
    </div> : <ApiTable name="Tag" rows={apiRows} />}
  </>;
}
