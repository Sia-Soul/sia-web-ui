import type { HTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import type { DropdownMenuProps } from "./Dropdown";
import { Icon } from "./Icon";
import "../breadcrumb.css";

export interface BreadcrumbItem {
  key?: string;
  title: ReactNode;
  icon?: ReactNode;
  href?: string;
  target?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  /** 覆盖当前项后方的分隔符，null 可隐藏分隔符。 */
  separator?: ReactNode;
  menu?: DropdownMenuProps;
}
export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  items: readonly BreadcrumbItem[];
  separator?: ReactNode;
  itemRender?: (item: BreadcrumbItem, index: number, items: readonly BreadcrumbItem[]) => ReactNode;
}

export function Breadcrumb({ items, separator = "/", itemRender, className = "", ...props }: BreadcrumbProps) {
  return <nav aria-label="面包屑导航" {...props} className={`sia-breadcrumb ${className}`.trim()}>
    <ol className="sia-breadcrumb__list">
      {items.map((item, index) => {
        const current = index === items.length - 1;
        const content = <>{item.icon ? <span className="sia-breadcrumb__icon" aria-hidden="true">{item.icon}</span> : null}<span className="sia-breadcrumb__title">{item.title}</span></>;
        const custom = itemRender?.(item, index, items);
        const label = item.disabled ? <span className="sia-breadcrumb__label" aria-disabled="true">{content}</span>
          : custom !== undefined ? <span className="sia-breadcrumb__label">{custom}</span>
          : item.href ? <a className="sia-breadcrumb__label" href={item.href} target={item.target} rel={item.target === "_blank" ? "noopener noreferrer" : undefined} onClick={item.onClick}>{content}</a>
          : item.onClick ? <Button className="sia-breadcrumb__label" variant="text" onClick={item.onClick}>{content}</Button>
          : <span className="sia-breadcrumb__label">{content}</span>;
        return <li className={`sia-breadcrumb__item${current ? " is-current" : ""}${item.disabled ? " is-disabled" : ""}`} key={item.key ?? index}>
          <span className="sia-breadcrumb__entry" aria-current={current ? "page" : undefined}>
            {label}
            {item.menu?.items.length ? <Dropdown menu={item.menu} trigger={["click"]} disabled={item.disabled}>
              <Button className="sia-breadcrumb__menu-trigger" variant="text" size="small" disabled={item.disabled} aria-label={`展开${typeof item.title === "string" ? item.title : "层级"}菜单`} icon={<Icon name="chevron-down" size={12} />} />
            </Dropdown> : null}
          </span>
          {!current ? <span className="sia-breadcrumb__separator" aria-hidden="true">{item.separator === undefined ? separator : item.separator}</span> : null}
        </li>;
      })}
    </ol>
  </nav>;
}
