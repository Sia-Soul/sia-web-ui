import { useMemo, useState } from "react";
import { FILLED_ICON_NAMES, ICON_NAMES, Icon } from "@sia-ui/react";
import type { IconName, IconVariant } from "@sia-ui/react";

type IconGroup = {
  title: string;
  names: readonly IconName[];
  variant?: IconVariant;
};

const groups: readonly IconGroup[] = [
  { title: "实色图标", names: FILLED_ICON_NAMES, variant: "filled" },
  { title: "方向与导航", names: ["arrow-left", "arrow-right", "arrow-up", "arrow-down", "chevron-left", "chevron-right", "chevron-up", "chevron-down", "double-left", "double-right", "menu", "more-horizontal", "more-vertical", "home"] },
  { title: "通用操作", names: ["search", "plus", "minus", "close", "check", "edit", "copy", "trash", "scissors", "download", "upload", "refresh", "settings", "undo", "redo", "zoom-in", "zoom-out"] },
  { title: "反馈与状态", names: ["info", "question", "warning", "circle-check", "circle-close", "circle-plus", "circle-minus", "loader", "bell", "star", "heart"] },
  { title: "用户与安全", names: ["user", "users", "eye", "eye-off", "lock", "unlock", "mail", "phone", "link", "external-link"] },
  { title: "数据与媒体", names: ["calendar", "clock", "file", "folder", "image", "filter", "sort-ascending", "sort-descending", "play", "pause"] },
  { title: "产品与开发", names: ["book", "component", "token", "code", "github"] },
];

export function IconGallery() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => groups.map((group) => ({ ...group, names: group.names.filter((name) => name.includes(normalizedQuery)) })).filter((group) => group.names.length > 0), [normalizedQuery]);

  async function copyUsage(name: IconName, variant: IconVariant) {
    const usage = variant === "filled" ? `<Icon name="${name}" variant="filled" />` : `<Icon name="${name}" />`;
    await navigator.clipboard.writeText(usage);
    setCopied(`${variant}-${name}`);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <section className="icon-gallery-section">
      <div className="icon-gallery-heading">
        <div><h2>常用图标</h2><p>同时提供柔和的圆角描边和常用实色图标。通过 variant 切换风格，点击图标可复制用法。</p></div>
        <label className="icon-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索 ${ICON_NAMES.length + FILLED_ICON_NAMES.length} 个图标条目`} aria-label="搜索图标" /></label>
      </div>
      {visibleGroups.length > 0 ? visibleGroups.map((group) => {
        const variant = group.variant ?? "outline";
        return <div className="icon-group" key={`${variant}-${group.title}`}>
          <h3>{group.title}{variant === "filled" ? <span className="icon-group__badge">Filled</span> : null}</h3>
          <div className="icon-grid">
            {group.names.map((name) => {
              const copyKey = `${variant}-${name}`;
              return <button className="icon-tile" key={copyKey} onClick={() => void copyUsage(name, variant)} title={`复制 ${variant === "filled" ? "实色" : "描边"}图标用法`}>
                <Icon name={name} variant={variant} size={25} spin={name === "loader"} />
                <span className="icon-tile__label">{copied === copyKey ? "已复制" : name}</span>
              </button>;
            })}
          </div>
        </div>;
      }) : <div className="icon-empty"><Icon name="search" size={28} /><span>没有找到“{query}”</span></div>}
    </section>
  );
}
