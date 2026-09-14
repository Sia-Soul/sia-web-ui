import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Button, Icon, Tooltip } from "@sia.soul/sia-react-ui";
import { ROOT_GROUP_ID, type BrowserGroup, type BrowserTab } from "../browserTypes";
import BrowserFavicon from "./BrowserFavicon";

interface VerticalTabTreeProps {
  groups: readonly BrowserGroup[];
  tabs: readonly BrowserTab[];
  activeId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onToggleAudio: (tabId: string) => void;
  onNewTab: (groupId: string, smallGroupId?: string) => void;
  onNewRootTab: () => void;
  onNewGroup: () => void;
  onTreeActionsOpen: (
    groupId: string,
    smallGroupId: string | undefined,
    x: number,
    y: number,
  ) => void;
  floatingWindow?: boolean;
  panelExpanded?: boolean;
  panelPinned?: boolean;
  panelWidth?: number;
  showScrollbar?: boolean;
  collapsedGroupIds?: readonly string[];
  collapsedSmallGroupIds?: readonly string[];
  onToggleGroup?: (groupId: string) => void;
  onToggleSmallGroup?: (smallGroupId: string) => void;
  onPinPanel?: () => void;
  onPanelWidthChange?: (width: number) => void;
}

const COMPACT_PANEL_WIDTH = 56;

function compactGroupTitle(value: string, maxWidth = 4) {
  let width = 0;
  let result = "";
  for (const character of value) {
    const characterWidth = /[\u3400-\u9fff\uf900-\ufaff]/.test(character) ? 2 : 1;
    if (width + characterWidth > maxWidth) break;
    result += character;
    width += characterWidth;
  }
  return result;
}

export default function VerticalTabTree({
  groups,
  tabs,
  activeId,
  onSelect,
  onClose,
  onToggleAudio,
  onNewTab,
  onNewRootTab,
  onNewGroup,
  onTreeActionsOpen,
  floatingWindow = false,
  panelExpanded = true,
  panelPinned = true,
  panelWidth = 292,
  showScrollbar = false,
  collapsedGroupIds = [],
  collapsedSmallGroupIds = [],
  onToggleGroup,
  onToggleSmallGroup,
  onPinPanel,
  onPanelWidthChange,
}: VerticalTabTreeProps) {
  const [resizing, setResizing] = useState(false);
  const [scrollbarMetrics, setScrollbarMetrics] = useState({
    visible: false,
    thumbHeight: 0,
    thumbTop: 0,
  });
  const resizeStateRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollbarDragRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
  } | null>(null);
  const collapsedGroups = useMemo(() => new Set(collapsedGroupIds), [collapsedGroupIds]);
  const collapsedSmallGroups = useMemo(
    () => new Set(collapsedSmallGroupIds),
    [collapsedSmallGroupIds],
  );
  const tabsByGroup = useMemo(() => {
    const map = new Map<string, BrowserTab[]>();
    for (const tab of tabs) {
      const groupTabs = map.get(tab.groupId) ?? [];
      groupTabs.push(tab);
      map.set(tab.groupId, groupTabs);
    }
    return map;
  }, [tabs]);
  const rootTabs = tabsByGroup.get(ROOT_GROUP_ID) ?? [];
  const activeTab = tabs.find((tab) => tab.id === activeId);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!panelExpanded || !scrollContainer) {
      setScrollbarMetrics({ visible: false, thumbHeight: 0, thumbTop: 0 });
      return undefined;
    }

    let frame: number | undefined;
    const updateScrollbar = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const { clientHeight, scrollHeight, scrollTop } = scrollContainer;
        const trackHeight = Math.max(0, clientHeight - 8);
        if (scrollHeight <= clientHeight + 1 || trackHeight <= 0) {
          setScrollbarMetrics({ visible: false, thumbHeight: 0, thumbTop: 0 });
          return;
        }
        const thumbHeight = Math.max(28, trackHeight * (clientHeight / scrollHeight));
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
        setScrollbarMetrics({
          visible: true,
          thumbHeight,
          thumbTop: 4 + (scrollTop / maxScrollTop) * maxThumbTop,
        });
      });
    };

    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(scrollContainer);
    const mutationObserver = new MutationObserver(updateScrollbar);
    mutationObserver.observe(scrollContainer, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    scrollContainer.addEventListener("scroll", updateScrollbar, { passive: true });
    updateScrollbar();

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      scrollContainer.removeEventListener("scroll", updateScrollbar);
    };
  }, [
    collapsedGroupIds,
    collapsedSmallGroupIds,
    groups,
    panelExpanded,
    panelWidth,
    tabs,
  ]);

  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panelExpanded || event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    event.preventDefault();
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: panelWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  }

  function handleResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    onPanelWidthChange?.(
      Math.min(440, Math.max(220, resizeState.startWidth + event.clientX - resizeState.startX)),
    );
  }

  function finishResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (resizeStateRef.current?.pointerId !== event.pointerId) return;
    resizeStateRef.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function togglePanelPinned() {
    onPinPanel?.();
  }

  function handleScrollbarDragStart(event: ReactPointerEvent<HTMLSpanElement>) {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    scrollbarDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: scrollContainer.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleScrollbarDragMove(event: ReactPointerEvent<HTMLSpanElement>) {
    const drag = scrollbarDragRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!drag || !scrollContainer || drag.pointerId !== event.pointerId) return;
    const trackHeight = Math.max(0, scrollContainer.clientHeight - 8);
    const maxThumbTop = Math.max(1, trackHeight - scrollbarMetrics.thumbHeight);
    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    scrollContainer.scrollTop = drag.startScrollTop
      + ((event.clientY - drag.startY) / maxThumbTop) * maxScrollTop;
  }

  function finishScrollbarDrag(event: ReactPointerEvent<HTMLSpanElement>) {
    if (scrollbarDragRef.current?.pointerId !== event.pointerId) return;
    scrollbarDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function renderTab(tab: BrowserTab) {
    const active = tab.id === activeId;
    return (
      <div
        key={tab.id}
        className={`vertical-tree-tab${active ? " is-active" : ""}${tab.audible || tab.muted ? " has-audio" : ""}`}
        data-browser-tab-id={tab.id}
      >
        <Button
          className="vertical-tree-tab__select"
          variant="text"
          size="small"
          icon={<BrowserFavicon url={tab.url} loading={tab.loading} size={15} />}
          title={tab.title}
          onClick={() => onSelect(tab.id)}
        >
          <span className="vertical-tree-tab__title">{tab.title}</span>
          {!active && tab.sleeping ? <span className="vertical-tree-tab__sleeping">休眠</span> : null}
        </Button>
        {tab.audible || tab.muted ? (
          <Button
            className={`vertical-tree-tab__audio${tab.muted ? " is-muted" : ""}`}
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
          className="vertical-tree-tab__close"
          variant="text"
          size="small"
          icon={<Icon name="close" size={11} />}
          aria-label={`关闭 ${tab.title}`}
          onClick={() => onClose(tab.id)}
        />
      </div>
    );
  }

  function renderCompactTab(tab: BrowserTab) {
    const active = tab.id === activeId;
    const statusText = [
      tab.sleeping ? "休眠" : "",
      tab.muted ? "已静音" : tab.audible ? "正在播放声音" : "",
    ].filter(Boolean).join("，");
    const accessibleTitle = statusText ? `${tab.title} · ${statusText}` : tab.title;
    return (
      <Button
        key={tab.id}
        className={`vertical-tree-compact-tab${active ? " is-active" : ""}`}
        variant="text"
        size="small"
        icon={(
          <span className="vertical-tree-compact-tab__visual">
            <BrowserFavicon url={tab.url} loading={tab.loading} size={16} />
            {tab.sleeping ? (
              <span
                className="vertical-tree-compact-tab__state vertical-tree-compact-tab__state--sleeping"
                aria-hidden="true"
              >
                <Icon name="moon" size={6} />
              </span>
            ) : null}
            {tab.muted || tab.audible ? (
              <span
                className={`vertical-tree-compact-tab__state vertical-tree-compact-tab__state--${tab.muted ? "muted" : "audible"}`}
                aria-hidden="true"
              >
                <Icon name={tab.muted ? "speaker-muted" : "speaker-wave"} size={6} />
              </span>
            ) : null}
          </span>
        )}
        data-browser-tab-id={tab.id}
        aria-label={accessibleTitle}
        title={accessibleTitle}
        onClick={() => onSelect(tab.id)}
      />
    );
  }

  return (
    <aside
      className={`vertical-tab-tree${panelExpanded ? "" : " is-collapsed"}${floatingWindow ? " is-floating-window" : panelPinned ? " is-pinned" : " is-floating"}${resizing ? " is-resizing" : ""}${showScrollbar ? " has-overlay-scrollbar" : ""}`}
      style={{
        width: floatingWindow ? "calc(100vw - 8px)" : panelExpanded ? panelWidth : COMPACT_PANEL_WIDTH,
        minWidth: floatingWindow ? "calc(100vw - 8px)" : panelExpanded ? panelWidth : COMPACT_PANEL_WIDTH,
      }}
      aria-label="垂直标签页"
    >
      <div className="vertical-tab-tree__header">
        {panelExpanded ? (
          <>
            <span className="vertical-tab-tree__cookie-note">分组间cookie不共享</span>
            <div className="vertical-tab-tree__actions">
              <Tooltip title="新建页签" placement="bottom" mouseEnterDelay={0.2}>
                <Button
                  className="vertical-tree-header-action"
                  variant="text"
                  size="small"
                  icon={<Icon name="tab-plus" size={16} />}
                  aria-label="新建页签"
                  onClick={onNewRootTab}
                />
              </Tooltip>
              <Tooltip title="新建分组" placement="bottom" mouseEnterDelay={0.2}>
                <Button
                  className="vertical-tree-header-action"
                  variant="text"
                  size="small"
                  icon={<Icon name="folder-plus" size={16} />}
                  aria-label="新建分组"
                  onClick={onNewGroup}
                />
              </Tooltip>
              <Tooltip
                title={floatingWindow || !panelPinned ? "固定标签面板" : "切换为浮动面板"}
                placement="bottom"
                mouseEnterDelay={0.2}
              >
                <Button
                  className={`vertical-tree-header-action vertical-tree-header-action--pin${panelPinned && !floatingWindow ? " is-active" : ""}`}
                  variant="text"
                  size="small"
                  icon={<Icon name={panelPinned && !floatingWindow ? "pin" : "pin-off"} size={15} />}
                  aria-label={floatingWindow || !panelPinned ? "固定标签面板" : "切换为浮动面板"}
                  onClick={togglePanelPinned}
                />
              </Tooltip>
            </div>
          </>
        ) : (
          <Tooltip
            title={panelPinned ? "切换为浮动面板" : "固定并展开标签面板"}
            placement="right"
            mouseEnterDelay={0.2}
          >
            <Button
              className={`vertical-tree-header-action vertical-tree-header-action--pin${panelPinned ? " is-active" : ""}`}
              variant="text"
              size="small"
              icon={<Icon name={panelPinned ? "pin" : "pin-off"} size={15} />}
              aria-label={panelPinned ? "切换为浮动面板" : "固定并展开标签面板"}
              onClick={togglePanelPinned}
            />
          </Tooltip>
        )}
      </div>

      {panelExpanded ? (
        <div className="vertical-tab-tree__scroll-shell">
          <div ref={scrollContainerRef} className="vertical-tab-tree__scroll">
            {groups.map((group) => {
          const groupCollapsed = collapsedGroups.has(group.id);
          const activeGroupParent = activeTab?.groupId === group.id;
          const groupTabs = tabsByGroup.get(group.id) ?? [];
          const directTabs = groupTabs.filter((tab) => !tab.smallGroupId);
          return (
            <section
              key={group.id}
              className="vertical-tree-group"
              style={{ "--group-color": group.color } as React.CSSProperties}
            >
              <div
                className="vertical-tree-node-context"
                onContextMenu={(event) => {
                  event.preventDefault();
                  onTreeActionsOpen(group.id, undefined, event.clientX, event.clientY);
                }}
              >
                <div className="vertical-tree-group__heading">
                  <Button
                    className="vertical-tree-group__toggle"
                    variant="text"
                    size="small"
                    icon={<Icon name={groupCollapsed ? "chevron-right" : "chevron-down"} size={13} />}
                    aria-expanded={!groupCollapsed}
                    title={`分组：${group.name}`}
                    onClick={() => onToggleGroup?.(group.id)}
                  >
                    <span className={`vertical-tree-group__name${activeGroupParent ? " is-current-ancestor" : ""}`}>
                      {group.name}
                    </span>
                  </Button>
                  <Button
                    className="vertical-tree-icon-button"
                    variant="text"
                    size="small"
                    icon={<Icon name="plus" size={15} />}
                    aria-label={`在分组 ${group.name} 的根节点新建标签页`}
                    title={`在“${group.name}”根节点新建标签页`}
                    onClick={() => onNewTab(group.id)}
                  />
                </div>
              </div>

              {!groupCollapsed ? (
                <div className="vertical-tree-group__content">
                  {group.smallGroups.map((smallGroup) => {
                    const smallGroupCollapsed = collapsedSmallGroups.has(smallGroup.id);
                    const activeSmallGroupParent = activeGroupParent && activeTab?.smallGroupId === smallGroup.id;
                    const smallGroupTabs = groupTabs.filter((tab) => tab.smallGroupId === smallGroup.id);
                    return (
                      <section key={smallGroup.id} className="vertical-tree-small-group">
                        <div
                          className="vertical-tree-node-context"
                          onContextMenu={(event) => {
                            event.preventDefault();
                            onTreeActionsOpen(
                              group.id,
                              smallGroup.id,
                              event.clientX,
                              event.clientY,
                            );
                          }}
                        >
                          <div className="vertical-tree-small-group__heading">
                            <Button
                              className="vertical-tree-small-group__toggle"
                              variant="text"
                              size="small"
                              icon={<Icon name={smallGroupCollapsed ? "chevron-right" : "chevron-down"} size={12} />}
                              aria-expanded={!smallGroupCollapsed}
                              title={`小分组：${smallGroup.name}`}
                              onClick={() => onToggleSmallGroup?.(smallGroup.id)}
                            >
                              <span className={`vertical-tree-small-group__name${activeSmallGroupParent ? " is-current-ancestor" : ""}`}>
                                {smallGroup.name}
                              </span>
                            </Button>
                            <Button
                              className="vertical-tree-icon-button"
                              variant="text"
                              size="small"
                              icon={<Icon name="plus" size={14} />}
                              aria-label={`在小分组 ${smallGroup.name} 中新建标签`}
                              onClick={() => onNewTab(group.id, smallGroup.id)}
                            />
                          </div>
                        </div>
                        {!smallGroupCollapsed ? (
                          <div className="vertical-tree-small-group__tabs">
                            {smallGroupTabs.map(renderTab)}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                  <div className="vertical-tree-group__direct-tabs">
                    {directTabs.map(renderTab)}
                  </div>
                </div>
              ) : null}
            </section>
          );
          })}
            {rootTabs.length > 0 ? (
              <div className="vertical-tab-tree__root-tabs" aria-label="根级标签页">
                {rootTabs.map(renderTab)}
              </div>
            ) : null}
          </div>
          <div
            className={`sia-scrollbar-track vertical-tab-tree__overlay-scrollbar${scrollbarMetrics.visible ? " is-visible" : ""}`}
            aria-hidden="true"
          >
            <span
              className="vertical-tab-tree__overlay-scrollbar-thumb"
              style={{
                height: scrollbarMetrics.thumbHeight,
                transform: `translateY(${scrollbarMetrics.thumbTop}px)`,
              }}
              onPointerDown={handleScrollbarDragStart}
              onPointerMove={handleScrollbarDragMove}
              onPointerUp={finishScrollbarDrag}
              onPointerCancel={finishScrollbarDrag}
            />
          </div>
        </div>
      ) : null}
      {!panelExpanded ? (
        <div className="vertical-tab-tree__compact-scroll" aria-label="紧凑标签列表">
          {groups.map((group) => {
            const groupTabs = tabsByGroup.get(group.id) ?? [];
            const groupCollapsed = collapsedGroups.has(group.id);
            const directTabs = groupTabs.filter((tab) => !tab.smallGroupId);
            return (
              <section
                key={group.id}
                className="vertical-tree-compact-group"
                style={{ "--group-color": group.color } as React.CSSProperties}
              >
                <Button
                  className="vertical-tree-compact-group__title"
                  variant="text"
                  size="small"
                  title={group.name}
                  aria-label={`分组：${group.name}`}
                  aria-expanded={!groupCollapsed}
                  onClick={() => onToggleGroup?.(group.id)}
                >
                  {compactGroupTitle(group.name)}
                </Button>
                {!groupCollapsed ? (
                  <div className="vertical-tree-compact-group__content">
                    {group.smallGroups.map((smallGroup) => {
                      const smallGroupCollapsed = collapsedSmallGroups.has(smallGroup.id);
                      const activeSmallGroupParent = activeTab?.groupId === group.id
                        && activeTab.smallGroupId === smallGroup.id;
                      const smallGroupTabs = groupTabs.filter(
                        (tab) => tab.smallGroupId === smallGroup.id,
                      );
                      return (
                        <section
                          key={smallGroup.id}
                          className="vertical-tree-compact-small-group"
                        >
                          <Button
                            className={`vertical-tree-compact-small-group__title${activeSmallGroupParent ? " is-current-ancestor" : ""}`}
                            variant="text"
                            size="small"
                            title={`小分组：${smallGroup.name}`}
                            aria-label={`小分组：${smallGroup.name}`}
                            aria-expanded={!smallGroupCollapsed}
                            onClick={() => onToggleSmallGroup?.(smallGroup.id)}
                          >
                            {compactGroupTitle(smallGroup.name)}
                          </Button>
                          {!smallGroupCollapsed ? (
                            <div className="vertical-tree-compact-group__tabs">
                              {smallGroupTabs.map(renderCompactTab)}
                            </div>
                          ) : null}
                        </section>
                      );
                    })}
                    <div className="vertical-tree-compact-group__tabs">
                      {directTabs.map(renderCompactTab)}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
          {rootTabs.length > 0 ? (
            <div className="vertical-tree-compact-root-tabs">
              {rootTabs.map(renderCompactTab)}
            </div>
          ) : null}
        </div>
      ) : null}
      {!floatingWindow ? (
        <div
          className="vertical-tab-tree__resize-handle"
          role="separator"
          aria-label="调整标签面板宽度"
          aria-orientation="vertical"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
        />
      ) : null}
    </aside>
  );
}
