import { SIA_THEME } from "@sia-ui/react";
import { PageHeader } from "./PageHeader";

const tokenRows = [
  ["--sia-color-primary", "主色", SIA_THEME.colorPrimary, "品牌色与主要操作"],
  ["--sia-color-primary-hover", "主色悬停", SIA_THEME.colorPrimaryHover, "主要操作悬停状态"],
  ["--sia-color-primary-active", "主色激活", SIA_THEME.colorPrimaryActive, "主要操作按下状态"],
  ["--sia-control-height", "控件高度", `${SIA_THEME.controlHeight}px`, "中号控件默认高度"],
  ["--sia-radius", "基础圆角", `${SIA_THEME.borderRadius}px`, "按钮、输入框与卡片圆角"],
];

export function TokensPage() {
  return (
    <>
      <PageHeader eyebrow="设计系统 / Tokens" title="设计令牌" description="用统一变量管理颜色、尺寸、圆角与阴影。" />
      <section className="token-section standalone-section">
        <h2>基础令牌</h2>
        <p>组件优先消费语义化变量，主题切换时无需修改组件实现。</p>
        <div className="token-table" role="table" aria-label="设计令牌">
          <div className="token-head" role="row"><span>令牌名</span><span>描述</span><span>值</span><span>用途</span></div>
          {tokenRows.map(([name, description, value, usage]) => <div className="token-row" role="row" key={name}>
            <code>{name}</code><span>{description}</span><span className="token-value">{value.startsWith("#") ? <i style={{ background: value }} /> : null}{value}</span><span>{usage}</span>
          </div>)}
        </div>
      </section>
    </>
  );
}
