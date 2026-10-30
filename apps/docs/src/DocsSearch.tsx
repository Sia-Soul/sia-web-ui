import { useEffect, useRef, useState } from "react";
import { Button, Icon, Input, Popover } from "@sia.soul/sia-react-ui";
import { useLocation, useNavigate } from "react-router-dom";
import { navItems } from "./navigation";

// 同一路由可能同时出现在分类入口和子目录中，搜索中只保留一个结果。
const searchItems = [...new Map(navItems.map(item => [item.path, item])).values()];

/** 文档顶部搜索：复用导航索引与框架输入、气泡、按钮，支持中英文及键盘跳转。 */
export function DocsSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  // 名称匹配优先，说明和路径作为补充，数据来源始终与侧栏一致。
  const results = searchItems.filter(item => terms.every(term => `${item.label} ${item.title} ${item.description} ${item.path}`.toLocaleLowerCase().includes(term)))
    .sort((a, b) => Number(b.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) - Number(a.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  useEffect(() => { setOpen(false); setQuery(""); setActive(0); }, [location.pathname]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); input.current?.focus(); setOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function select(path: string) {
    setOpen(false); setQuery(""); input.current?.blur(); navigate(path);
  }
  return <Popover className="docs-search" overlayClassName="docs-search-popup" placement="bottom-start" arrow={false} trigger="focus" open={open} onOpenChange={setOpen} content={
    <div onMouseDown={event => event.preventDefault()}>
      <div className="docs-search-summary">{terms.length ? `找到 ${results.length} 个页面` : "输入组件名称或关键词"}</div>
      <div role="listbox" id="docs-search-results" aria-label="搜索结果" className="docs-search-results">
        {results.map((item, index) => <Button key={item.path} id={`docs-search-result-${index}`} role="option" aria-selected={index === active} tabIndex={-1} variant="text" className={index === active ? "is-active" : ""} onClick={() => select(item.path)}>
          <span>{item.label}</span><small>{item.eyebrow}</small>
        </Button>)}
        {!results.length && <p>未找到匹配页面，请尝试其他关键词。</p>}
      </div>
    </div>
  }>
    <Input ref={input} className="search" size="large" placeholderMode="default" prefix={<Icon name="search" />} suffix={<kbd>Ctrl/⌘ K</kbd>} placeholder="搜索组件、文档、设计令牌..." aria-label="搜索文档" role="combobox" aria-expanded={open} aria-controls="docs-search-results" aria-autocomplete="list" aria-activedescendant={open && results[active] ? `docs-search-result-${active}` : undefined} value={query}
      onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          const next = Math.max(0, Math.min(results.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
          setActive(next); document.getElementById(`docs-search-result-${next}`)?.scrollIntoView({ block: "nearest" });
        }
        if (event.key === "Enter" && open && results[active]) { event.preventDefault(); select(results[active].path); }
      }} />
  </Popover>;
}
