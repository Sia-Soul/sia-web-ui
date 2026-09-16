import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import type { ButtonProps } from "./Button";
import { Dropdown } from "./Dropdown";
import type { MenuItem } from "./Navigation";
import { Icon } from "./Icon";

/** 单个工具栏操作及其下拉菜单。 */
export interface ToolbarItem {
  /** 操作唯一标识，点击后由 onAction 返回。 */
  key: string;
  /** 按钮与溢出菜单共用的文案。 */
  label: ReactNode;
  /** 按钮与菜单图标。 */
  icon?: ReactNode;
  /** 禁用该操作及其下级操作。 */
  disabled?: boolean;
  /** 主按钮的等待状态，等待期间不可再次触发。 */
  loading?: boolean;
  /** 危险操作样式。 */
  danger?: boolean;
  /** 完全隐藏该操作，不占宽度，也不进入溢出菜单。 */
  hidden?: boolean;
  /** 下拉操作；split 为 true 时主按钮和下拉箭头可分别操作。 */
  children?: readonly ToolbarItem[];
  /** 使用独立的主操作按钮和下拉箭头。 */
  split?: boolean;
}
/** 单行自适应工具栏的配置。 */
export interface ToolbarProps {
  /** 按展示顺序排列的操作配置。 */
  items: readonly ToolbarItem[];
  /** 业务处理回调；异步状态由调用方通过 loading/disabled 控制。 */
  onAction?: (key: string) => void | Promise<void>;
  /** 禁用全部操作。 */
  disabled?: boolean;
  /** 按钮尺寸，默认 small。 */
  size?: ButtonProps["size"];
  /** 按钮样式，默认 link。 */
  variant?: ButtonProps["variant"];
  /** 溢出入口的无障碍名称与提示，默认“更多操作”。 */
  overflowLabel?: string;
}

/** 单行操作栏；宽度不足时按原顺序将尾部操作收纳到 hover 菜单。 */
export function Toolbar({ items, onAction, disabled = false, size = "small", variant = "link", overflowLabel = "更多操作" }: ToolbarProps) {
  const root = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(Number.MAX_SAFE_INTEGER);
  const visibleItems = items.filter(item => !item.hidden);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const buttons = Array.from(element.querySelectorAll<HTMLElement>("[data-sia-toolbar-item]"));
    const more = element.querySelector<HTMLElement>("[data-sia-toolbar-more]");
    const measure = () => {
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      const widths = buttons.map(button => button.getBoundingClientRect().width);
      const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap;
      let count = widths.length;
      if (total > element.clientWidth) {
        const budget = element.clientWidth - (more?.getBoundingClientRect().width ?? 30);
        let used = 0;
        count = 0;
        for (const width of widths) {
          if (used + width + gap > budget) break;
          used += width + gap;
          count++;
        }
      }
      setVisibleCount(previous => previous === count ? previous : count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    buttons.forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [items, size, variant]);
  const blocked = (item: ToolbarItem) => disabled || Boolean(item.disabled || item.loading);
  const invoke = (key: string) => {
    const find = (entries: readonly ToolbarItem[]): ToolbarItem | undefined => {
      for (const item of entries) {
        if (item.hidden || blocked(item)) continue;
        if (item.key === key) return item;
        const child = item.children && find(item.children);
        if (child) return child;
      }
    };
    if (find(items)) void onAction?.(key);
  };
  const menuItems = (entries: readonly ToolbarItem[]): MenuItem[] => entries.filter(item => !item.hidden).map(item => ({
    key: item.children?.length ? `toolbar-menu:${item.key}` : item.key,
    label: item.label, icon: item.icon, disabled: blocked(item), danger: item.danger,
    children: item.children?.length ? [
      ...(item.split ? [{ key: item.key, label: item.label, icon: item.icon, disabled: blocked(item) }] : []),
      ...menuItems(item.children),
    ] : undefined,
  }));
  const overflow = visibleItems.slice(visibleCount);
  return <div ref={root} className="sia-toolbar" role="toolbar">
    {visibleItems.map((item, index) => {
      const buttonProps = { size, variant, icon: item.icon, disabled: blocked(item), loading: item.loading, danger: item.danger };
      const menu = { items: menuItems(item.children ?? []), onClick: ({ key }: { key: string }) => invoke(key) };
      return <span key={item.key} data-sia-toolbar-item className={`sia-toolbar__item${index >= visibleCount ? " sia-toolbar__item--hidden" : ""}`} aria-hidden={index >= visibleCount || undefined}>
        {item.children?.length ? item.split
          ? <Dropdown.Button trigger={["hover"]} menu={menu} disabled={blocked(item)} buttonProps={buttonProps} onClick={() => invoke(item.key)}>{item.label}</Dropdown.Button>
          : <Dropdown trigger={["hover"]} menu={menu}><Button {...buttonProps}>{item.label}</Button></Dropdown>
          : <Button {...buttonProps} onClick={() => invoke(item.key)}>{item.label}</Button>}
      </span>;
    })}
    <span data-sia-toolbar-more className={`sia-toolbar__item${overflow.length ? "" : " sia-toolbar__item--hidden"}`} aria-hidden={!overflow.length || undefined}>
      <Dropdown trigger={["hover"]} menu={{ items: menuItems(overflow), onClick: ({ key }) => invoke(key) }}>
        <Button size={size} variant={variant} disabled={disabled} aria-label={overflowLabel} title={overflowLabel} icon={<Icon name="more-horizontal" size={16} />} />
      </Dropdown>
    </span>
  </div>;
}
