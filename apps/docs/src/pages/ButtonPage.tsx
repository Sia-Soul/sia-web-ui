import { useState } from "react";
import { Button, Icon, SIA_THEME, Space } from "@sia.soul/sia-react-ui";
import type { ButtonSize } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

function getButtonTypeCode(size: ButtonSize) {
  const sizeProp = size === "medium" ? "" : ` size="${size}"`;
  return `import { Button, Space } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <Space size={14} wrap>
      <Button${sizeProp} variant="primary">主要按钮</Button>
      <Button${sizeProp}>默认按钮</Button>
      <Button${sizeProp} variant="dashed">虚线按钮</Button>
      <Button${sizeProp} variant="text">文本按钮</Button>
      <Button${sizeProp} variant="link">链接按钮</Button>
    </Space>
  );
}`;
}

const buttonStateCode = `import { Button, Icon, Space } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <Space size={14} wrap>
      <Button variant="primary" icon={<Icon name="plus" />}>新建项目</Button>
      <Button icon={<Icon name="download" />} iconPosition="end">下载</Button>
      <Button loading>正在提交</Button>
      <Button danger icon={<Icon name="trash" />}>删除</Button>
      <Button variant="primary" danger>确认删除</Button>
      <Button disabled>禁用按钮</Button>
    </Space>
  );
}`;

const tokenRows = [
  ["--sia-color-primary", "主色", SIA_THEME.colorPrimary, "主要按钮背景色、链接色"],
  ["--sia-color-primary-hover", "主色悬停", SIA_THEME.colorPrimaryHover, "主要按钮悬停背景色"],
  ["--sia-color-primary-active", "主色激活", SIA_THEME.colorPrimaryActive, "主要按钮激活背景色"],
  ["--sia-control-height", "控件高度", `${SIA_THEME.controlHeight}px`, "中号控件默认高度"],
];

const apiRows = [
  { property: "variant", description: "按钮视觉类型", type: "'primary' | 'default' | 'dashed' | 'filled' | 'text' | 'link'", defaultValue: "'default'" },
  { property: "size", description: "small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
  { property: "loading", description: "显示加载状态并禁止重复点击", type: "boolean", defaultValue: "false" },
  { property: "danger", description: "危险操作样式", type: "boolean", defaultValue: "false" },
  { property: "icon", description: "按钮图标", type: "ReactNode", defaultValue: "-" },
  { property: "iconPosition", description: "图标位置", type: "'start' | 'end'", defaultValue: "'start'" },
  { property: "block", description: "宽度撑满父容器", type: "boolean", defaultValue: "false" },
] as const;

export function ButtonPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [size, setSize] = useState<ButtonSize>("medium");

  return (
    <>
      <PageHeader eyebrow="组件 / 通用 / Button" title="Button 按钮" description="用于触发一个即时操作。" />
      <DocsTabs activeKey={tab} onChange={setTab} />

      {tab === "examples" ? <>
        <DemoCard
          className="playground-card"
          title="按钮类型"
          description="提供五种按钮类型：主要按钮、默认按钮、虚线按钮、文本按钮、链接按钮。"
          code={getButtonTypeCode(size)}
        >
          <div className="size-control" aria-label="按钮尺寸">
            {(["small", "medium", "large"] as ButtonSize[]).map((value) => <button key={value} className={size === value ? "active" : ""} onClick={() => setSize(value)}>{value === "small" ? "小" : value === "medium" ? "中" : "大"}</button>)}
          </div>
          <Space size={14} wrap className="button-demo">
            <Button size={size} variant="primary">主要按钮</Button>
            <Button size={size}>默认按钮</Button>
            <Button size={size} variant="dashed">虚线按钮</Button>
            <Button size={size} variant="text">文本按钮</Button>
            <Button size={size} variant="link">链接按钮</Button>
          </Space>
        </DemoCard>

        <DemoCard className="secondary-demo-card" title="图标、状态与危险操作" description="加载态会阻止重复触发，危险态使用统一错误色。" code={buttonStateCode}>
          <Space size={14} wrap className="component-demo">
            <Button variant="primary" icon={<Icon name="plus" size={16} />}>新建项目</Button>
            <Button icon={<Icon name="download" size={16} />} iconPosition="end">下载</Button>
            <Button loading>正在提交</Button>
            <Button danger icon={<Icon name="trash" size={16} />}>删除</Button>
            <Button variant="primary" danger>确认删除</Button>
            <Button disabled>禁用按钮</Button>
          </Space>
        </DemoCard>

        <section className="token-section" id="button-tokens">
          <h2>组件令牌</h2>
          <p>这里只列出 Button 自己使用的令牌；完整令牌表位于独立的“设计令牌”页面。</p>
          <div className="token-table" role="table" aria-label="按钮设计令牌">
            <div className="token-head" role="row"><span>令牌名</span><span>描述</span><span>值</span><span>用途</span></div>
            {tokenRows.map(([name, description, value, usage]) => <div className="token-row" role="row" key={name}>
              <code>{name}</code><span>{description}</span><span className="token-value">{value.startsWith("#") ? <i style={{ background: value }} /> : null}{value}</span><span>{usage}</span>
            </div>)}
          </div>
        </section>
      </> : <ApiTable name="Button" rows={apiRows} />}
    </>
  );
}
