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
  { title: "方向与导航", names: ["arrow-left", "arrow-right", "arrow-up", "arrow-down", "chevron-left", "chevron-right", "chevron-up", "chevron-down", "double-left", "double-right", "step-backward", "step-forward", "fast-backward", "fast-forward", "corner-up-left", "corner-up-right", "swap-horizontal", "swap-vertical", "expand", "shrink", "fullscreen", "fullscreen-exit", "menu", "menu-fold", "menu-unfold", "more-horizontal", "more-vertical", "move", "vertical-align-top", "vertical-align-middle", "vertical-align-bottom", "login", "logout", "home"] },
  { title: "通用操作", names: ["search", "plus", "minus", "close", "check", "square-plus", "square-minus", "square-check", "square-close", "edit", "copy", "trash", "scissors", "save", "clipboard", "clipboard-check", "download", "upload", "refresh", "settings", "undo", "redo", "zoom-in", "zoom-out", "filter", "sort-ascending", "sort-descending"] },
  { title: "文本与编辑", names: ["bold", "italic", "underline", "strikethrough", "align-left", "align-center", "align-right", "align-justify", "list-ordered", "list-unordered", "eraser", "highlighter", "file-plus", "file-check", "file-warning", "file-spreadsheet", "table", "columns", "rows"] },
  { title: "反馈与状态", names: ["info", "question", "help-circle", "warning", "circle-check", "circle-close", "circle-plus", "circle-minus", "stop", "loader", "bell", "star", "heart", "sun", "moon", "smile", "meh", "frown"] },
  { title: "用户与安全", names: ["user", "users", "user-plus", "user-minus", "eye", "eye-off", "lock", "unlock", "key", "shield", "shield-check", "mail", "phone", "link", "external-link"] },
  { title: "数据与图表", names: ["calendar", "clock", "database", "server", "bar-chart", "line-chart", "pie-chart", "area-chart", "activity", "trending-up", "trending-down", "branches", "partition"] },
  { title: "文件、云与设备", names: ["file", "folder", "image", "cloud", "cloud-download", "cloud-upload", "desktop", "laptop", "mobile", "tablet", "printer", "camera", "video", "microphone", "volume-up", "volume-off", "wifi", "power", "paperclip"] },
  { title: "业务与应用", names: ["appstore", "shop", "shopping-cart", "shopping-bag", "wallet", "bank", "calculator", "tag", "tags", "message", "comments", "send", "share", "location", "compass", "car", "truck", "gift", "coffee", "experiment", "tool", "bug", "bulb", "rocket", "target", "trophy", "scan", "qr-code", "barcode"] },
  { title: "媒体与开发", names: ["play", "pause", "book", "component", "token", "code", "github"] },
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
        <div><h2>图标目录</h2><p>按导航、编辑、数据、设备和业务语义分类，统一使用柔和圆角描边；常用状态同时提供实色变体。</p></div>
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
