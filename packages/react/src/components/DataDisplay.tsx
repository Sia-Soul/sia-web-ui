import { withTitleTooltip } from "./titleTooltip";
import { Children, createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ImgHTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOverlayMotion } from "./overlayMotion";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { useOverlayLifecycle } from "./Overlay";
import { useControllableState } from "./shared";
import { useControlSize } from "./shared";
import type { ControlSize } from "./shared";

/** 评分的属性配置。 */
export interface RateProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: number;
  /**
   * 非受控模式的初始值，仅在初始化时使用。
   * @defaultValue 0
   */
  defaultValue?: number;
  /**
   * 徽标展示的数量。
   * @defaultValue 5
   */
  count?: number;
  /**
   * 是否允许选择半星。
   * @defaultValue false
   */
  allowHalf?: boolean;
  /**
   是否允许清空当前选择或输入值。
   * @defaultValue true
   */
  allowClear?: boolean;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /** 自定义评分符号。 */
  character?: ReactNode | ((index: number) => ReactNode);
  /** 各评分值对应的提示内容。 */
  tooltips?: readonly string[];
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (value: number) => void;
  /** 悬停目标或悬停值变化时调用。 */
  onHoverChange?: (value: number) => void;
}

/** 评分组件。 */
export function Rate({ value, size: sizeProp, defaultValue = 0, count = 5, allowHalf = false, allowClear = true, disabled = false, character, tooltips, onChange, onHoverChange, className = "", ...props }: RateProps) {
  const size = useControlSize(sizeProp);
  const [current, setCurrent] = useControllableState({ value, defaultValue, onChange });
  const [hover, setHover] = useState(0);
  const shown = hover || current;
  function choose(next: number) { setCurrent(allowClear && next === current ? 0 : next); }
  return <div className={`sia-rate sia-rate--${size}${disabled ? " is-disabled" : ""} ${className}`.trim()} role="radiogroup" aria-label="评分" onMouseLeave={() => { setHover(0); onHoverChange?.(0); }} {...withTitleTooltip(props)}>
    {Array.from({ length: count }, (_, index) => {
      const whole = index + 1;
      const fill = Math.max(0, Math.min(1, shown - index));
      const content = typeof character === "function" ? character(index) : character ?? <Icon name="star" variant="filled" />;
      return <span className="sia-rate__item" key={whole} {...withTitleTooltip({ title: tooltips?.[index] })}>
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

/** 徽标的状态类型。 */
export type BadgeStatus = "success" | "processing" | "default" | "error" | "warning";
/** 徽标的属性配置。 */
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** 徽标展示的数量。 */
  count?: ReactNode;
  /**
   * 数量为 0 时是否仍显示徽标。
   * @defaultValue false
   */
  showZero?: boolean;
  /**
   * 徽标显示的最大数字，超出后显示加号。
   * @defaultValue 99
   */
  overflowCount?: number;
  /**
   * 是否以圆点形式显示状态或徽标。
   * @defaultValue false
   */
  dot?: boolean;
  /** 当前状态，用于选择对应的状态样式。 */
  status?: BadgeStatus;
  /** 显示文本。 */
  text?: ReactNode;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /**
   * 相对于默认位置的偏移。
   * @defaultValue [0, 0]
   */
  offset?: readonly [number, number];
  /**
   * 组件尺寸；用于调整控件高度、字号和间距。
   * @defaultValue "default"
   */
  size?: "default" | "small";
}
/** BadgeRibbon的属性配置。 */
export interface BadgeRibbonProps extends HTMLAttributes<HTMLDivElement> {
  /** 显示文本。 */
  text?: ReactNode;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /**
   * 相对于触发元素的弹出方向和对齐位置。
   * @defaultValue "end"
   */
  placement?: "start" | "end" }

function BadgeRibbon({ text, color, placement = "end", className = "", children, ...props }: BadgeRibbonProps) {
  return <div className={`sia-ribbon-wrap ${className}`.trim()} {...withTitleTooltip(props)}>{children}<span className={`sia-ribbon sia-ribbon--${placement}`} style={{ backgroundColor: color }}>{text}</span></div>;
}

/** 徽标组件。 */
export function Badge({ count, showZero = false, overflowCount = 99, dot = false, status, text, color, offset = [0, 0], size = "default", className = "", children, style, ...props }: BadgeProps) {
  const numeric = typeof count === "number";
  const hidden = !dot && !status && (count === undefined || count === null || (count === 0 && !showZero));
  const display = numeric && count > overflowCount ? `${overflowCount}+` : count;
  const badge = !hidden ? <sup className={`sia-badge__count${dot || status ? " sia-badge__dot" : ""}${status ? ` sia-badge__dot--${status}` : ""} sia-badge__count--${size}`} style={{ backgroundColor: color, transform: `translate(calc(50% + ${offset[0]}px), calc(-50% + ${offset[1]}px))` }}>{dot || status ? null : display}</sup> : null;
  if (status && !children) return <span className={`sia-badge sia-badge--status ${className}`.trim()} style={style} {...withTitleTooltip(props)}>{badge}{text ? <span className="sia-badge__text">{text}</span> : null}</span>;
  return <span className={`sia-badge ${className}`.trim()} style={style} {...withTitleTooltip(props)}>{children}{badge}{text && !status ? <span className="sia-badge__text">{text}</span> : null}</span>;
}
Badge.Ribbon = BadgeRibbon;

function pad(value: number) { return String(value).padStart(2, "0"); }
function formatDate(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseDate(value?: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
/** 日历的属性配置。 */
export interface CalendarProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange" | "onSelect"> {
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: string;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: string;
  /**
   * 展示或交互模式；可选值见类型定义。
   * @defaultValue "month"
   */
  mode?: "month" | "year";
  /**
   是否以全屏形式展示。
   * @defaultValue true
   */
  fullscreen?: boolean;
  /** 允许选择的日期范围。 */
  validRange?: readonly [string, string];
  /** 判断某个日期是否不可选的函数。 */
  disabledDate?: (date: string) => boolean;
  /** 自定义日期单元格的附加内容。 */
  dateCellRender?: (date: string) => ReactNode;
  /** 完整替换日期单元格的渲染函数。 */
  fullCellRender?: (date: string, info: {
  /** 组件默认生成的原始节点，可用于包装或复用。 */
  originNode: ReactNode;
  /** 类型标识，用于选择对应的表现形式。 */
  type: "date" }) => ReactNode;
  /** 自定义头部渲染。 */
  headerRender?: (config: {
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value: string;
  /**
   * 展示或交互模式；可选值见类型定义。
   * @defaultValue "month"
   */
  mode: "month" | "year";
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange: (value: string) => void;
  /** 显示类型变化时调用。 */
  onTypeChange: (mode: "month" | "year") => void }) => ReactNode;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (date: string) => void;
  /** 选中项目时调用，参数包含选中项目及关联状态。 */
  onSelect?: (date: string) => void;
  /** 面板显示的日期或模式变化时调用。 */
  onPanelChange?: (date: string, mode: "month" | "year") => void;
}
const WEEK = ["一", "二", "三", "四", "五", "六", "日"];
const MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

/** 日历组件。 */
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
  return <div className={`sia-calendar${fullscreen ? " sia-calendar--fullscreen" : " sia-calendar--mini"} ${className}`.trim()} {...withTitleTooltip(props)}>
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

/** 轮播的实例引用接口。 */
export interface CarouselRef {
  /** 跳转到指定索引的轮播项。 */
  goTo: (slide: number) => void;
  /** 切换到下一项。 */
  next: () => void;
  /** 切换到上一项。 */
  prev: () => void }
/** 轮播的属性配置。 */
export interface CarouselProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 是否自动轮播。
   * @defaultValue false
   */
  autoplay?: boolean | {
  /** 轮播指示点的动画持续时间。 */
  dotDuration?: boolean };
  /**
   * 自动轮播的切换间隔。
   * @defaultValue 3000
   */
  autoplaySpeed?: number;
  /**
   * 是否显示前后切换箭头。
   * @defaultValue false
   */
  arrows?: boolean;
  /**
   * 是否显示轮播指示点。
   * @defaultValue true
   */
  dots?: boolean | {
  /**
   * 附加到组件根节点的 CSS 类名。
   * @defaultValue ""
   */
  className?: string };
  /**
   * 滚动或淡入效果
   * @defaultValue "scroll"
   */
  effect?: "scroll" | "fade";
  /**
   * 是否允许首尾循环切换。
   * @defaultValue true
   */
  infinite?: boolean;
  /**
   * 轮播初始化时显示的项索引。
   * @defaultValue 0
   */
  initialSlide?: number;
  /**
   * 鼠标悬停时是否暂停自动轮播。
   * @defaultValue true
   */
  pauseOnHover?: boolean;
  /** 轮播切换前调用，接收当前项和目标项索引。 */
  beforeChange?: (current: number, next: number) => void;
  /** 轮播切换后调用，接收当前项索引。 */
  afterChange?: (current: number) => void;
}

/** 轮播组件。 */
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
  return <div className={`sia-carousel sia-carousel--${effect} ${className}`.trim()} onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined} onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined} {...withTitleTooltip(props)}>
    <div className="sia-carousel__viewport"><div className="sia-carousel__track" style={effect === "scroll" ? { transform: `translateX(-${current * 100}%)` } : undefined}>
      {slides.map((slide, index) => <div className={`sia-carousel__slide${index === current ? " is-active" : ""}`} aria-hidden={index !== current} key={index}>{slide}</div>)}
    </div></div>
    {arrows ? <><button className="sia-carousel__arrow sia-carousel__arrow--prev" disabled={!infinite && current === 0} aria-label="上一张" onClick={() => go(current - 1)}><Icon name="chevron-left" /></button><button className="sia-carousel__arrow sia-carousel__arrow--next" disabled={!infinite && current === slides.length - 1} aria-label="下一张" onClick={() => go(current + 1)}><Icon name="chevron-right" /></button></> : null}
    {dots ? <div className={`sia-carousel__dots${typeof dots === "object" && dots.className ? ` ${dots.className}` : ""}`}>{slides.map((_, index) => <button key={index} aria-label={`切换到第 ${index + 1} 张`} aria-current={index === current} onClick={() => go(index)}><span /></button>)}</div> : null}
  </div>;
}

/** 折叠面板的唯一标识类型。 */
export type CollapseKey = string | number;
/** 折叠面板的项目定义。 */
export type CollapseItem = {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: CollapseKey;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
  /** 主体之外的补充内容或操作区。 */
  extra?: ReactNode;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 允许收起内容区域 */
  collapsible?: "header" | "icon" | "disabled";
  /** 是否显示展开箭头。 */
  showArrow?: boolean;
  /** 未展开时是否也渲染内容。 */
  forceRender?: boolean;
  /** 附加到组件根节点的 CSS 类名。 */
  className?: string };
/** 折叠面板的属性配置。 */
export interface CollapseProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** 按展示顺序排列的项目配置。 */
  items: readonly CollapseItem[];
  /** 当前激活项目的标识；传入后由外部控制。 */
  activeKey?: CollapseKey | readonly CollapseKey[];
  /**
   * 非受控模式下初始激活的项目标识。
   * @defaultValue []
   */
  defaultActiveKey?: CollapseKey | readonly CollapseKey[];
  /**
   * 是否启用手风琴模式，同时只展开一个面板。
   * @defaultValue false
   */
  accordion?: boolean;
  /**
   * 是否显示边框。
   * @defaultValue true
   */
  bordered?: boolean;
  /**
   * 是否使用透明背景的幽灵样式。
   * @defaultValue false
   */
  ghost?: boolean;
  /**
   * 收起后销毁内容
   * @defaultValue false
   */
  destroyInactivePanel?: boolean;
  /**
   * 展开图标的位置。
   * @defaultValue "start"
   */
  expandIconPosition?: "start" | "end";
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
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

/** 折叠面板组件。 */
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
  const borderClassName = !bordered || ghost ? "sia-collapse--borderless" : "sia-collapse--bordered";
  return <div className={`sia-collapse ${borderClassName}${ghost ? " sia-collapse--ghost" : ""} sia-collapse--icon-${expandIconPosition} ${className}`.trim()} {...withTitleTooltip(props)}>
    {items.map((item) => {
      const open = openKeys.includes(item.key);
      const arrow = item.showArrow === false ? null : <button type="button" className="sia-collapse__arrow" aria-label={open ? "收起" : "展开"} onClick={item.collapsible === "icon" ? () => toggle(item) : undefined}><Icon name="chevron-right" size={14} /></button>;
      return <section className={`sia-collapse__item${open ? " is-open" : ""}${item.disabled ? " is-disabled" : ""} ${item.className ?? ""}`.trim()} key={item.key}>
        <header className="sia-collapse__header" role="button" tabIndex={item.disabled ? -1 : 0} aria-expanded={open} onClick={item.collapsible === "icon" ? undefined : () => toggle(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(item); } }}>
          {expandIconPosition === "start" ? arrow : null}<span className="sia-collapse__label">{item.label}</span>{item.extra ? <span className="sia-collapse__extra" onClick={(event) => event.stopPropagation()}>{item.extra}</span> : null}{expandIconPosition === "end" ? arrow : null}
        </header>
        <CollapsePanel open={open} forceRender={item.forceRender} destroyInactivePanel={destroyInactivePanel}>{item.children}</CollapsePanel>
      </section>;
    })}
  </div>;
}

/** 图片预览的属性配置。 */
export interface ImagePreviewProps {
  /** 分组中当前图片的序号，从 0 开始；与 count、onCurrentChange 一起提供时显示切换按钮。 */
  current?: number;
  /** 分组图片数量；大于 1 时允许按钮及左右方向键切换，首尾不循环。 */
  count?: number;
  /** 切换图片时回调新的序号，由外部同步 current、src 与 alt。 */
  onCurrentChange?: (current: number) => void;
  /** 是否打开；传入后由外部控制显示状态。 */
  open: boolean;
  /** 图片或资源地址。 */
  src?: string;
  /**
   * 图片无法显示时的替代文本。
   * @defaultValue ""
   */
  alt?: string;
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange: (open: boolean) => void;
}

/** 图片预览弹层，初始按窗口适配大图，支持水平/垂直翻转、左右旋转、缩放及拖动；重新打开或更换图片时重置视图。入退场共用 180ms 淡入轨迹，关闭反播后卸载，退场期间保留图片视图；减少动态效果时直接切换。 */
export function ImagePreview({ open, src, alt = "", onOpenChange, current = 0, count = 1, onCurrentChange }: ImagePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const motion = useOverlayMotion(open, previewRef, "fade");
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ src: "", width: 0, height: 0 });
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState({ x: 1, y: 1 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number }>();
  useOverlayLifecycle(motion.present, previewRef, () => { if (open) onOpenChange(false); });
  const reset = () => { setZoom(1); setRotation(0); setFlip({ x: 1, y: 1 }); setPan({ x: 0, y: 0 }); drag.current = undefined; };
  useEffect(() => { if (open) { reset(); setFailed(false); } }, [open, src]);
  // 分组切换仅在预览打开时处理，不干扰底层表格的方向键操作。
  useEffect(() => {
    if (!open || !onCurrentChange || count < 2) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault(); event.stopPropagation();
      const next = current + (event.key === "ArrowRight" ? 1 : -1);
      if (next >= 0 && next < count) onCurrentChange(next);
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [open, current, count, onCurrentChange]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!open || !stage) return;
    const measure = () => { setArea({ width: stage.clientWidth, height: stage.clientHeight }); setPan({ x: 0, y: 0 }); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [open, src]);
  const ready = natural.src === src && natural.width > 0 && area.width > 0 && area.height > 0 && !failed;
  // 按旋转后的包围盒计算适配比例，给底部工具条和顶部关闭按钮保留独立区域。
  const sideways = Math.abs(rotation % 180) === 90;
  const fit = ready ? Math.min(1, area.width / (sideways ? natural.height : natural.width), area.height / (sideways ? natural.width : natural.height)) : 0;
  const changeZoom = (factor: number) => setZoom(value => Math.max(.25, Math.min(8, value * factor)));

  if (!motion.present || !src || typeof document === "undefined") return null;
  return createPortal(<div ref={previewRef} className="sia-image-preview" style={{ animation: "none", pointerEvents: open ? undefined : "none" }} {...(!open ? { inert: "" } : {})} role="dialog" aria-modal="true" aria-label="图片预览" tabIndex={-1} onClick={() => onOpenChange(false)}>
    <Button variant="text" className="sia-image-preview__close" aria-label="关闭预览" onClick={event => { event.stopPropagation(); onOpenChange(false); }}><Icon name="close" /></Button>
    <div ref={stageRef} className="sia-image-preview__stage">
      {failed ? <span className="sia-image-preview__error">图片加载失败</span> : <img key={src} src={src} alt={alt} draggable={false}
        style={{ width: natural.width * fit, height: natural.height * fit, visibility: ready ? "visible" : "hidden", transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom * flip.x}, ${zoom * flip.y})` }}
        onLoad={event => setNatural({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setFailed(true)}
        onClick={event => event.stopPropagation()}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: pan.x, top: pan.y }; }}
        onPointerMove={event => { const start = drag.current; if (start?.id === event.pointerId) setPan({ x: start.left + event.clientX - start.x, y: start.top + event.clientY - start.y }); }}
        onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onLostPointerCapture={() => { drag.current = undefined; }} />}
    </div>
    <div className="sia-image-preview__toolbar" role="toolbar" aria-label="图片操作" onClick={event => event.stopPropagation()}>
      {count > 1 && onCurrentChange ? <>
        <Button variant="text" aria-label="上一张" disabled={current === 0} onClick={() => onCurrentChange(current - 1)}><Icon name="chevron-left" /></Button>
        <output aria-label="图片序号">{current + 1} / {count}</output>
        <Button variant="text" aria-label="下一张" disabled={current >= count - 1} onClick={() => onCurrentChange(current + 1)}><Icon name="chevron-right" /></Button>
      </> : null}
      <Button variant="text" title="水平翻转" aria-label="水平翻转" disabled={!ready} onClick={() => setFlip(value => ({ ...value, x: -value.x }))}><Icon name="flip-horizontal" size={20} /></Button>
      <Button variant="text" title="垂直翻转" aria-label="垂直翻转" disabled={!ready} onClick={() => setFlip(value => ({ ...value, y: -value.y }))}><Icon name="flip-vertical" size={20} /></Button>
      <Button variant="text" title="向左旋转" aria-label="向左旋转" disabled={!ready} onClick={() => { setRotation(value => value - 90); setPan({ x: 0, y: 0 }); }}><Icon name="rotate-left" size={20} /></Button>
      <Button variant="text" title="向右旋转" aria-label="向右旋转" disabled={!ready} onClick={() => { setRotation(value => value + 90); setPan({ x: 0, y: 0 }); }}><Icon name="rotate-right" size={20} /></Button>
      <Button variant="text" title="缩小" aria-label="缩小" disabled={!ready || zoom <= .25} onClick={() => changeZoom(1 / 1.25)}><Icon name="zoom-out" size={20} /></Button>
      {/* 百分比以原图为基准，同时计入窗口适配比例与用户缩放倍率。 */}
      <output className="sia-image-preview__scale" aria-label="当前缩放比例" aria-live="polite">{ready ? `${Math.round(fit * zoom * 100)}%` : "—"}</output>
      <Button variant="text" title="放大" aria-label="放大" disabled={!ready || zoom >= 8} onClick={() => changeZoom(1.25)}><Icon name="zoom-in" size={20} /></Button>
      <Button variant="text" title="适应窗口" aria-label="适应窗口" disabled={!ready} onClick={reset}><Icon name="refresh" size={20} /></Button>
    </div>
  </div>, document.body);
}

/** 图片预览的配置。 */
export interface ImagePreviewConfig {
  /** 图片或资源地址。 */
  src?: string;
  /** 是否打开；传入后由外部控制显示状态。 */
  open?: boolean;
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange?: (open: boolean) => void;
  /** 遮罩是否显示或自定义遮罩内容。 */
  mask?: ReactNode }
/** 图片的属性配置。 */
export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** 图片成功加载后触发，传入原生图片的 React 加载事件；在框架更新占位状态后调用，可用于恢复业务预览状态。 */
  onLoad?: ImgHTMLAttributes<HTMLImageElement>["onLoad"];
  /** 资源加载失败时使用的替代内容或地址。 */
  fallback?: string;
  /** 未填写或未选择时的提示内容。 */
  placeholder?: ReactNode;
  /**
   * 预览开关或配置
   * @defaultValue true
   */
  preview?: boolean | ImagePreviewConfig;
  /**
   * 最外层容器的附加 CSS 类名。
   * @defaultValue ""
   */
  rootClassName?: string;
}

type GroupImage = { src: string; alt: string; element: HTMLSpanElement };
const ImageGroupContext = createContext<{
  register: (id: string, image: GroupImage) => () => void;
  open: (id: string) => void;
} | null>(null);

/** 图片预览组的配置。 */
export interface ImagePreviewGroupProps {
  /** 包含 Image 的内容，可嵌套布局容器；preview=false 或受控预览的 Image 不加入分组。 */
  children?: ReactNode;
}

/** 按图片在页面中的顺序组织预览，支持按钮和方向键切换；删除当前图片时关闭预览。 */
export function ImagePreviewGroup({ children }: ImagePreviewGroupProps) {
  const images = useRef(new Map<string, GroupImage>());
  const [active, setActive] = useState<string>();
  const [, setRevision] = useState(0);
  const context = useMemo(() => ({
    register: (id: string, image: GroupImage) => {
      images.current.set(id, image); setRevision(value => value + 1);
      return () => { images.current.delete(id); setRevision(value => value + 1); };
    },
    open: (id: string) => setActive(id),
  }), []);
  // 按实际 DOM 排序，兼容图片列表重排和外层布局嵌套。
  const entries = [...images.current].sort((a, b) => a[1].element.compareDocumentPosition(b[1].element) & 4 ? -1 : 1);
  const index = entries.findIndex(([id]) => id === active);
  const image = entries[index]?.[1];
  useEffect(() => { if (active && index < 0) setActive(undefined); }, [active, index]);
  return <ImageGroupContext.Provider value={context}>{children}<ImagePreview
    open={Boolean(image)} src={image?.src} alt={image?.alt} current={index} count={entries.length}
    onOpenChange={open => { if (!open) setActive(undefined); }} onCurrentChange={next => setActive(entries[next]?.[0])}
  /></ImageGroupContext.Provider>;
}

/** 图片组件。 */
export function Image({ fallback, placeholder, preview = true, rootClassName = "", className = "", src, alt = "", onLoad, onError, style, ...props }: ImageProps) {
  const config = typeof preview === "object" ? preview : {};
  const controlled = typeof preview === "object" && preview.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? config.open! : internalOpen;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const displaySrc = failed && fallback ? fallback : src;
  const group = useContext(ImageGroupContext);
  const groupId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const grouped = Boolean(group && preview && !controlled && displaySrc);
  useEffect(() => {
    if (grouped && group && displaySrc && rootRef.current) return group.register(groupId, { src: displaySrc, alt, element: rootRef.current });
  }, [group, grouped, groupId, displaySrc, alt]);
  const radius = typeof style?.borderRadius === "number" ? `${style.borderRadius}px` : style?.borderRadius;
  const rootStyle = {
    ...style,
    "--sia-image-radius": radius ?? "var(--sia-radius)",
  } as CSSProperties;
  function setOpen(next: boolean) { if (grouped && next) group?.open(groupId); else if (!controlled) setInternalOpen(next); config.onOpenChange?.(next); }
  return <span ref={rootRef} className={`sia-image ${rootClassName}`.trim()} style={rootStyle}>
    {!loaded && placeholder ? <span className="sia-image__placeholder">{placeholder}</span> : null}
    {/* 更新占位状态后继续通知调用方，确保图片恢复加载时预览组件能解除失败状态。 */}
    <img {...withTitleTooltip(props)} src={displaySrc} alt={alt} className={className} onLoad={event => { setLoaded(true); onLoad?.(event); }} onError={(event) => { if (!failed && fallback) setFailed(true); onError?.(event); }} />
    {preview ? <button type="button" className="sia-image__mask" aria-label="预览图片" onClick={() => setOpen(true)}>{config.mask ?? <><Icon name="eye" />预览</>}</button> : null}
    <ImagePreview open={open} src={config.src ?? displaySrc} alt={alt} onOpenChange={setOpen} />
  </span>;
}
