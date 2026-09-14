import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WheelEvent } from "react";
import {
  Button,
  Dropdown,
  Icon,
  type MenuItem,
} from "@sia.soul/sia-react-ui";
import type { BrowserTab } from "../browserTypes";
import BrowserFavicon from "./BrowserFavicon";

interface HorizontalTabStripProps {
  tabs: readonly BrowserTab[];
  activeId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onToggleAudio: (tabId: string) => void;
  onNew: () => void;
}

export default function HorizontalTabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onToggleAudio,
  onNew,
}: HorizontalTabStripProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [hiddenTabIds, setHiddenTabIds] = useState<string[]>([]);

  const updateHiddenTabs = useCallback(() => {
    const scroll = scrollRef.current;
    const list = listRef.current;
    if (!scroll || !list) return;
    const viewport = scroll.getBoundingClientRect();
    const nextHidden = Array.from(list.querySelectorAll<HTMLElement>("[data-browser-tab-id]"))
      .filter((tab) => {
        const rect = tab.getBoundingClientRect();
        return rect.left < viewport.left - 1 || rect.right > viewport.right + 1;
      })
      .map((tab) => tab.dataset.browserTabId ?? "")
      .filter(Boolean);
    setHiddenTabIds((current) => (
      current.length === nextHidden.length && current.every((id, index) => id === nextHidden[index])
        ? current
        : nextHidden
    ));
  }, []);

  useEffect(() => {
    const scroll = scrollRef.current;
    const list = listRef.current;
    if (!scroll || !list) return;
    const observer = new ResizeObserver(updateHiddenTabs);
    observer.observe(scroll);
    observer.observe(list);
    const frame = window.requestAnimationFrame(updateHiddenTabs);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [tabs, updateHiddenTabs]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-browser-tab-id="${activeId}"]`);
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    const timer = window.setTimeout(updateHiddenTabs, 220);
    return () => window.clearTimeout(timer);
  }, [activeId, updateHiddenTabs]);

  const hiddenTabs = useMemo(
    () => hiddenTabIds
      .map((id) => tabs.find((tab) => tab.id === id))
      .filter((tab): tab is BrowserTab => Boolean(tab)),
    [hiddenTabIds, tabs],
  );

  const overflowItems: MenuItem[] = hiddenTabs.map((tab) => ({
    key: tab.id,
    icon: <BrowserFavicon url={tab.url} loading={tab.loading} size={14} />,
    label: (
      <span className="browser-tab-overflow__label">
        <span>{tab.title}</span>
        {tab.sleeping ? <span className="browser-tab__sleeping">休眠</span> : null}
      </span>
    ),
  }));

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const scroll = scrollRef.current;
    if (!scroll || scroll.scrollWidth <= scroll.clientWidth) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    event.preventDefault();
    scroll.scrollLeft += delta;
    window.requestAnimationFrame(updateHiddenTabs);
  }

  function revealAndSelect(tabId: string) {
    onSelect(tabId);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-browser-tab-id="${tabId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  return (
    <div className="horizontal-tab-strip">
      <div
        ref={scrollRef}
        className="horizontal-tab-scroll"
        onScroll={updateHiddenTabs}
        onWheel={handleWheel}
      >
        <div ref={listRef} className="horizontal-tab-list" role="tablist" aria-label="浏览器标签页">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`browser-tab${tab.id === activeId ? " is-active" : ""}${tab.audible || tab.muted ? " has-audio" : ""}`}
              data-browser-tab-id={tab.id}
            >
              <Button
                className="browser-tab__select"
                variant="text"
                size="small"
                role="tab"
                aria-selected={tab.id === activeId}
                icon={<BrowserFavicon url={tab.url} loading={tab.loading} size={14} />}
                onClick={() => onSelect(tab.id)}
              >
                <span className="browser-tab__title">{tab.title}</span>
                {tab.sleeping ? <span className="browser-tab__sleeping">休眠</span> : null}
              </Button>
              {tab.audible || tab.muted ? (
                <Button
                  className={`browser-tab__audio${tab.muted ? " is-muted" : ""}`}
                  variant="text"
                  size="small"
                  icon={<Icon name={tab.muted ? "speaker-muted" : "speaker-wave"} size={13} />}
                  aria-label={tab.muted ? `取消静音 ${tab.title}` : `静音 ${tab.title}`}
                  title={tab.muted ? "取消静音" : "静音"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleAudio(tab.id);
                  }}
                />
              ) : null}
              <Button
                className="browser-tab__close"
                variant="text"
                size="small"
                icon={<Icon name="close" size={12} />}
                aria-label={`关闭 ${tab.title}`}
                title="关闭标签页"
                onClick={() => onClose(tab.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <Button
        className="browser-tab-add"
        variant="text"
        size="small"
        icon={<Icon name="plus" size={15} />}
        aria-label="新建标签页"
        title="新建标签页 (Ctrl+T)"
        onClick={onNew}
      />

      {hiddenTabs.length > 0 ? (
        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          popupClassName="browser-tab-overflow-popup"
          menu={{
            items: overflowItems,
            selectable: true,
            selectedKeys: [activeId],
            onClick: ({ key }) => revealAndSelect(key),
          }}
        >
          <Button
            className="browser-tab-overflow"
            variant="text"
            size="small"
            icon={<Icon name="chevron-down" size={15} />}
            aria-label={`${hiddenTabs.length} 个未显示的标签页`}
            title="未显示的标签页"
          />
        </Dropdown>
      ) : null}
    </div>
  );
}
