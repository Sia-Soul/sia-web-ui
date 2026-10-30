import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Icon, Input, Select, Table, Tag, ThemeSwitch } from "@sia.soul/sia-react-ui";
import type { IconName, TableColumn } from "@sia.soul/sia-react-ui";
import { SiaMark } from "../Icons";
import { navGroups } from "../navigation";
import "./home.css";

/** 首页主题由文档站统一管理，切换后进入组件页仍保持一致。 */
interface HomePageProps {
  /** 当前是否使用暗色主题。 */
  dark: boolean;
  /** 请求切换全站明暗主题。 */
  onToggleTheme: () => void;
}

// 展示数据仅用于交互演示，不代表真实项目或使用统计。
const projects = [
  { id: "01", name: "品牌工作台", category: "业务系统", status: "进行中", owner: "林" },
  { id: "02", name: "数据分析中心", category: "数据应用", status: "已完成", owner: "陈" },
  { id: "03", name: "内容管理平台", category: "内容工具", status: "进行中", owner: "许" },
  { id: "04", name: "团队资源库", category: "业务系统", status: "待开始", owner: "周" },
];
const previewColumns: TableColumn<(typeof projects)[number]>[] = [
  { key: "name", title: "项目名称", width: 170 },
  { key: "category", title: "类型", width: 115 },
  { key: "status", title: "状态", width: 105, render: (value) => <Tag status={value === "已完成" ? "success" : value === "进行中" ? "processing" : "default"}>{String(value)}</Tag> },
  { key: "owner", title: "负责人", width: 70, render: (value) => <span className="home-avatar">{String(value)}</span> },
];
const highlights: { icon: IconName; title: string; text: string; path: string; label: string }[] = [
  { icon: "table", title: "复杂数据，也能从容处理。", text: "从排序、筛选到行内编辑、单元格框选与虚拟滚动。用插件组合你的业务表格。", path: "/components/table", label: "探索 Table" },
  { icon: "clipboard", title: "把业务规则，放进表单。", text: "字段联动、数据校验、查询条件与多种输入组件，让数据录入拥有一致的交互。", path: "/components/query-form", label: "探索 QueryForm" },
  { icon: "token", title: "一种设计语言，多种表达。", text: "通过设计令牌统一颜色、间距与圆角，让明暗主题、基础控件和复杂界面保持协调。", path: "/design/tokens", label: "查看设计令牌" },
];
const installCommand = "pnpm add @sia.soul/sia-react-ui";
const usageCode = `import { Button } from '@sia.soul/sia-react-ui';\nimport '@sia.soul/sia-react-ui/styles.css';\n\nexport default function App() {\n  return <Button variant="primary">开始创造</Button>;\n}`;

/** 使用局部主题令牌展示相同组件，不改变文档站的全局主题。 */
function ThemePreview({ mode }: { /** 当前预览固定采用的主题模式。 */ mode: "light" | "dark" }) {
  const [search, setSearch] = useState("");
  const isDark = mode === "dark";
  return <article className="home-theme-preview" data-sia-theme={mode} style={{ colorScheme: mode }} aria-label={isDark ? "深色主题预览" : "浅色主题预览"}>
    <div className="home-theme-label"><span>{isDark ? "DARK" : "LIGHT"} / {isDark ? "深色主题" : "浅色主题"}</span><span className="home-theme-swatch" /></div>
    <div className="home-theme-body">
      <div className="home-theme-heading"><div><h3>项目工作台</h3><p>同一套组件，两种清晰表达。</p></div><Tag status="processing">进行中</Tag></div>
      <Input aria-label={`${isDark ? "深色" : "浅色"}预览搜索`} placeholder="搜索项目，体验输入样式" prefix={<Icon name="search" size={16} />} value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="home-theme-table"><Table columns={previewColumns.filter((column) => column.key !== "owner")} dataSource={projects.filter((project) => project.name.includes(search)).slice(0, 3)} rowKey="id" /></div>
      <div className="home-theme-actions"><Button variant="primary" onClick={() => setSearch("数据")}>筛选数据项目</Button><Button onClick={() => setSearch("")}>重置</Button><span>可直接体验</span></div>
    </div>
  </article>;
}

/** 框架公开首页：介绍能力、提供真实组件演示，并引导访客进入文档。 */
export function HomePage({ dark, onToggleTheme }: HomePageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | number>("全部状态");
  const [copyState, setCopyState] = useState("");
  // 清空筛选与“全部状态”等价，避免空值导致示例表格意外变空。
  const rows = useMemo(() => projects.filter((item) => item.name.includes(query) && (!status || status === "全部状态" || item.status === status)), [query, status]);
  // 目录只展示已实现的组件路由，不混入介绍与快速开始占位页。
  const groups = navGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.path.startsWith("/components/")) })).filter((group) => group.items.length > 0);
  const componentCount = new Set(groups.flatMap((group) => group.items.map((item) => item.path))).size;

  /** 复制安装命令；浏览器拒绝剪贴板权限时保留可手动选择的原文。 */
  async function copyInstall() {
    try { await navigator.clipboard.writeText(installCommand); setCopyState("安装命令已复制"); }
    catch { setCopyState("复制未成功，请选择左侧命令手动复制"); }
  }

  return <div className="home-page">
    <a className="home-skip" href="#home-main">跳转到正文</a>
    <header className="home-nav">
      <Link to="/" className="home-brand" aria-label="Sia Web UI 首页"><SiaMark /><strong>Sia Web UI</strong><span>REACT</span></Link>
      <nav aria-label="首页导航"><a href="#capabilities">框架能力</a><Link to="/components/button">组件文档</Link><Link to="/design/tokens">设计系统</Link></nav>
      <div className="home-nav-actions"><ThemeSwitch checked={dark} onCheckedChange={onToggleTheme} lightLabel="切换到暗色" darkLabel="切换到亮色" /><a href="https://gitee.com/xhmyun/sia-web-ui" target="_blank" rel="noreferrer" className="home-source">Gitee <Icon name="arrow-right" size={14} /></a></div>
    </header>
    <main id="home-main">
      <section className="home-hero">
        <div className="home-hero-copy"><div className="home-eyebrow"><span /> 为真实业务而构建 · React 组件框架</div>
          <h1>让想法落地，<br /><em>让界面有序。</em></h1>
          <p>从一个按钮，到完整的业务工作台。<br />Sia Web UI 用统一的设计、灵活的组件和细致的交互，<br className="home-wide-break" />帮你把更多时间留给产品本身。</p>
          <div className="home-hero-actions"><a className="home-primary-link" href="#get-started">开始使用 <Icon name="arrow-right" size={18} /></a><Link className="home-secondary-link" to="/components/button">浏览组件 <Icon name="component" size={17} /></Link></div>
          <div className="home-stack"><span>React</span><i /> <span>TypeScript</span><i /> <span>明暗主题</span><i /> <span>按需组合</span></div>
        </div>
        <div className="home-product">
          <div className="home-product-top"><span><span className="home-window-dot" /> workspace / overview</span><span>交互示例</span></div>
          <div className="home-product-content"><div className="home-workspace-heading"><div><span className="home-small-label">YOUR WORKSPACE</span><h2>把工作安排得井井有条</h2></div><Icon name="appstore" size={24} /></div>
            <div className="home-preview-metrics"><div><span>全部项目</span><strong>04<small>个项目</small></strong></div><div><span>正在进行</span><strong>02<small>持续推进</small></strong></div><div><span>已完成</span><strong>01<small className="home-green">准备就绪</small></strong></div></div>
            <div className="home-preview-toolbar"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索示例项目" aria-label="搜索示例项目" prefix={<Icon name="search" size={15} />} /><Select value={status} onChange={(value) => setStatus(value as string)} options={["全部状态", "进行中", "已完成", "待开始"].map((value) => ({ label: value, value }))} aria-label="筛选项目状态" /></div>
            <Table columns={previewColumns} dataSource={rows} rowKey="id" />
            <div className="home-preview-bottom"><span><span className="home-live-dot" />真实组件，可搜索、筛选与拖动列宽</span><Link to="/components/table">打开完整示例 <Icon name="arrow-right" size={14} /></Link></div>
          </div>
          <div className="home-product-caption"><span>BUILT WITH SIA WEB UI</span><span>每一个细节，都能复用。</span></div>
        </div>
      </section>
      <section className="home-foundation" aria-label="框架概览"><div><strong>{componentCount}</strong><span>组件文档入口</span></div><div><strong>TypeScript</strong><span>类型与 API 提示</span></div><div><strong>Light / Dark</strong><span>一致的主题体验</span></div><div><strong>Composable</strong><span>从基础控件到业务场景</span></div></section>
      <section id="capabilities" className="home-section"><div className="home-section-heading"><div><span className="home-small-label">DESIGNED FOR REAL WORK</span><h2>不止于组件，更贴近业务。</h2></div><p>基础能力保持一致，复杂场景自由组合。<br />从常用交互出发，搭建属于你的产品。</p></div>
        <div className="home-highlights">{highlights.map((item, index) => <article key={item.path}><div className="home-feature-top"><Icon name={item.icon} size={25} /><span>0{index + 1}</span></div><h3>{item.title}</h3><p>{item.text}</p><Link to={item.path}>{item.label}<Icon name="arrow-right" size={18} /></Link></article>)}</div>
      </section>
      <section id="themes" className="home-section home-themes" aria-label="浅色与深色主题展示">
        <div className="home-section-heading"><div><span className="home-small-label">LIGHT & DARK</span><h2>浅色清爽，深色沉浸。</h2></div><p>相同的组件与布局，完整的两套主题。<br />从背景、边框到文字和交互状态，保持统一。</p></div>
        <div className="home-theme-grid"><ThemePreview mode="light" /><ThemePreview mode="dark" /></div>
      </section>
      {/* 首页聚焦能力与主题展示，完整组件目录通过文档入口访问。 */}
      <section id="get-started" className="home-start home-section"><div><span className="home-small-label">LESS SETUP. MORE BUILDING.</span><h2>下一次创造，<br />从这里开始。</h2><p>在你的 React 项目中安装组件包，<br />引入样式，然后写下第一个组件。</p><Link className="home-inline-link" to="/components/button">阅读 Button 文档 <Icon name="arrow-right" size={17} /></Link></div><div className="home-code"><div className="home-command"><code>{installCommand}</code><Button variant="text" onClick={() => void copyInstall()} aria-label="复制安装命令" icon={<Icon name="copy" size={16} />} /></div><div className="home-code-label">App.tsx <span>React + TypeScript</span></div><pre><code>{usageCode}</code></pre><p aria-live="polite">{copyState || "适用于已有 React 项目 · 样式只需全局引入一次"}</p></div></section>
    </main>
    <footer className="home-footer"><Link className="home-brand" to="/"><SiaMark /><strong>Sia Web UI</strong></Link><p>用一致的组件，构建自己的产品。</p><div><Link to="/components/button">组件文档</Link><Link to="/design/tokens">设计令牌</Link><a href="https://gitee.com/xhmyun/sia-web-ui" target="_blank" rel="noreferrer">源码仓库 ↗</a></div></footer>
  </div>;
}
