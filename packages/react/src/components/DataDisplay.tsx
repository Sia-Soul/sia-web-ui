import { Children, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ImgHTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useControllableState } from "./shared";

export interface RateProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: number;
  defaultValue?: number;
  count?: number;
  allowHalf?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  character?: ReactNode | ((index: number) => ReactNode);
  tooltips?: readonly string[];
  onChange?: (value: number) => void;
  onHoverChange?: (value: number) => void;
}

export function Rate({ value, defaultValue = 0, count = 5, allowHalf = false, allowClear = true, disabled = false, character, tooltips, onChange, onHoverChange, className = "", ...props }: RateProps) {
  const [current, setCurrent] = useControllableState({ value, defaultValue, onChange });
  const [hover, setHover] = useState(0);
  const shown = hover || current;
  function choose(next: number) { setCurrent(allowClear && next === current ? 0 : next); }
  return <div className={`sia-rate${disabled ? " is-disabled" : ""} ${className}`.trim()} role="radiogroup" aria-label="评分" onMouseLeave={() => { setHover(0); onHoverChange?.(0); }} {...props}>
    {Array.from({ length: count }, (_, index) => {
      const whole = index + 1;
      const fill = Math.max(0, Math.min(1, shown - index));
      const content = typeof character === "function" ? character(index) : character ?? <Icon name="star" variant="filled" />;
      return <span className="sia-rate__item" key={whole} title={tooltips?.[index]}>
        <button type="button" disabled={disabled} role="radio" aria-checked={current === whole} aria-label={`${whole} 星`} onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const next = allowHalf && event.clientX - rect.left < rect.width / 2 ? whole - .5 : whole;
          setHover(next); onHoverChange?.(next);
        }} onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          choose(allowHalf && event.clientX - rect.left < rect.width / 2 ? whole - .5 : whole);
        }} onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); setCurrent(Math.min(count, current + (allowHalf ? .5 : 1))); }
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); setCurrent(Math.max(0, current - (allowHalf ? .5 : 1))); }
        }}>
          <span className="sia-rate__base">{content}</span><span className="sia-rate__fill" style={{ width: `${fill * 100}%` }}>{content}</span>
        </button>
      </span>;
    })}
  </div>;
}

export type BadgeStatus = "success" | "processing" | "default" | "error" | "warning";
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  count?: ReactNode;
  showZero?: boolean;
  overflowCount?: number;
  dot?: boolean;
  status?: BadgeStatus;
  text?: ReactNode;
  color?: string;
  offset?: readonly [number, number];
  size?: "default" | "small";
}
export interface BadgeRibbonProps extends HTMLAttributes<HTMLDivElement> { text?: ReactNode; color?: string; placement?: "start" | "end" }

function BadgeRibbon({ text, color, placement = "end", className = "", children, ...props }: BadgeRibbonProps) {
  return <div className={`sia-ribbon-wrap ${className}`.trim()} {...props}>{children}<span className={`sia-ribbon sia-ribbon--${placement}`} style={{ backgroundColor: color }}>{text}</span></div>;
}

export function Badge({ count, showZero = false, overflowCount = 99, dot = false, status, text, color, offset = [0, 0], size = "default", className = "", children, style, ...props }: BadgeProps) {
  const numeric = typeof count === "number";
  const hidden = !dot && !status && (count === undefined || count === null || (count === 0 && !showZero));
  const display = numeric && count > overflowCount ? `${overflowCount}+` : count;
  const badge = !hidden ? <sup className={`sia-badge__count${dot || status ? " sia-badge__dot" : ""}${status ? ` sia-badge__dot--${status}` : ""} sia-badge__count--${size}`} style={{ backgroundColor: color, transform: `translate(calc(50% + ${offset[0]}px), calc(-50% + ${offset[1]}px))` }}>{dot || status ? null : display}</sup> : null;
  if (status && !children) return <span className={`sia-badge sia-badge--status ${className}`.trim()} style={style} {...props}>{badge}{text ? <span className="sia-badge__text">{text}</span> : null}</span>;
  return <span className={`sia-badge ${className}`.trim()} style={style} {...props}>{children}{badge}{text && !status ? <span className="sia-badge__text">{text}</span> : null}</span>;
}
Badge.Ribbon = BadgeRibbon;

function pad(value: number) { return String(value).padStart(2, "0"); }
function formatDate(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseDate(value?: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
export interface CalendarProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange" | "onSelect"> {
  value?: string;
  defaultValue?: string;
  mode?: "month" | "year";
  fullscreen?: boolean;
  validRange?: readonly [string, string];
  disabledDate?: (date: string) => boolean;
  dateCellRender?: (date: string) => ReactNode;
  fullCellRender?: (date: string, info: { originNode: ReactNode; type: "date" }) => ReactNode;
  headerRender?: (config: { value: string; mode: "month" | "year"; onChange: (value: string) => void; onTypeChange: (mode: "month" | "year") => void }) => ReactNode;
  onChange?: (date: string) => void;
  onSelect?: (date: string) => void;
  onPanelChange?: (date: string, mode: "month" | "year") => void;
}
const WEEK = ["一", "二", "三", "四", "五", "六", "日"];
const MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

export function Calendar({ value, defaultValue, mode = "month", fullscreen = true, validRange, disabledDate, dateCellRender, fullCellRender, headerRender, onChange, onSelect, onPanelChange, className = "", ...props }: CalendarProps) {
  const [selected, setSelected] = useControllableState({ value, defaultValue: defaultValue ?? formatDate(new Date()), onChange });
  const [panelMode, setPanelMode] = useState(mode);
  const [panel, setPanel] = useState(() => { const date = parseDate(value ?? defaultValue); return new Date(date.getFullYear(), date.getMonth(), 1); });
  useEffect(() => { if (value) { const date = parseDate(value); setPanel(new Date(date.getFullYear(), date.getMonth(), 1)); } }, [value]);
  const grid = useMemo(() => {
    const first = new Date(panel.getFullYear(), panel.getMonth(), 1);
    const mondayIndex = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(panel.getFullYear(), panel.getMonth(), index - mondayIndex + 1));
  }, [panel]);
  function setPanelValue(next: Date) { setPanel(next); onPanelChange?.(formatDate(next), panelMode); }
  function setMode(next: "month" | "year") { setPanelMode(next); onPanelChange?.(formatDate(panel), next); }
  const headerConfig = { value: formatDate(panel), mode: panelMode, onChange: (next: string) => setPanelValue(parseDate(next)), onTypeChange: setMode };
  return <div className={`sia-calendar${fullscreen ? " sia-calendar--fullscreen" : " sia-calendar--mini"} ${className}`.trim()} {...props}>
    <div className="sia-calendar__header">{headerRender ? headerRender(headerConfig) : <>
      <button type="button" aria-label="上一页" onClick={() => setPanelValue(new Date(panel.getFullYear() - (panelMode === "year" ? 1 : 0), panel.getMonth() - (panelMode === "month" ? 1 : 0), 1))}><Icon name="chevron-left" /></button>
      <strong>{panel.getFullYear()} 年{panelMode === "month" ? ` ${panel.getMonth() + 1} 月` : ""}</strong>
      <div className="sia-calendar__modes"><button className={panelMode === "month" ? "is-active" : ""} onClick={() => setMode("month")}>月</button><button className={panelMode === "year" ? "is-active" : ""} onClick={() => setMode("year")}>年</button></div>
      <button type="button" aria-label="下一页" onClick={() => setPanelValue(new Date(panel.getFullYear() + (panelMode === "year" ? 1 : 0), panel.getMonth() + (panelMode === "month" ? 1 : 0), 1))}><Icon name="chevron-right" /></button>
    </>}</div>
    {panelMode === "year" ? <div className="sia-calendar__months">{MONTHS.map((month, index) => <button key={month} className={panel.getMonth() === index ? "is-selected" : ""} onClick={() => { setPanelValue(new Date(panel.getFullYear(), index, 1)); setMode("month"); }}>{month}</button>)}</div> : <>
      <div className="sia-calendar__week">{WEEK.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="sia-calendar__grid">{grid.map((date) => {
        const key = formatDate(date);
        const outside = date.getMonth() !== panel.getMonth();
        const disabled = Boolean(disabledDate?.(key) || (validRange && (key < validRange[0] || key > validRange[1])));
        const origin = <><span>{date.getDate()}</span>{dateCellRender?.(key)}</>;
        return <button key={key} disabled={disabled} className={`${outside ? "is-outside" : ""}${selected === key ? " is-selected" : ""}${formatDate(new Date()) === key ? " is-today" : ""}`} onClick={() => { setSelected(key); onSelect?.(key); if (outside) setPanelValue(new Date(date.getFullYear(), date.getMonth(), 1)); }}>
          {fullCellRender?.(key, { originNode: origin, type: "date" }) ?? origin}
        </button>;
      })}</div>
    </>}
  </div>;
}

export interface CarouselRef { goTo: (slide: number) => void; next: () => void; prev: () => void }
export interface CarouselProps extends HTMLAttributes<HTMLDivElement> {
  autoplay?: boolean | { dotDuration?: boolean };
  autoplaySpeed?: number;
  arrows?: boolean;
  dots?: boolean | { className?: string };
  effect?: "scroll" | "fade";
  infinite?: boolean;
  initialSlide?: number;
  pauseOnHover?: boolean;
  beforeChange?: (current: number, next: number) => void;
  afterChange?: (current: number) => void;
}

export function Carousel({ autoplay = false, autoplaySpeed = 3000, arrows = false, dots = true, effect = "scroll", infinite = true, initialSlide = 0, pauseOnHover = true, beforeChange, afterChange, className = "", children, ...props }: CarouselProps) {
  const slides = Children.toArray(children);
  const [current, setCurrent] = useState(Math.min(initialSlide, Math.max(0, slides.length - 1)));
  const [paused, setPaused] = useState(false);
  function go(next: number) {
    if (!slides.length) return;
    const resolved = infinite ? (next + slides.length) % slides.length : Math.max(0, Math.min(slides.length - 1, next));
    if (resolved === current) return;
    beforeChange?.(current, resolved); setCurrent(resolved); afterChange?.(resolved);
  }
  useEffect(() => {
    if (!autoplay || paused || slides.length < 2) return;
    const timer = window.setInterval(() => go(current + 1), autoplaySpeed);
    return () => window.clearInterval(timer);
  }, [autoplay, autoplaySpeed, current, paused, slides.length]);
  return <div className={`sia-carousel sia-carousel--${effect} ${className}`.trim()} onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined} onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined} {...props}>
    <div className="sia-carousel__viewport"><div className="sia-carousel__track" style={effect === "scroll" ? { transform: `translateX(-${current * 100}%)` } : undefined}>
      {slides.map((slide, index) => <div className={`sia-carousel__slide${index === current ? " is-active" : ""}`} aria-hidden={index !== current} key={index}>{slide}</div>)}
    </div></div>
    {arrows ? <><button className="sia-carousel__arrow sia-carousel__arrow--prev" disabled={!infinite && current === 0} aria-label="上一张" onClick={() => go(current - 1)}><Icon name="chevron-left" /></button><button className="sia-carousel__arrow sia-carousel__arrow--next" disabled={!infinite && current === slides.length - 1} aria-label="下一张" onClick={() => go(current + 1)}><Icon name="chevron-right" /></button></> : null}
    {dots ? <div className={`sia-carousel__dots${typeof dots === "object" && dots.className ? ` ${dots.className}` : ""}`}>{slides.map((_, index) => <button key={index} aria-label={`切换到第 ${index + 1} 张`} aria-current={index === current} onClick={() => go(index)}><span /></button>)}</div> : null}
  </div>;
}

export type CollapseKey = string | number;
export type CollapseItem = { key: CollapseKey; label: ReactNode; children?: ReactNode; extra?: ReactNode; disabled?: boolean; collapsible?: "header" | "icon" | "disabled"; showArrow?: boolean; forceRender?: boolean; className?: string };
export interface CollapseProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: readonly CollapseItem[];
  activeKey?: CollapseKey | readonly CollapseKey[];
  defaultActiveKey?: CollapseKey | readonly CollapseKey[];
  accordion?: boolean;
  bordered?: boolean;
  ghost?: boolean;
  destroyInactivePanel?: boolean;
  expandIconPosition?: "start" | "end";
  onChange?: (key: CollapseKey | CollapseKey[]) => void;
}

function CollapsePanel({
  open,
  forceRender = false,
  destroyInactivePanel = false,
  children,
}: {
  open: boolean;
  forceRender?: boolean;
  destroyInactivePanel?: boolean;
  children?: ReactNode;
}) {
  const [keepChildren, setKeepChildren] = useState(open || forceRender || !destroyInactivePanel);

  useEffect(() => {
    if (open || forceRender || !destroyInactivePanel) {
      setKeepChildren(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setKeepChildren(false), 240);
    return () => window.clearTimeout(timer);
  }, [destroyInactivePanel, forceRender, open]);

  const renderChildren = open || forceRender || !destroyInactivePanel || keepChildren;
  return <div className="sia-collapse__panel" aria-hidden={!open}>
    <div className="sia-collapse__panel-motion">
      <div className="sia-collapse__panel-body">{renderChildren ? children : null}</div>
    </div>
  </div>;
}

export function Collapse({ items, activeKey, defaultActiveKey = [], accordion = false, bordered = true, ghost = false, destroyInactivePanel = false, expandIconPosition = "start", onChange, className = "", ...props }: CollapseProps) {
  const normalize = (key: CollapseKey | readonly CollapseKey[]) => Array.isArray(key) ? [...key] : key === undefined ? [] : [key as CollapseKey];
  const controlled = activeKey !== undefined;
  const [internal, setInternal] = useState<CollapseKey[]>(normalize(defaultActiveKey));
  const openKeys = controlled ? normalize(activeKey) : internal;
  function toggle(item: CollapseItem) {
    if (item.disabled || item.collapsible === "disabled") return;
    const open = openKeys.includes(item.key);
    const next = accordion ? (open ? [] : [item.key]) : open ? openKeys.filter((key) => key !== item.key) : [...openKeys, item.key];
    if (!controlled) setInternal(next);
    onChange?.(accordion ? next[0] ?? "" : next);
  }
  return <div className={`sia-collapse${bordered ? " sia-collapse--bordered" : ""}${ghost ? " sia-collapse--ghost" : ""} sia-collapse--icon-${expandIconPosition} ${className}`.trim()} {...props}>
    {items.map((item) => {
      const open = openKeys.includes(item.key);
      const arrow = item.showArrow === false ? null : <button className="sia-collapse__arrow" aria-label={open ? "收起" : "展开"} onClick={item.collapsible === "icon" ? () => toggle(item) : undefined}><Icon name="chevron-down" size={14} /></button>;
      return <section className={`sia-collapse__item${open ? " is-open" : ""}${item.disabled ? " is-disabled" : ""} ${item.className ?? ""}`.trim()} key={item.key}>
        <header className="sia-collapse__header" role="button" tabIndex={item.disabled ? -1 : 0} aria-expanded={open} onClick={item.collapsible === "icon" ? undefined : () => toggle(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(item); } }}>
          {expandIconPosition === "start" ? arrow : null}<span className="sia-collapse__label">{item.label}</span>{item.extra ? <span className="sia-collapse__extra" onClick={(event) => event.stopPropagation()}>{item.extra}</span> : null}{expandIconPosition === "end" ? arrow : null}
        </header>
        <CollapsePanel open={open} forceRender={item.forceRender} destroyInactivePanel={destroyInactivePanel}>{item.children}</CollapsePanel>
      </section>;
    })}
  </div>;
}

export interface ImagePreviewConfig { src?: string; open?: boolean; onOpenChange?: (open: boolean) => void; mask?: ReactNode }
export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  placeholder?: ReactNode;
  preview?: boolean | ImagePreviewConfig;
  rootClassName?: string;
}

export function Image({ fallback, placeholder, preview = true, rootClassName = "", className = "", src, alt = "", onError, style, ...props }: ImageProps) {
  const config = typeof preview === "object" ? preview : {};
  const controlled = typeof preview === "object" && preview.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? config.open! : internalOpen;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const displaySrc = failed && fallback ? fallback : src;
  const radius = typeof style?.borderRadius === "number" ? `${style.borderRadius}px` : style?.borderRadius;
  const rootStyle = {
    ...style,
    "--sia-image-radius": radius ?? "var(--sia-radius)",
  } as CSSProperties;
  function setOpen(next: boolean) { if (!controlled) setInternalOpen(next); config.onOpenChange?.(next); }
  return <span className={`sia-image ${rootClassName}`.trim()} style={rootStyle}>
    {!loaded && placeholder ? <span className="sia-image__placeholder">{placeholder}</span> : null}
    <img {...props} src={displaySrc} alt={alt} className={className} onLoad={() => setLoaded(true)} onError={(event) => { if (!failed && fallback) setFailed(true); onError?.(event); }} />
    {preview ? <button type="button" className="sia-image__mask" aria-label="预览图片" onClick={() => setOpen(true)}>{config.mask ?? <><Icon name="eye" />预览</>}</button> : null}
    {open && typeof document !== "undefined" ? createPortal(<div className="sia-image-preview" role="dialog" aria-modal="true" aria-label="图片预览" onClick={() => setOpen(false)}>
      <button aria-label="关闭预览" onClick={() => setOpen(false)}><Icon name="close" /></button><img src={config.src ?? displaySrc} alt={alt} onClick={(event) => event.stopPropagation()} />
    </div>, document.body) : null}
  </span>;
}
