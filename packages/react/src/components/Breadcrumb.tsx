import type { HTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import type { DropdownMenuProps } from "./Dropdown";
import { Icon } from "./Icon";
import "../breadcrumb.css";

/** 面包屑的项目定义。 */
export interface BreadcrumbItem {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key?: string;
  /** 标题内容，可传入文本或 React 节点。 */
  title: ReactNode;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 链接目标地址。 */
  href?: string;
  /** 关联的目标元素或获取目标元素的函数。 */
  target?: string;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 点击时触发，参数为当前点击事件或项目上下文。 */
  onClick?: MouseEventHandler<HTMLElement>;
  /** 覆盖当前项后方的分隔符，null 可隐藏分隔符。 */
  separator?: ReactNode;
  /** 菜单项、选中状态与点击回调 */
  menu?: DropdownMenuProps;
}
/** 面包屑的属性配置。 */
export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  /** 按层级排列的项目，最后一项表示当前页面 */
  items: readonly BreadcrumbItem[];
  /**
   * 全局分隔符，可传入图标或文字
   * @defaultValue "/"
   */
  separator?: ReactNode;
  /** 自定义项目内容，可接入路由 Link */
  itemRender?: (item: BreadcrumbItem, index: number, items: readonly BreadcrumbItem[]) => ReactNode;
}

/** 面包屑组件。 */
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
