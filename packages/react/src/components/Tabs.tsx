import { useId, useMemo, useState } from "react";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { Icon } from "./Icon";
import type { MenuClickInfo, MenuItem } from "./Navigation";
import type { ControlSize } from "./shared";

export interface TabItem {
  key: string;
  label: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  closable?: boolean;
}

export type TabsType = "line" | "card" | "pill";
export type TabsOrientation = "horizontal" | "vertical";
export type TabsPosition = "top" | "right" | "bottom" | "left";
export type TabsContextMenuClickInfo = MenuClickInfo & {
  tabKey: string;
  tab: TabItem;
};

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: readonly TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  type?: TabsType;
  size?: ControlSize;
  tabPosition?: TabsPosition;
  orientation?: TabsOrientation;
  centered?: boolean;
  tabBarExtraContent?: ReactNode;
  destroyInactiveTabPane?: boolean;
  closable?: boolean;
  onEdit?: (key: string, action: "remove") => void;
  tabContextMenu?: readonly MenuItem[] | ((tab: TabItem) => readonly MenuItem[]);
  onTabContextMenuClick?: (info: TabsContextMenuClickInfo) => void;
}

export function Tabs({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  type = "line",
  size = "medium",
  tabPosition,
  orientation = "horizontal",
  centered = false,
  tabBarExtraContent,
  destroyInactiveTabPane = true,
  closable = false,
  onEdit,
  tabContextMenu,
  onTabContextMenuClick,
  className = "",
  ...props
}: TabsProps) {
  const firstEnabledKey = items.find((item) => !item.disabled)?.key ?? "";
  const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey ?? firstEnabledKey);
  const currentKey = activeKey ?? internalActiveKey;
  const selectedKey = items.some((item) => item.key === currentKey && !item.disabled) ? currentKey : firstEnabledKey;
  const baseId = useId().replace(/:/g, "");
  const enabledItems = useMemo(() => items.filter((item) => !item.disabled), [items]);
  const resolvedPosition = tabPosition ?? (orientation === "vertical" ? "left" : "top");
  const resolvedOrientation: TabsOrientation = resolvedPosition === "left" || resolvedPosition === "right" ? "vertical" : "horizontal";

  function selectTab(key: string) {
    if (key === selectedKey) return;
    if (activeKey === undefined) setInternalActiveKey(key);
    onChange?.(key);
  }

  function focusAndSelect(key: string) {
    selectTab(key);
    document.getElementById(`${baseId}-tab-${key}`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: string) {
    const previousKey = resolvedOrientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = resolvedOrientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (![previousKey, nextKey, "Home", "End"].includes(event.key) || enabledItems.length === 0) return;
    event.preventDefault();
    const currentIndex = Math.max(0, enabledItems.findIndex((item) => item.key === key));
    if (event.key === "Home") return focusAndSelect(enabledItems[0].key);
    if (event.key === "End") return focusAndSelect(enabledItems[enabledItems.length - 1].key);
    const offset = event.key === nextKey ? 1 : -1;
    const nextIndex = (currentIndex + offset + enabledItems.length) % enabledItems.length;
    focusAndSelect(enabledItems[nextIndex].key);
  }

  const hasPanels = items.some((item) => item.children !== undefined);

  return (
    <div
      className={`sia-tabs sia-tabs--${type} sia-tabs--${size} sia-tabs--${resolvedOrientation} sia-tabs--${resolvedPosition}${centered ? " sia-tabs--centered" : ""} ${className}`.trim()}
      {...props}
    >
      <div className="sia-tabs__header">
        <div className="sia-tabs__list" role="tablist" aria-orientation={resolvedOrientation}>
          {items.map((item) => {
            const selected = item.key === selectedKey;
            const canClose = item.closable ?? closable;
            const tabNode = (
              <span className={`sia-tabs__tab-wrap${canClose ? " is-closable" : ""}`} key={item.key}>
                <button
                  id={`${baseId}-tab-${item.key}`}
                  type="button"
                  className="sia-tabs__tab"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={hasPanels ? `${baseId}-panel-${item.key}` : undefined}
                  tabIndex={selected ? 0 : -1}
                  disabled={item.disabled}
                  onClick={() => selectTab(item.key)}
                  onKeyDown={(event) => handleKeyDown(event, item.key)}
                >
                  {item.icon ? <span className="sia-tabs__icon">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </button>
                {canClose ? (
                  <button
                    type="button"
                    className="sia-tabs__close"
                    aria-label={`关闭${typeof item.label === "string" ? item.label : "标签页"}`}
                    disabled={item.disabled}
                    onClick={() => onEdit?.(item.key, "remove")}
                  >
                    <Icon name="close" size={12} />
                  </button>
                ) : null}
              </span>
            );
            const contextMenuItems = typeof tabContextMenu === "function"
              ? tabContextMenu(item)
              : tabContextMenu;
            if (!contextMenuItems?.length) return tabNode;
            return (
              <Dropdown
                key={item.key}
                className="sia-tabs__tab-context-trigger"
                popupClassName="sia-tabs__tab-context-menu"
                trigger={["contextMenu"]}
                tabIndex={-1}
                menu={{
                  items: contextMenuItems,
                  selectable: false,
                  onClick: (info) => onTabContextMenuClick?.({ ...info, tabKey: item.key, tab: item }),
                }}
              >
                {tabNode}
              </Dropdown>
            );
          })}
        </div>
        {tabBarExtraContent ? <div className="sia-tabs__extra">{tabBarExtraContent}</div> : null}
      </div>
      {hasPanels ? (
        <div className="sia-tabs__panels">
          {items.map((item) => {
            const selected = item.key === selectedKey;
            if (destroyInactiveTabPane && !selected) return null;
            return (
              <div
                key={item.key}
                id={`${baseId}-panel-${item.key}`}
                className="sia-tabs__panel"
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-${item.key}`}
                hidden={!selected}
                tabIndex={0}
              >
                {item.children}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
