import { useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

export type CardAccent = "primary" | "success" | "warning" | "error";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  accent?: CardAccent;
  accentColor?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  bodyHeight?: number | string;
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
}

export function Card({
  title,
  description,
  extra,
  accent,
  accentColor,
  collapsible = false,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  bodyHeight,
  bodyClassName = "",
  bodyStyle,
  className = "",
  style,
  children,
  ...props
}: CardProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internalCollapsed;
  const hasHeader = title || extra || collapsible;
  const mergedStyle = accentColor ? ({ "--sia-card-accent": accentColor, ...style } as CSSProperties) : style;
  const mergedBodyStyle: CSSProperties = bodyHeight === undefined
    ? { ...bodyStyle }
    : { height: bodyHeight, overflowY: "auto", ...bodyStyle };

  function toggleCollapsed() {
    const nextCollapsed = !isCollapsed;
    if (collapsed === undefined) setInternalCollapsed(nextCollapsed);
    onCollapsedChange?.(nextCollapsed);
  }

  const heading = (
    <span className="sia-card__heading">
      {accent || accentColor ? <span className={`sia-card__accent${accent ? ` sia-card__accent--${accent}` : ""}`} aria-hidden="true" /> : null}
      {title ? <h3 className="sia-card__title">{title}</h3> : null}
    </span>
  );

  return (
    <section className={`sia-card${isCollapsed ? " sia-card--collapsed" : ""} ${className}`.trim()} style={mergedStyle} {...props}>
      {hasHeader ? (
        <header className="sia-card__header">
          {collapsible ? (
            <button type="button" className="sia-card__collapse-trigger" aria-expanded={!isCollapsed} onClick={toggleCollapsed}>
              {heading}
              <Icon name={isCollapsed ? "chevron-down" : "chevron-up"} size={16} />
            </button>
          ) : heading}
          {extra ? <div className="sia-card__extra">{extra}</div> : null}
        </header>
      ) : null}
      {!isCollapsed ? (
        <>
          {description ? <p className="sia-card__description">{description}</p> : null}
          <div className={`sia-card__body ${bodyClassName}`.trim()} style={mergedBodyStyle}>{children}</div>
        </>
      ) : null}
    </section>
  );
}
