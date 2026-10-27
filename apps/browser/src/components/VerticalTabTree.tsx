import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Button, FloatingScrollbarProvider, Icon } from "@sia.soul/sia-react-ui";
import { ROOT_GROUP_ID, type BrowserGroup, type BrowserTab, type BrowserDropTarget } from "../browserTypes";
import BrowserFavicon from "./BrowserFavicon";
import { useCompactTabTooltip } from "./BrowserTabTooltip";

interface VerticalTabTreeProps {
  groups: readonly BrowserGroup[];
  tabs: readonly BrowserTab[];
  activeId: string;
  onSelect: (tabId: string) => void;
  /** 将标签移入目标分组；beforeTabId 指定插入其前，null 表示末尾，省略时沿用原位置规则。 */
  onMoveTab: (tabId: string, groupId: string, smallGroupId?: string, beforeTabId?: string | null) => void;
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
  onMoveTab,
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
  collapsedGroupIds = [],
  collapsedSmallGroupIds = [],
  onToggleGroup,
  onToggleSmallGroup,
  onPinPanel,
  onPanelWidthChange,
}: VerticalTabTreeProps) {
  const compactTooltip = useCompactTabTooltip(!panelExpanded);
  const [resizing, setResizing] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [externalDragging, setExternalDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // 插入位置独立于分组高亮，同一目标分组中移动时也能即时更新横线。
  const [dropInsertion, setDropInsertion] = useState<{ key: string; beforeTabId: string | null } | null>(null);
  const draggedTabRef = useRef<string | null>(null);
  const resizeStateRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const revealedTabRef = useRef<string | null>(null);
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

  // 内嵌和原生侧栏共用定位逻辑；折叠分组展开或容器获得尺寸后再定位到活动标签。
  useLayoutEffect(() => {
    if (!activeTab) return;
    const key = JSON.stringify([activeTab.id, activeTab.groupId, activeTab.smallGroupId, panelExpanded]);
    if (revealedTabRef.current === key) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const reveal = () => {
      if (revealedTabRef.current === key) return;
      const row = container.querySelector<HTMLElement>(`[data-browser-tab-id="${CSS.escape(activeId)}"]`);
      if (!row || !container.clientHeight || !row.getClientRects().length) return;
      const viewport = container.getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      // 只滚动列表的纵轴，并保留少量上下留白，不改变整个窗口或横向滚动位置。
      const top = viewport.top + container.clientTop + 8;
      const bottom = viewport.top + container.clientTop + container.clientHeight - 8;
      if (bounds.top < top) container.scrollTop += bounds.top - top;
      else if (bounds.bottom > bottom) container.scrollTop += bounds.bottom - bottom;
      revealedTabRef.current = key;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(container);
    return () => observer.disconnect();
    // 不依赖标题、加载状态或整个 tabs 数组，避免后台刷新时反复抢回用户滚动位置。
  }, [activeId, activeTab?.id, activeTab?.groupId, activeTab?.smallGroupId, panelExpanded, collapsedGroups, collapsedSmallGroups]);

  /** 共同使用直属标签中线定位；文件创建和页签重排必须与提示线使用相同算法。 */
  function insertionBefore(container: HTMLElement, clientY: number, groupId: string, smallGroupId?: string) {
    const ids = new Set(tabs.filter(tab => tab.id !== draggedTabRef.current
      && tab.groupId === groupId && tab.smallGroupId === smallGroupId).map(tab => tab.id));
    for (const row of container.querySelectorAll<HTMLElement>("[data-browser-tab-id]")) {
      if (!ids.has(row.dataset.browserTabId!)) continue;
      const rect = row.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return row.dataset.browserTabId!;
    }
    return null;
  }

  useEffect(() => {
    // 文件路径只能由原生 File 桥读取；捕获阶段仅向共享拖放脚本同步分组和排序锚点。
    const resolve = (event: Event) => {
      const detail = (event as CustomEvent<{ event: DragEvent; target?: BrowserDropTarget }>).detail;
      const hit = detail.event.target instanceof Element ? detail.event.target.closest<HTMLElement>("[data-drop-group]") : null;
      if (hit && scrollContainerRef.current?.contains(hit)) {
        const groupId = hit.dataset.dropGroup!;
        const smallGroupId = hit.dataset.dropSmallGroup;
        detail.target = { groupId, smallGroupId, beforeTabId: insertionBefore(hit, detail.event.clientY, groupId, smallGroupId) };
      }
      finishTabDrag();
    };
    const clear = () => finishTabDrag();
    window.addEventListener("sia-resolve-tree-drop", resolve);
    window.addEventListener("drop", clear);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("sia-resolve-tree-drop", resolve);
      window.removeEventListener("drop", clear);
      window.removeEventListener("dragend", clear);
    };
  }, [tabs]);

  /** 内部页签重排与外部文件共用命中反馈；文件投放由原生桥创建标签，不移动已有页签。 */
  function dropHandlers(groupId: string, smallGroupId?: string) {
    const key = JSON.stringify([groupId, smallGroupId ?? null]);
    // 只比较目标列表直属标签的中线，跳过源标签与其他小分组；缩进空白同样参与命中。
    const position = (event: ReactDragEvent<HTMLElement>) => insertionBefore(event.currentTarget, event.clientY, groupId, smallGroupId);
    // 进入子节点与周期性悬停均接受内部标签，避免切换命中元素时短暂显示禁止指针。
    const acceptDrag = (event: ReactDragEvent<HTMLElement>) => {
      event.stopPropagation();
      const tab = tabs.find((item) => item.id === draggedTabRef.current);
      const files = !tab && event.dataTransfer.types.includes("Files");
      if (!tab && !files) { setDropTarget(null); setDropInsertion(null); return false; }
      event.preventDefault();
      event.dataTransfer.dropEffect = tab ? "move" : "copy";
      setExternalDragging(files);
      setDropTarget(key);
      const beforeTabId = position(event);
      setDropInsertion((current) => current?.key === key && current.beforeTabId === beforeTabId
        ? current : { key, beforeTabId });
      return true;
    };
    return {
      "data-drop-group": groupId,
      "data-drop-small-group": smallGroupId,
      "data-drop-active": dropTarget === key ? "true" : undefined,
      onDragEnter: acceptDrag,
      onDragOver: (event: ReactDragEvent<HTMLElement>) => {
        if (!acceptDrag(event)) return;
        // 拖到列表边缘时滚动，让较长的分组列表也能到达屏幕外的目标。
        const container = scrollContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          if (event.clientY < rect.top + 32) container.scrollTop -= 16;
          else if (event.clientY > rect.bottom - 32) container.scrollTop += 16;
        }
      },
      onDragLeave: (event: ReactDragEvent<HTMLElement>) => {
        event.stopPropagation();
        // Chromium 跨子元素可能不给 relatedTarget；用命中位置确认是否真的离开分组。
        const next = event.relatedTarget instanceof Node
          ? event.relatedTarget
          : document.elementFromPoint(event.clientX, event.clientY);
        if (!next || !event.currentTarget.contains(next)) {
          setDropTarget((current) => current === key ? null : current);
          setDropInsertion((current) => current?.key === key ? null : current);
          if (!draggedTabRef.current && (!next || !scrollContainerRef.current?.contains(next))) finishTabDrag();
        }
      },
      onDrop: (event: ReactDragEvent<HTMLElement>) => {
        event.stopPropagation();
        const tab = tabs.find((item) => item.id === draggedTabRef.current);
        if (!tab) {
          // 非网页文件不创建页签，也不能让内核接管并替换 Tree 文档。
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
          finishTabDrag();
          return;
        }
        event.preventDefault();
        const beforeTabId = position(event);
        finishTabDrag();
        onMoveTab(tab.id, groupId, smallGroupId, beforeTabId);
      },
    };
  }

  /** 拖动结束或按 Escape 取消后清理高亮，避免残留目标提示。 */
  function finishTabDrag() {
    draggedTabRef.current = null;
    setDraggedTabId(null);
    setExternalDragging(false);
    setDropTarget(null);
    setDropInsertion(null);
  }

  /** 末尾或空列表使用零高度锚点显示插入线，不挤动行位置或改变拖放命中。 */
  function renderDropEnd(groupId: string, smallGroupId?: string) {
    return dropInsertion?.key === JSON.stringify([groupId, smallGroupId ?? null])
      && dropInsertion.beforeTabId === null
      ? <div className="vertical-tree-drop-end" aria-hidden="true"><span className="vertical-tree-drop-line" /></div>
      : null;
  }

  // 悬停折叠分组后展开，便于继续拖入内部小分组；离开目标立即取消定时器。
  useEffect(() => {
    if (!dropTarget || (!draggedTabId && !externalDragging)) return;
    const [groupId, smallGroupId] = JSON.parse(dropTarget) as [string, string | null];
    const timer = window.setTimeout(() => {
      if (collapsedGroups.has(groupId)) onToggleGroup?.(groupId);
      if (smallGroupId && collapsedSmallGroups.has(smallGroupId)) onToggleSmallGroup?.(smallGroupId);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [dropTarget, draggedTabId, externalDragging, collapsedGroups, collapsedSmallGroups, onToggleGroup, onToggleSmallGroup]);

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

  /** 点击按钮显式展开或收起面板，独立窗口与内嵌列表使用相同文案。 */
  function togglePanelPinned() {
    onPinPanel?.();
  }

  /** 展开与收缩状态都在组项右键位置打开菜单，阻止冒泡以免触发其他节点菜单。 */
  function openGroupContextMenu(event: ReactMouseEvent<HTMLElement>, groupId: string, smallGroupId?: string) {
    event.preventDefault();
    event.stopPropagation();
    onTreeActionsOpen(groupId, smallGroupId, event.clientX, event.clientY);
  }

  /** 树节点不显示悬停标题；完整名称通过 aria-label 提供给辅助技术。 */
  function renderTab(tab: BrowserTab) {
    const active = tab.id === activeId;
    return (
      <div
        key={tab.id}
        className={`vertical-tree-tab${active ? " is-active" : ""}${tab.audible || tab.muted ? " has-audio" : ""}${draggedTabId === tab.id ? " is-dragging" : ""}`}
        data-browser-tab-id={tab.id}
      >
        {dropInsertion?.beforeTabId === tab.id ? <span className="vertical-tree-drop-line" aria-hidden="true" /> : null}
        <Button
          className="vertical-tree-tab__select"
          variant="text"
          size="small"
          icon={<BrowserFavicon url={tab.url} faviconUrl={tab.faviconPageUrl === tab.url ? tab.faviconUrl : undefined} loading={tab.loading} size={15} />}
          aria-label={tab.title}
          aria-current={active ? "page" : undefined}
          draggable
          onDragStart={(event) => {
            draggedTabRef.current = tab.id;
            setDraggedTabId(tab.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("application/x-sia-browser-tab", tab.id);
          }}
          onDragEnd={finishTabDrag}
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
      <div
        key={tab.id}
        className="vertical-tree-compact-item"
        data-browser-tab-id={tab.id}
      >
        <Button
          className={`vertical-tree-compact-tab${active ? " is-active" : ""}`}
          variant="text"
          size="small"
          icon={(
            <span className={`vertical-tree-compact-tab__visual${tab.sleeping ? " is-sleeping" : ""}`}>
              <BrowserFavicon url={tab.url} faviconUrl={tab.faviconPageUrl === tab.url ? tab.faviconUrl : undefined} loading={tab.loading} size={16} />
            </span>
          )}
          aria-label={accessibleTitle}
          aria-current={active ? "page" : undefined}
          // 图标相同的页面通过完整标题、网址和状态区分，不依赖原生 title。
          {...compactTooltip.handlers({ title: tab.title || "新标签页", url: tab.url, detail: statusText })}
          onClick={() => onSelect(tab.id)}
        />
        {tab.muted || tab.audible ? (
          // 与选页按钮平级，声音操作拥有独立的鼠标与键盘点击区域。
          <Button
            className={`vertical-tree-compact-audio${tab.muted ? " is-muted" : ""}`}
            variant="text"
            size="small"
            icon={<Icon name={tab.muted ? "speaker-muted" : "speaker-wave"} size={13} />}
            aria-label={tab.muted ? `取消静音 ${tab.title}` : `静音 ${tab.title}`}
            aria-pressed={tab.muted}
            onClick={(event) => {
              event.stopPropagation();
              onToggleAudio(tab.id);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <aside
      className={`vertical-tab-tree${panelExpanded ? "" : " is-collapsed"}${floatingWindow ? " is-floating-window" : panelPinned ? " is-pinned" : " is-floating"}${resizing ? " is-resizing" : ""}`}
      style={{
        width: floatingWindow ? "calc(100vw - 8px)" : panelExpanded ? panelWidth : COMPACT_PANEL_WIDTH,
        minWidth: floatingWindow ? "calc(100vw - 8px)" : panelExpanded ? panelWidth : COMPACT_PANEL_WIDTH,
      }}
      aria-label="垂直标签页"
      onDragEnterCapture={event => {
        // 即使没有根级标签，外部文件进入侧栏时也显示根级投放区域。
        if (!draggedTabRef.current && event.dataTransfer.types.includes("Files")) setExternalDragging(true);
      }}
      onDragLeave={event => {
        const next = event.relatedTarget instanceof Node ? event.relatedTarget : document.elementFromPoint(event.clientX, event.clientY);
        if (!draggedTabRef.current && (!next || !event.currentTarget.contains(next))) finishTabDrag();
      }}
    >
      <div className="vertical-tab-tree__header">
        {panelExpanded ? (
          <>
            <div className="vertical-tab-tree__actions">
              {/* 常用新增操作直接显示名称，与节点菜单统一使用“标签页”称呼。 */}
              <Button
                className="vertical-tree-header-action vertical-tree-header-action--text"
                variant="text"
                size="small"
                aria-label="新建标签页"
                onClick={onNewRootTab}
              >
                新建标签页
              </Button>
              <Button
                className="vertical-tree-header-action vertical-tree-header-action--text"
                variant="text"
                size="small"
                aria-label="新建分组"
                onClick={onNewGroup}
              >
                新建分组
              </Button>
              <Button
                // 左箭头表示收起当前展开的列表，与固定状态无关。
                className="vertical-tree-header-action vertical-tree-header-action--toggle is-active"
                variant="text"
                size="small"
                icon={<Icon name="chevron-left" size={17} />}
                aria-label="收起标签面板"
                aria-expanded={true}
                onClick={togglePanelPinned}
              />
            </div>
          </>
        ) : (
          <Button
            // 右箭头表示向右展开标签列表，悬停提示与实际动作保持一致。
            className="vertical-tree-header-action vertical-tree-header-action--toggle"
            variant="text"
            size="small"
            icon={<Icon name="chevron-right" size={17} />}
            aria-label="展开标签面板"
            aria-expanded={false}
            {...compactTooltip.handlers({ title: "展开标签面板" })}
            onClick={togglePanelPinned}
          />
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
              // 整个大分组都可接收；小分组处理器阻止冒泡以保持更精确的归属。
              {...dropHandlers(group.id)}
            >
              <div
                className="vertical-tree-node-context"
                onContextMenu={(event) => openGroupContextMenu(event, group.id)}
              >
                <div className="vertical-tree-group__heading">
                  <Button
                    className="vertical-tree-group__toggle"
                    variant="text"
                    size="small"
                    aria-expanded={!groupCollapsed}
                    onClick={() => onToggleGroup?.(group.id)}
                  >
                    <span className={`vertical-tree-group__name${activeGroupParent ? " is-current-ancestor" : ""}`}>
                      {group.name}
                    </span>
                    {/* 箭头与行尾操作一起按悬停状态显示，隐藏时释放标题宽度。 */}
                    <Icon className="vertical-tree-node-chevron" name={groupCollapsed ? "chevron-right" : "chevron-down"} size={13} />
                  </Button>
                  <Button
                    className="vertical-tree-icon-button"
                    variant="text"
                    size="small"
                    icon={<Icon name="plus" size={15} />}
                    aria-label={`在分组 ${group.name} 的根节点新建标签页`}
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
                      <section key={smallGroup.id} className="vertical-tree-small-group" {...dropHandlers(group.id, smallGroup.id)}>
                        <div
                          className="vertical-tree-node-context"
                          onContextMenu={(event) => openGroupContextMenu(event, group.id, smallGroup.id)}
                        >
                          <div className="vertical-tree-small-group__heading">
                            <Button
                              className="vertical-tree-small-group__toggle"
                              variant="text"
                              size="small"
                              icon={<Icon name="folder" size={16} />}
                              aria-expanded={!smallGroupCollapsed}
                              onClick={() => onToggleSmallGroup?.(smallGroup.id)}
                            >
                              <span className={`vertical-tree-small-group__name${activeSmallGroupParent ? " is-current-ancestor" : ""}`}>
                                {smallGroup.name}
                              </span>
                              <Icon className="vertical-tree-node-chevron" name={smallGroupCollapsed ? "chevron-right" : "chevron-down"} size={12} />
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
                            {renderDropEnd(group.id, smallGroup.id)}
                          </div>
                        ) : renderDropEnd(group.id, smallGroup.id)}
                      </section>
                    );
                  })}
                  <div className="vertical-tree-group__direct-tabs">
                    {directTabs.map(renderTab)}
                    {renderDropEnd(group.id)}
                  </div>
                </div>
              ) : renderDropEnd(group.id)}
            </section>
          );
          })}
            {rootTabs.length > 0 || draggedTabId || externalDragging ? (
              <div className="vertical-tab-tree__root-tabs" aria-label="根级标签页" {...dropHandlers(ROOT_GROUP_ID)}>
                {/* 仅空根列表显示投放提示，避免起拖时插入文案挤动已有根标签及插入位置。 */}
                {(draggedTabId || externalDragging) && rootTabs.length === 0 ? <span className="vertical-tree-drop-hint">{externalDragging ? "拖到此处新建根级标签" : "拖到此处移出分组"}</span> : null}
                {rootTabs.map(renderTab)}
                {renderDropEnd(ROOT_GROUP_ID)}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {!panelExpanded ? (
        <div ref={scrollContainerRef} className="vertical-tab-tree__compact-scroll" aria-label="紧凑标签列表">
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
                  aria-label={`分组：${group.name}`}
                  {...compactTooltip.handlers({ title: group.name, detail: `${groupTabs.length} 个标签页` })}
                  aria-expanded={!groupCollapsed}
                  onContextMenu={(event) => openGroupContextMenu(event, group.id)}
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
                            aria-label={`小分组：${smallGroup.name}`}
                            {...compactTooltip.handlers({ title: smallGroup.name, detail: `${group.name} · ${smallGroupTabs.length} 个标签页` })}
                            aria-expanded={!smallGroupCollapsed}
                            onContextMenu={(event) => openGroupContextMenu(event, group.id, smallGroup.id)}
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
      {/* 收缩列表只保留滚轮滚动，不挂载浮动滚动条；展开时沿用框架滚动条。 */}
      {panelExpanded ? <FloatingScrollbarProvider targetRef={scrollContainerRef} /> : null}
      {compactTooltip.bubble}
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
