import {ChartBrush,type ChartBrushProps} from './ChartBrush';
import {axisTooltipPosition} from './chartTooltipPosition';
import {chartZoomPan} from './chartZoomPan';
import {chartZoomShadow} from './chartZoomShadow';
import {appendChartExportHeadings} from './chartExportHeadings';
import {ChartNodeTimeline} from './ChartNodeTimeline';
import {ChartVerticalRange} from './ChartVerticalRange';
import {ChartHorizontalRange} from './ChartHorizontalRange';
import {
  createContext,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useContext,
  useImperativeHandle,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {serializeChartComposite,saveCompositeImage} from './chartCompositeExport';
import type {
  CSSProperties,
  FocusEvent,
  HTMLAttributes,
  PointerEvent,
  ReactNode,
  SVGAttributes,
} from "react";

/** 图表 SVG 内部坐标系的默认宽度。 */
export const CHART_VIEWBOX_WIDTH = 720;
/** 图表 SVG 内部坐标系的默认高度。 */
export const CHART_VIEWBOX_HEIGHT = 360;

/** 图表默认调色板。 */
export const DEFAULT_CHART_PALETTE = [
  "#1677ff", "#36cfc9", "#52c41a", "#faad14", "#ff7a45",
  "#722ed1", "#eb2f96", "#13c2c2", "#2f54eb", "#a0d911",
] as const;

/** 图例的项目定义。 */
export interface ChartLegendItem {
  /** 图片资源配置。 */
  image?: string;
  /** 文字样式。 */
  textStyle?: CSSProperties;
  /** Optional measured label width in SVG coordinates. */
  textWidth?: number;
  /** Override the group's symbol for mixed-series legends. */
  symbol?: 'rect'|'line'|'sector';
  /** 图形填充渐变配置。 */
  fillGradient?: {
  /** 范围起点。 */
  start:readonly [number,number];
  /** 范围终点。 */
  end:readonly [number,number];
  /** 渐变颜色停靠点集合。 */
  stops:readonly {
  /** 相对于默认位置的偏移。 */
  offset:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string}[]};
  /** 边框颜色。 */
  borderColor?: string;
  /** 名称或字段标识。 */
  name: string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color: string;
  /** 是否禁用交互。 */
  disabled?: boolean;
}

/** ChartData的点击事件上下文。 */
export interface ChartDataClickInfo<T = unknown> {
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number | readonly number[];
  /** 数据系列名称。 */
  seriesName?: string;
  /** 用于渲染的数据集合。 */
  data: T;
  /** 触发本次操作的原生事件。 */
  nativeEvent: PointerEvent<SVGGElement>;
}

/** 图表容器的实例引用接口。 */
export interface SiaChartRef {
  /** 读取组件底层 DOM 元素。 */
  getElement: () => SVGSVGElement | null;
  /** 将焦点移入控件。 */
  focus: () => void;
  /** 导出当前图表的 SVG 源码。 */
  toSvgString: () => string | null;
  /** 将图表导出为图片 Data URL。 */
  toDataUrl: () => string | null;
}

/** 图表容器的属性配置。 */
export interface SiaChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  /**
   * 标题的水平对齐方式。
   * @defaultValue "left"
   */
  titleAlign?: "left" | "center" | "right";
  /**
   * 标题的垂直对齐方式。
   * @defaultValue "top"
   */
  titleVerticalAlign?: "top" | "bottom";
  /**
   * SVG 内部视图坐标系的尺寸。
   * @defaultValue [CHART_VIEWBOX_WIDTH, CHART_VIEWBOX_HEIGHT]
   */
  viewBoxSize?: readonly [number, number];
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
  /** Additional SVG content above chart series and below interaction overlays. */
  svgOverlay?: ReactNode;
  /**
   * 宽度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue "100%"
   */
  width?: number | string;
  /**
   * 高度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue 320
   */
  height?: number | string;
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /**
   控件的无障碍名称，供屏幕阅读器识别。
   * @defaultValue typeof title === "string" ? title : "数据图表"
   */
  ariaLabel?: string;
  /**
   * 系列颜色；默认使用 Sia 数据可视化色板
   * @defaultValue DEFAULT_CHART_PALETTE
   */
  palette?: readonly string[];
  /**
   * 是否处于加载状态。
   * @defaultValue false
   */
  loading?: boolean;
  /**
   * 无数据时的展示内容或空状态配置。
   * @defaultValue false
   */
  empty?: boolean;
  /**
   * 没有数据时的显示内容。
   * @defaultValue "暂无图表数据"
   */
  emptyContent?: ReactNode;
  /**
   * 是否启用图形动画或自定义动画配置。
   * @defaultValue true
   */
  animation?: boolean;
  /**
   * 图形初次渲染动画的持续时间。
   * @defaultValue 700
   */
  animationDuration?: number;
  /**
   * 标线、数据视图、形态切换、还原与 SVG 图片保存
   * @defaultValue false
   */
  toolbox?: boolean | ChartToolboxOptions;
  /** 时间轴配置。 */
  timeline?: ChartTimelineProps;
  /** 框选交互配置。 */
  brush?: ChartBrushProps;
  /** 提示框的附加属性。 */
  tooltipProps?: Omit<ChartTooltipProps, "open" | "left" | "top" | "children">;
  /** undefined uses local marks; null hides; a value synchronizes an external tooltip. */
  controlledTooltip?: {
  /** 需要显示的内容，支持文本或 React 节点。 */
  content:ReactNode;
  /** 当前数据点或屏幕坐标点。 */
  point:readonly [number,number]} | null;
  /** 传给原生 SVG 根节点的属性 */
  svgProps?: Omit<SVGAttributes<SVGSVGElement>, "children" | "width" | "height">;
}

/** 组合图表中的一个图层，包含系列类型、数据和布局配置。 */
export interface ChartCompositeLayer {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key?: string;
  /** 需要显示的内容，支持文本或 React 节点。 */
  content: ReactNode;
  /** 距左侧的位置或间距。 */
  left?: number | string;
  /** 距顶部的位置或间距。 */
  top?: number | string;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?: number | string;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height?: number | string;
  /** 组件或浮层的堆叠层级。 */
  zIndex?: number;
  /** SVG 或 DOM 元素的指针事件响应方式。 */
  pointerEvents?: CSSProperties["pointerEvents"];
}

/** 组合图表的实例引用接口。 */
export interface ChartCompositeRef {
  /** 导出当前图表的 SVG 源码。 */
  toSvgString:()=>string|null;
  /** 将当前图表保存为图片。 */
  saveAsImage:(filename?:string)=>Promise<void>;
}
/** 组合图表的属性配置。 */
export interface ChartCompositeProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** 组合图中的图层配置，按顺序绘制。 */
  layers: readonly ChartCompositeLayer[];
  /**
   * 宽度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue "100%"
   */
  width?: number | string;
  /**
   * 高度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue 320
   */
  height?: number | string;
  /**
   控件的无障碍名称，供屏幕阅读器识别。
   * @defaultValue "组合图表"
   */
  ariaLabel?: string;
}

/** 图表工具箱可以启用的功能名称。 */
export type ChartToolboxFeature = "dataZoom" | "mark" | "dataView" | "restore" | "saveAsImage";

/** 图表工具箱的配置选项。 */
export interface ChartToolboxOptions {
  /** 垂直对齐方式。 */
  verticalAlign?: 'top'|'bottom';
  /** 触发图片导出时调用。 */
  onSaveAsImage?:()=>void;
  /** 是否显示该功能。 */
  show?: boolean;
  /** 组件的水平或垂直排列方向。 */
  orientation?: "horizontal" | "vertical";
  /** 工具箱中启用的功能项。 */
  features?: readonly ChartToolboxFeature[];
  /** 允许切换的图表类型。 */
  magicTypes?: readonly string[];
  /** 当前切换后的图表类型。 */
  activeMagicType?: string;
  /** Selected options across independent mode groups; takes precedence for button display. */
  activeMagicTypes?: readonly string[];
  /** 文件名。 */
  filename?: string;
  /** 是否显示或如何配置数据视图。 */
  dataView?: ReactNode;
  /** 数据视图是否只读。 */
  dataViewReadOnly?: boolean;
  /** 视图缩放时调用。 */
  onZoom?: () => void;
  /** 返回上一次缩放范围时调用。 */
  onZoomBack?: () => void;
  /** 是否禁用缩放回退。 */
  zoomBackDisabled?: boolean;
  /** 是否处于缩放选择模式。 */
  zoomActive?: boolean;
  /** 进入或切换辅助标线模式时调用。 */
  onMark?: () => void;
  /** 切换图表类型时调用。 */
  onMagicTypeChange?: (type: string) => void;
  /** 还原初始图表状态时调用。 */
  onRestore?: () => void;
}

/** 图表工具箱的属性配置。 */
export interface ChartToolboxProps extends ChartToolboxOptions {
  /**
   * 是否处于标线绘制模式。
   * @defaultValue false
   */
  markActive?: boolean;
  /**
   * 已绘制标线数量。
   * @defaultValue 0
   */
  markCount?: number;
  /** 撤销最近标线时调用。 */
  onMarkUndo?: () => void;
  /** 清空所有标线时调用。 */
  onMarkClear?: () => void;
  /** 打开数据视图时调用。 */
  onDataView: () => void;
  /** 触发图片导出时调用。 */
  onSaveAsImage: () => void;
}

interface TooltipState {
  content: ReactNode;
  left: number;
  top: number;
}

interface ChartContextValue {
  palette: readonly string[];
  showTooltip: (event: PointerEvent<SVGGElement> | FocusEvent<SVGGElement>, content: ReactNode, point?: readonly [number, number]) => void;
  hideTooltip: () => void;
}

const ChartContext = createContext<ChartContextValue | null>(null);

function toCssSize(value: number | string | undefined, fallback: string) {
  if (typeof value === "number") return `${value}px`;
  return value ?? fallback;
}

/** 组合图表组件。 */
export const ChartComposite=forwardRef<ChartCompositeRef,ChartCompositeProps>(function ChartComposite({ layers, width = "100%", height = 320, ariaLabel = "组合图表", className = "", style, ...props },ref) {
  const host=useRef<HTMLDivElement>(null);
  useImperativeHandle(ref,()=>({toSvgString:()=>host.current?serializeChartComposite(host.current):null,saveAsImage:filename=>saveCompositeImage(host.current?serializeChartComposite(host.current):null,filename)}),[]);
  return <div {...props} ref={host} className={`sia-chart-composite${className ? ` ${className}` : ""}`} style={{ ...style, width: toCssSize(width, "100%"), height: toCssSize(height, "320px") }} role="group" aria-label={ariaLabel}>
    {layers.map((layer, index) => <div key={layer.key ?? index} className="sia-chart-composite__layer" style={{ left: layer.left ?? 0, top: layer.top ?? 0, width: layer.width ?? "100%", height: layer.height ?? "100%", zIndex: layer.zIndex ?? index, pointerEvents: layer.pointerEvents }}>{layer.content}</div>)}
  </div>;
});

/** 图表提示框的属性配置。 */
export interface ChartTooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Axis placement follows category x / pointer y and applies measured edge corrections. */
  placement?: 'above'|'axis';
  /** Let semantic title/value elements inherit the tooltip's font and color. */
  inheritTextStyle?: boolean;
  /** Keep item details available for pointer and keyboard interaction. */
  enterable?: boolean;
  /** 是否打开；传入后由外部控制显示状态。 */
  open: boolean;
  /** 距左侧的位置或间距。 */
  left: number;
  /** 距顶部的位置或间距。 */
  top: number;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children: ReactNode;
}

const useTooltipLayoutEffect=typeof window==='undefined'?useEffect:useLayoutEffect;
/** 图表提示框组件。 */
export function ChartTooltip({ open, left, top, children, enterable = false, inheritTextStyle=false, placement='above', className = "", style, ...props }: ChartTooltipProps) {
  const elementRef=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState<readonly [number,number]>([left,top]);
  useTooltipLayoutEffect(()=>{
    const element=elementRef.current,host=element?.parentElement;
    if(!open||placement!=='axis'||!element||!host)return;
    const measure=()=>{
      const next=axisTooltipPosition([left,top],[element.offsetWidth,element.offsetHeight],[host.clientWidth,host.clientHeight]);
      setPosition(current=>current[0]===next[0]&&current[1]===next[1]?current:next);
    };
    measure();
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);
    observer?.observe(host);observer?.observe(element);return ()=>observer?.disconnect();
  },[open,placement,left,top,children]);
  if (!open) return null;
  return <div
    {...props}
    ref={elementRef}
    className={`sia-chart__tooltip${inheritTextStyle?' sia-chart__tooltip--inherit-text':''}${className ? ` ${className}` : ""}`}
    role="tooltip"
    style={{ ...style, ...(enterable?{pointerEvents:'auto' as const}:{}), ...(placement==='axis'?{left:position[0],top:position[1],transform:'none'}:{left,top}) }}
  >{children}</div>;
}

const TOOLBOX_LABELS: Record<ChartToolboxFeature, string> = {
  dataZoom: "框选缩放",
  mark: "标线",
  dataView: "数据视图",
  restore: "还原",
  saveAsImage: "保存为图片",
};

const TOOLBOX_ICONS: Record<ChartToolboxFeature, ReactNode> = {
  dataZoom: <><rect x="3" y="3" width="13" height="13" strokeDasharray="3 2"/><path d="m16 16 5 5"/></>,
  mark: <><path d="M4 17 17 4" /><circle cx="4" cy="17" r="2" /><circle cx="17" cy="4" r="2" /></>,
  dataView: <><rect x="4" y="3" width="14" height="18" rx="2" /><path d="M8 8h6M8 12h6M8 16h4" /></>,
  restore: <><path d="M5 7V3m0 0h4M5 3l3 3" /><path d="M5.5 7a8 8 0 1 1-1 8" /></>,
  saveAsImage: <><path d="M12 3v11m0 0 4-4m-4 4-4-4" /><path d="M5 16v4h14v-4" /></>,
};

function ToolboxIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

/** 图表工具箱组件。 */
export function ChartToolbox({
  show = true,
  orientation = "horizontal",
  verticalAlign,
  features = ["mark", "dataView", "restore", "saveAsImage"],
  magicTypes = [],
  activeMagicType,
  activeMagicTypes,
  markActive = false,
  markCount = 0,
  onMarkUndo,
  onMarkClear,
  onMark,
  onZoom,
  onZoomBack,
  zoomBackDisabled,
  zoomActive,
  onMagicTypeChange,
  onRestore,
  onDataView,
  onSaveAsImage,
}: ChartToolboxProps) {
  if (!show) return null;
  const featureActions: Record<ChartToolboxFeature, (() => void) | undefined> = {
    dataZoom: onZoom,
    mark: onMark,
    dataView: onDataView,
    restore: onRestore,
    saveAsImage: onSaveAsImage,
  };
  return <div className={`sia-chart-toolbox${orientation === "vertical" ? " sia-chart-toolbox--vertical" : ""}`} style={verticalAlign?{top:verticalAlign==='top'?8:'auto',bottom:verticalAlign==='bottom'?8:'auto',transform:'none'}:undefined} role="toolbar" aria-label="图表工具箱">
    {features.map((feature) => <span key={feature} style={{display:"contents"}}><button
      type="button"
      className="sia-chart-toolbox__button"
      title={TOOLBOX_LABELS[feature]}
      aria-label={TOOLBOX_LABELS[feature]}
      aria-pressed={feature === "mark" ? markActive : feature==="dataZoom"?zoomActive:undefined}
      onClick={featureActions[feature]}
    ><ToolboxIcon>{TOOLBOX_ICONS[feature]}</ToolboxIcon></button>{feature === "mark" ? <>
      <button type="button" className="sia-chart-toolbox__button" aria-label="撤销标线" title="撤销标线" disabled={!markCount} onClick={onMarkUndo}><ToolboxIcon><path d="M4 8h10a6 6 0 0 1 0 12M4 8l5-5M4 8l5 5" /></ToolboxIcon></button>
      <button type="button" className="sia-chart-toolbox__button" aria-label="清空标线" title="清空标线" disabled={!markCount} onClick={onMarkClear}><ToolboxIcon><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></ToolboxIcon></button>
    </> : feature==='dataZoom'&&onZoomBack?<button type="button" className="sia-chart-toolbox__button" aria-label="区域缩放后退" title="区域缩放后退" disabled={zoomBackDisabled} onClick={onZoomBack}><ToolboxIcon><path d="M4 8h10a6 6 0 0 1 0 12M4 8l5-5M4 8l5 5"/></ToolboxIcon></button>:null}</span>)}
    {magicTypes.map((type) => <button
      key={type}
      type="button"
      className="sia-chart-toolbox__button sia-chart-toolbox__magic"
      aria-pressed={activeMagicTypes ? activeMagicTypes.includes(type) : activeMagicType === type}
      aria-label={`切换为${({line:"折线图",bar:"柱状图",stack:"堆积",tiled:"平铺"} as Record<string,string>)[type] ?? type}`}
      title={`切换为${type}`}
      onClick={() => onMagicTypeChange?.(type)}
    >{["line","bar","stack","tiled"].includes(type) ? <ToolboxIcon>{type === "line" ? <path d="M3 3v18h18M5 16l4-9 5 6 6-10" /> : type === "bar" ? <path d="M3 3v18h18M7 18V10h2v8M12 18V5h2v13M17 18V8h2v10" /> : type === "stack" ? <path d="M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z" /> : <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z" />}</ToolboxIcon> : type}</button>)}
  </div>;
}

/** 图表容器组件。 */
export const SiaChart = forwardRef<SiaChartRef, SiaChartProps>(function SiaChart(
  {
    children,
    width = "100%",
    height = 320,
    viewBoxSize = [CHART_VIEWBOX_WIDTH, CHART_VIEWBOX_HEIGHT],
    title,
    titleAlign = "left",
    titleVerticalAlign = "top",
    description,
    ariaLabel = typeof title === "string" ? title : "数据图表",
    palette = DEFAULT_CHART_PALETTE,
    loading = false,
    empty = false,
    emptyContent = "暂无图表数据",
    animation = true,
    animationDuration = 700,
    toolbox = false,
    timeline,
    brush,
    svgOverlay,
    tooltipProps,
    controlledTooltip,
    svgProps,
    className = "",
    style,
    ...rest
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipHideTimer=useRef<ReturnType<typeof setTimeout>>();
  const tooltipHeld=useRef(false);
  const cancelTooltipHide=()=>{clearTimeout(tooltipHideTimer.current);};
  useEffect(()=>()=>clearTimeout(tooltipHideTimer.current),[]);
  const [linkedPosition,setLinkedPosition]=useState({left:0,top:0});
  useEffect(()=>{
    const host=hostRef.current,svg=svgRef.current;
    if(!controlledTooltip||!host||!svg)return;
    const position=()=>{
      const matrix=svg.getScreenCTM();if(!matrix)return;
      const bounds=host.getBoundingClientRect();
      const point=new DOMPoint(...controlledTooltip.point).matrixTransform(matrix);
      setLinkedPosition({left:Math.max(0,Math.min(bounds.width-240,point.x-bounds.left+12)),top:Math.max(0,Math.min(bounds.height-100,point.y-bounds.top+12))});
    };
    position();const observer=new ResizeObserver(position);observer.observe(host);
    return ()=>observer.disconnect();
  },[controlledTooltip]);
  const [dataViewOpen, setDataViewOpen] = useState(false);
  const [markMode, setMarkMode] = useState(false);
  const [markStart, setMarkStart] = useState<readonly [number, number] | null>(null);
  const [userMarks, setUserMarks] = useState<readonly (readonly [number, number])[]>([]);
  const toolboxOptions = toolbox === true ? {} : toolbox || undefined;
  const rootStyle = useMemo<CSSProperties>(() => ({
    ...style,
    width: toCssSize(width, "100%"),
    height: toCssSize(height, "320px"),
    "--sia-chart-animation-duration": `${Math.max(0, animationDuration)}ms`,
  } as CSSProperties), [animationDuration, height, style, width]);

  function serializeSvg() {
    if (!svgRef.current) return null;
    const original = svgRef.current;
    const clone = original.cloneNode(true) as SVGSVGElement;
    const originals = [original,...original.querySelectorAll("*")];
    const copies = [clone,...clone.querySelectorAll("*")];
    const properties = ["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","font-family","font-size","font-weight","text-anchor","paint-order"];
    originals.forEach((element,index)=>{
      const computed = getComputedStyle(element);
      const copy = copies[index] as SVGElement;
      properties.forEach(property=>copy.style.setProperty(property,computed.getPropertyValue(property)));
      copy.style.animation="none"; copy.style.transition="none";
    });
    clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
    clone.setAttribute("width",String(original.viewBox.baseVal.width));
    clone.setAttribute("height",String(original.viewBox.baseVal.height));
    const background = document.createElementNS("http://www.w3.org/2000/svg","rect");
    background.setAttribute("width","100%"); background.setAttribute("height","100%");
    background.setAttribute("fill",hostRef.current ? getComputedStyle(hostRef.current).backgroundColor : "#fff");
    clone.insertBefore(background,clone.firstChild);
    if(hostRef.current)appendChartExportHeadings(original,clone,hostRef.current);
    return new XMLSerializer().serializeToString(clone);
  }

  function svgDataUrl() {
    const source = serializeSvg();
    return source ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}` : null;
  }

  async function saveAsImage() {
    const href = svgDataUrl();
    if (!href || !svgRef.current) return;
    const raster = new Image();
    raster.src=href;
    try { await raster.decode(); } catch { return; }
    const canvas = document.createElement("canvas");
    canvas.width=Math.ceil(svgRef.current.viewBox.baseVal.width*2);
    canvas.height=Math.ceil(svgRef.current.viewBox.baseVal.height*2);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(raster,0,0,canvas.width,canvas.height);
    const anchor = document.createElement("a");
    anchor.download = `${toolboxOptions?.filename ?? (typeof title === "string" ? title : "sia-chart")}.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  }

  useImperativeHandle(ref, () => ({
    getElement: () => svgRef.current,
    focus: () => svgRef.current?.focus(),
    toSvgString: serializeSvg,
    toDataUrl: svgDataUrl,
  }), []);

  const context = useMemo<ChartContextValue>(() => ({
    palette,
    showTooltip: (event, content, point) => {
      cancelTooltipHide();tooltipHeld.current=false;
      const bounds = hostRef.current?.getBoundingClientRect();
      if (!bounds) return;
      if (point) {
        const matrix = svgRef.current?.getScreenCTM();
        if (!matrix) return;
        const screen = new DOMPoint(point[0], point[1]).matrixTransform(matrix);
        setTooltip({
          content,
          left: screen.x - bounds.left,
          top: tooltipProps?.placement==='axis'&&'clientY' in event.nativeEvent?event.nativeEvent.clientY-bounds.top:screen.y-bounds.top,
        });
        return;
      }
      const nativeEvent = event.nativeEvent;
      const clientX = "clientX" in nativeEvent ? nativeEvent.clientX : bounds.left + bounds.width / 2;
      const clientY = "clientY" in nativeEvent ? nativeEvent.clientY : bounds.top + bounds.height / 2;
      setTooltip({
        content,
        left: Math.min(bounds.width - 12, Math.max(12, clientX - bounds.left)),
        top: Math.min(bounds.height - 12, Math.max(12, clientY - bounds.top)),
      });
    },
    hideTooltip: () => {
      cancelTooltipHide();
      if(tooltipProps?.enterable)tooltipHideTimer.current=setTimeout(()=>{if(!tooltipHeld.current)setTooltip(null);},200);
      else setTooltip(null);
    },
  }), [palette,tooltipProps?.enterable,tooltipProps?.placement]);

  return (
    <ChartContext.Provider value={context}>
      <div
        {...rest}
        ref={hostRef}
        className={`sia-chart${loading ? " sia-chart--loading" : ""}${animation ? " sia-chart--animated" : ""}${className ? ` ${className}` : ""}`}
        style={rootStyle}
        aria-busy={loading || undefined}
      >
        <svg
          {...svgProps}
          ref={svgRef}
          className={`sia-chart__svg${svgProps?.className ? ` ${svgProps.className}` : ""}`}
          viewBox={`0 0 ${viewBoxSize[0]} ${viewBoxSize[1]}`}
          role="img"
          aria-label={ariaLabel}
          aria-labelledby={`${titleId} ${descriptionId}`}
          tabIndex={0}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={(event) => {
            svgProps?.onPointerDown?.(event);
            if (!markMode) return;
            const matrix = event.currentTarget.getScreenCTM();
            if (!matrix) return;
            const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
            const point = [local.x, local.y] as const;
            if (!markStart) setMarkStart(point);
            else {
              setUserMarks((current) => [...current, markStart, point]);
              setMarkStart(null);
            }
          }}
        >
          <title id={titleId}>{typeof title === "string" ? title : ariaLabel}</title>
          <desc id={descriptionId}>{typeof description === "string" ? description : ariaLabel}</desc>
          {!empty ? children : null}
          {svgOverlay}
          {brush?<ChartBrush {...brush}/>:null}
          {markMode?<rect data-chart-mark-surface="" x={0} y={0} width={viewBoxSize[0]} height={viewBoxSize[1]} fill="transparent" style={{pointerEvents:'all',cursor:'crosshair'}}/>:null}
          {userMarks.length || markStart ? <g className="sia-chart__user-marks" aria-label="用户标线">
            {Array.from({ length: Math.floor(userMarks.length / 2) }, (_, index) => {
              const start = userMarks[index * 2]!;
              const end = userMarks[index * 2 + 1]!;
              return <g key={`${start[0]}-${start[1]}-${end[0]}-${end[1]}`}>
                <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />
                <circle cx={start[0]} cy={start[1]} r={4} />
                <circle cx={end[0]} cy={end[1]} r={4} />
              </g>;
            })}
            {markStart ? <circle className="sia-chart__user-mark-start" cx={markStart[0]} cy={markStart[1]} r={5} /> : null}
          </g> : null}
          {timeline?.renderer==='nodes'?<ChartNodeTimeline {...timeline}/>:null}
        </svg>
        {title || description ? <div className="sia-chart__heading" style={{...(titleAlign === "center" ? {left:"50%",transform:"translateX(-50%)",textAlign:"center" as const} : titleAlign === "right" ? {left:"auto",right:5,textAlign:"right" as const} : {}),...(titleVerticalAlign==="bottom"?{top:"auto",bottom:10}:{})}}>
          {title ? <strong>{title}</strong> : null}
          {description ? <span>{description}</span> : null}
        </div> : null}
        {empty ? <div className="sia-chart__empty">{emptyContent}</div> : null}
        {loading ? <div className="sia-chart__loading" role="status"><i />正在绘制图表…</div> : null}
        <ChartTooltip {...tooltipProps}
          onPointerEnter={event=>{if(tooltipProps?.enterable){tooltipHeld.current=true;cancelTooltipHide();}tooltipProps?.onPointerEnter?.(event);}}
          onPointerLeave={event=>{tooltipHeld.current=event.currentTarget.contains(document.activeElement);context.hideTooltip();tooltipProps?.onPointerLeave?.(event);}}
          onFocus={event=>{if(tooltipProps?.enterable){tooltipHeld.current=true;cancelTooltipHide();}tooltipProps?.onFocus?.(event);}}
          onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){tooltipHeld.current=false;context.hideTooltip();}tooltipProps?.onBlur?.(event);}}
          onKeyDown={event=>{if(event.key==='Escape'){tooltipHeld.current=false;cancelTooltipHide();setTooltip(null);}tooltipProps?.onKeyDown?.(event);}}
          open={controlledTooltip===undefined?Boolean(tooltip):Boolean(controlledTooltip)} left={controlledTooltip===undefined?tooltip?.left??0:linkedPosition.left} top={controlledTooltip===undefined?tooltip?.top??0:linkedPosition.top}>{controlledTooltip===undefined?tooltip?.content:controlledTooltip?.content}</ChartTooltip>
        {toolboxOptions ? <ChartToolbox
          {...toolboxOptions}
          markActive={markMode}
          markCount={userMarks.length / 2}
          onMarkUndo={() => {setUserMarks(current=>current.slice(0,-2));setMarkStart(null);}}
          onMarkClear={() => {setUserMarks([]);setMarkStart(null);}}
          onMark={() => {
            setMarkMode((current) => !current);
            setMarkStart(null);
            toolboxOptions.onMark?.();
          }}
          onRestore={() => {
            setUserMarks([]);
            setMarkStart(null);
            setMarkMode(false);
            toolboxOptions.onRestore?.();
          }}
          onDataView={() => setDataViewOpen(true)}
          onSaveAsImage={toolboxOptions?.onSaveAsImage??saveAsImage}
        /> : null}
        {dataViewOpen ? <div className="sia-chart-data-view" role="dialog" aria-modal="true" aria-label="图表数据视图">
          <div className="sia-chart-data-view__header"><strong>数据视图</strong><button type="button" aria-label="关闭数据视图" onClick={() => setDataViewOpen(false)}>×</button></div>
          <div className="sia-chart-data-view__body">{toolboxOptions?.dataView ?? <pre>{svgRef.current?.textContent || "暂无可展示的文本数据"}</pre>}</div>
        </div> : null}
        {timeline && timeline.renderer!=='nodes' ? <ChartTimeline {...timeline} /> : null}
      </div>
    </ChartContext.Provider>
  );
});

/** 图表标记的属性配置。 */
export interface ChartMarkProps extends SVGAttributes<SVGGElement> {
  /** 提示内容或提示框配置。 */
  tooltip?: ReactNode;
  /** 提示框对应的数据点位置。 */
  tooltipPoint?: readonly [number, number];
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: string;
}

/** 图表标记组件。 */
export function ChartMark({ tooltip, tooltipPoint, label, onPointerMove, onPointerLeave, onFocus, onBlur, ...props }: ChartMarkProps) {
  const context = useContext(ChartContext);
  return <g
    {...props}
    className={`sia-chart__mark${props.className ? ` ${props.className}` : ""}`}
    tabIndex={props.tabIndex??0}
    role="graphics-symbol"
    aria-label={label}
    onPointerMove={(event) => {
      if (tooltip) context?.showTooltip(event, tooltip, tooltipPoint);
      onPointerMove?.(event);
    }}
    onPointerLeave={(event) => {
      context?.hideTooltip();
      onPointerLeave?.(event);
    }}
    onFocus={(event) => {
      if (tooltip) context?.showTooltip(event, tooltip, tooltipPoint);
      onFocus?.(event);
    }}
    onBlur={(event) => {
      context?.hideTooltip();
      onBlur?.(event);
    }}
  />;
}

/** 图例的属性配置。 */
export interface ChartLegendProps {
  /** 图标宽度。 */
  iconWidth?: number;
  /**
   * 图标高度。
   * @defaultValue 14
   */
  iconHeight?: number;
  /**
   * 文字与相邻图形的间距。
   * @defaultValue 5
   */
  textGap?: number;
  /** 文字样式。 */
  textStyle?: CSSProperties;
  /** 未激活状态的颜色。 */
  inactiveColor?: string;
  /** 背景颜色或填充配置。 */
  background?: {
  /** 图形填充颜色。 */
  fill?:string;
  /** 图形描边颜色。 */
  stroke?:string;
  /** 描边或进度轨道粗细。 */
  strokeWidth?:number;
  /** 内容内边距。 */
  padding?:number};
  /** 允许的最大宽度。 */
  maxWidth?: number;
  /**
   * 相邻行的间距。
   * @defaultValue 24
   */
  rowGap?: number;
  /**
   * 数据点或节点使用的图形符号。
   * @defaultValue "rect"
   */
  symbol?: "rect" | "line" | "sector";
  /** 按展示顺序排列的项目配置。 */
  items: readonly ChartLegendItem[];
  /**
   * 横向位置或 X 轴数据值。
   * @defaultValue CHART_VIEWBOX_WIDTH / 2
   */
  x?: number;
  /**
   * 纵向位置或 Y 轴数据值。
   * @defaultValue 20
   */
  y?: number;
  /**
   * 交叉轴对齐
   * @defaultValue "center"
   */
  align?: "start" | "center" | "end";
  /**
   * 相邻项目的间距。
   * @defaultValue 18
   */
  itemGap?: number;
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /** 是否处于选中状态。 */
  selected?: Readonly<Record<string, boolean>>;
  /** 点击项目时调用。 */
  onItemClick?: (name: string) => void;
}

/** 图例组件。 */
export function ChartLegend({ items, symbol = "rect", x = CHART_VIEWBOX_WIDTH / 2, y = 20, align = "center", itemGap = 18, orientation = "horizontal", selected, onItemClick, maxWidth, rowGap = 24, iconWidth, iconHeight=14, textGap=5, textStyle, inactiveColor, background }: ChartLegendProps) {
  const paintId = useId().replaceAll(':', '');
  const widths = items.map((item) => (iconWidth==null?18:iconWidth+textGap) + (item.textWidth??Math.max(30, Array.from(item.name).reduce((width,character)=>width+(character.charCodeAt(0)>255 ? 13 : 7),0))));
  const totalWidth = orientation === "horizontal" ? widths.reduce((sum, value) => sum + value, 0) + Math.max(0, items.length - 1) * itemGap : Math.max(0, ...widths);
  const startX = align === "start" ? x : align === "end" ? x - totalWidth : x - totalWidth / 2;
  let cursor = startX;
  const wrap=orientation==="horizontal"&&maxWidth!=null&&maxWidth>0;
  const rowWidths:number[]=[0];
  const positions=widths.map(width=>{
    let row=rowWidths.length-1;
    if(wrap&&rowWidths[row]!>0&&rowWidths[row]!+itemGap+width>maxWidth!){rowWidths.push(0);row++;}
    const offset=rowWidths[row]!+(rowWidths[row]!>0?itemGap:0);
    rowWidths[row]=offset+width;
    return {row,offset};
  });
  return <g className="sia-chart__legend" aria-label="图例">
    {background?<rect data-legend-background="" x={(wrap?(align==='start'?x:align==='end'?x-Math.max(...rowWidths):x-Math.max(...rowWidths)/2):startX)-(background.padding??0)} y={y-(iconWidth==null?14:iconHeight/2)-(background.padding??0)} width={(wrap?Math.max(...rowWidths):totalWidth)+2*(background.padding??0)} height={(orientation==='vertical'?(items.length-1)*(itemGap+iconHeight):wrap?(rowWidths.length-1)*rowGap:0)+(iconWidth==null?20:iconHeight)+2*(background.padding??0)} fill={background.fill??'none'} stroke={background.stroke} strokeWidth={background.strokeWidth} pointerEvents="none"/>:null}
    {items.map((item, index) => {
      const position=positions[index]!;
      const itemX = wrap ? x-(align==="start"?0:rowWidths[position.row]!/(align==="end"?1:2))+position.offset : orientation === "horizontal" ? cursor : startX;
      const itemY = wrap ? y+position.row*rowGap : orientation === "horizontal" ? y : y + index * (itemGap + (iconWidth!=null?iconHeight:symbol==="sector"?14:8));
      if (orientation === "horizontal") cursor += widths[index]! + itemGap;
      const disabled = item.disabled || selected?.[item.name] === false;
      const gradient = item.fillGradient;
      const gradientId = `${paintId}-legend-${index}`;
      const color = disabled&&inactiveColor?inactiveColor:gradient ? `url(#${gradientId})` : item.color;
      return <g
        key={`${item.name}-${index}`}
        transform={`translate(${itemX} ${itemY})`}
        opacity={disabled&&!inactiveColor ? 0.35 : 1}
        role={onItemClick ? "button" : undefined}
        tabIndex={onItemClick ? 0 : undefined}
        className={onItemClick ? "sia-chart__legend-item" : undefined}
        aria-pressed={onItemClick ? !disabled : undefined}
        onPointerUp={() => onItemClick?.(item.name)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onItemClick?.(item.name);
          }
        }}
      >
        {gradient ? <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" gradientTransform={`translate(${-itemX} ${-itemY})`} x1={gradient.start[0]} y1={gradient.start[1]} x2={gradient.end[0]} y2={gradient.end[1]}>{gradient.stops.map((stop,i)=><stop key={i} offset={stop.offset} stopColor={stop.color}/>)}</linearGradient></defs> : null}
        {item.image?<image href={item.image} x={0} y={-iconHeight/2} width={iconWidth??20} height={iconHeight} opacity={disabled?.35:1}/>:iconWidth!=null&&(item.symbol??symbol)!=='sector'?((item.symbol??symbol)==='line'?<g><line x1={0} x2={iconWidth} y1={0} y2={0} stroke={color} strokeWidth={2}/><circle cx={iconWidth/2} cy={0} r={3} fill="#fff" stroke={color} strokeWidth={2}/></g>:<rect x={0} y={-iconHeight/2} width={iconWidth} height={iconHeight} rx={2} fill={color} stroke={item.borderColor} strokeWidth={item.borderColor?2:undefined}/>):<g>
        {(item.symbol??symbol) === "sector" ? <path d="M 0 -4 Q 9 -13 18 -4 L 13 1 Q 9 -3 5 1 Z" fill={color}/> : (item.symbol??symbol) === "line" ? <g><line x1={0} x2={18} y1={-4} y2={-4} stroke={color} strokeWidth={2} /><circle cx={9} cy={-4} r={3} fill="#fff" stroke={color} strokeWidth={2} /></g> : <rect x={0} y={-6} width={14} height={8} rx={3} fill={color} stroke={item.borderColor} strokeWidth={item.borderColor ? 2 : undefined} />}
        </g>}
        {onItemClick?<rect data-legend-hit-area="" x={0} y={iconWidth==null?-14:-iconHeight/2} width={widths[index]} height={iconWidth==null?20:iconHeight} fill="transparent"/>:null}
        <text x={iconWidth==null?20:iconWidth+textGap} y={0} dominantBaseline={iconWidth==null?undefined:'central'} style={{...textStyle,...item.textStyle,...(disabled&&inactiveColor?{fill:inactiveColor}: {})}}>{item.name}</text>
      </g>;
    })}
  </g>;
}

/** 图表坐标轴的属性配置。 */
export interface ChartAxisProps {
  /** Split axis strokes from bands/ticks/labels when a chart needs explicit layer ordering. */
  layer?: 'all'|'base'|'line';
  /** 坐标轴分隔区域的填充颜色。 */
  splitAreaColors?: readonly string[];
  /** Normalized band boundaries; defaults to evenly spaced intervals. */
  splitAreaPositions?: readonly number[];
  /** 线条样式。 */
  lineStyle?: CSSProperties;
  /** 刻度线样式。 */
  tickStyle?: CSSProperties;
  /** 网格线样式。 */
  gridStyle?: CSSProperties;
  /** 标签文字样式。 */
  labelStyle?: CSSProperties;
  /** 按标签配置的样式集合。 */
  labelStyles?: readonly (CSSProperties | undefined)[];
  /** Distance from the axis line to the label (independent of tick length). */
  labelMargin?: number;
  /** SVG 标签的水平锚点。 */
  labelAnchor?: 'start'|'middle'|'end';
  /** SVG 标签的文字基线。 */
  labelBaseline?: 'top'|'middle'|'bottom';
  /** 轴端是否保留间隔，或两端间隔的配置。 */
  boundaryGap?: boolean;
  /** 组件的水平或垂直排列方向。 */
  orientation: "top" | "bottom" | "left" | "right";
  /** 横向位置或 X 轴数据值。 */
  x: number;
  /** 纵向位置或 Y 轴数据值。 */
  y: number;
  /** 长度。 */
  length: number;
  /** 各操作入口的显示或无障碍文案。 */
  labels: readonly string[];
  /** Normalized positions for nonuniform numeric/calendar ticks. */
  positions?: readonly number[];
  /** 刻度在轴上的位置集合。 */
  tickPositions?: readonly number[];
  /** 网格线在轴上的位置集合。 */
  gridPositions?: readonly number[];
  /** Snap line centers to whole/half pixels according to their stroke width. Labels and bands are unaffected. */
  pixelAlign?: boolean;
  /** Outward distance of the axis stroke and tick origin from the logical axis. */
  lineOffset?: number;
  /**
   * 刻度相对于默认位置的偏移。
   * @defaultValue 0
   */
  tickOffset?: number;
  /**
   * 刻度线尺寸。
   * @defaultValue 5
   */
  tickSize?: number;
  /**
   * 网格线延伸长度。
   * @defaultValue 0
   */
  gridLength?: number;
  /** 将原始值转换为展示文本的函数。 */
  formatter?: (label: string, index: number) => string;
  /**
   * 是否反转坐标轴方向。
   * @defaultValue false
   */
  inverse?: boolean;
  /**
   * 刻度之间的间隔。
   * @defaultValue 1
   */
  tickInterval?: number;
  /**
   * 标签旋转角度。
   * @defaultValue 0
   */
  labelRotate?: number;
  /**
   * 是否显示连接线。
   * @defaultValue true
   */
  showLine?: boolean;
  /**
   * 是否显示刻度线。
   * @defaultValue true
   */
  showTicks?: boolean;
  /**
   * 是否显示数据标签。
   * @defaultValue true
   */
  showLabels?: boolean;
  /**
   * 是否显示网格线。
   * @defaultValue true
   */
  showGrid?: boolean;
  /** 名称或字段标识。 */
  name?: string;
  /** 坐标轴线颜色。 */
  axisColor?: string;
  /** 网格线颜色。 */
  gridColor?: string;
  /**
   * 是否使用虚线网格。
   * @defaultValue false
   */
  dashedGrid?: boolean;
}

/** 图表坐标轴组件。 */
export function ChartAxis({ layer="all",orientation, x, y, length, labels, positions,tickPositions,gridPositions,pixelAlign=false,lineOffset=0,tickOffset=0, boundaryGap, tickSize = 5, gridLength = 0, formatter, inverse = false, tickInterval = 1, labelRotate = 0, showLine = true, showTicks = true, showLabels = true, showGrid = true, name, axisColor, gridColor, dashedGrid = false, lineStyle,tickStyle,gridStyle,labelStyle,labelStyles,labelMargin,labelAnchor,labelBaseline,splitAreaColors,splitAreaPositions }: ChartAxisProps) {
  const horizontal = orientation === "bottom" || orientation === "top";
  const count = Math.max(1, labels.length - ((boundaryGap??!horizontal) ? 0 : 1));
  const direction = orientation === 'right' || orientation === 'bottom' ? 1 : -1;
  const snap = (value:number, style?:CSSProperties) => !pixelAlign ? value : Math.round(Number(style?.strokeWidth??1))%2 ? Math.floor(value)+0.5 : Math.round(value);
  const lineX = horizontal ? x : snap(x+lineOffset*direction,lineStyle);
  const lineY = horizontal ? snap(y+lineOffset*direction,lineStyle) : y;
  const stroke=showLine?<line data-axis-stroke="" x1={lineX} y1={lineY} x2={horizontal ? x + length : lineX} y2={horizontal ? lineY : y - length} className="sia-chart__axis-line" stroke={axisColor} style={{...(axisColor?{stroke:axisColor}:{}),...lineStyle}}/>:null;
  if(layer==='line')return <g className="sia-chart__axis-overlay" data-axis-orientation={orientation} aria-hidden="true" pointerEvents="none">{stroke}</g>;
  return <g className={`sia-chart__axis sia-chart__axis--${orientation}`} data-axis-orientation={orientation} aria-hidden="true">
    {splitAreaColors?.length&&gridLength>0?(splitAreaPositions??Array.from({length:count+1},(_,index)=>index/count)).slice(1).map((end,index)=>{
      const start=splitAreaPositions?.[index]??index/count,a=(inverse?1-end:start)*length,b=(inverse?1-start:end)*length;
      return <rect key={`area-${index}`} className="sia-chart__axis-split-area" pointerEvents="none" x={horizontal?x+a:orientation==='right'?x-gridLength:x} y={horizontal?orientation==='top'?y:y-gridLength:y-b} width={horizontal?b-a:gridLength} height={horizontal?gridLength:b-a} fill={splitAreaColors[index%splitAreaColors.length]}/>;
    }):null}
    {showGrid&&gridLength>0?gridPositions?.map((position,index)=>{
      const offset=(inverse?1-position:position)*length,px=horizontal?snap(x+offset,gridStyle):x,py=horizontal?y:snap(y-offset,gridStyle);
      return <line key={`grid-${index}`} className="sia-chart__grid-line" x1={orientation==='right'?px-gridLength:px} x2={horizontal?px:orientation==='left'?px+gridLength:px} y1={orientation==='top'?py+gridLength:py} y2={orientation==='bottom'?py-gridLength:py} stroke={gridColor} strokeDasharray={dashedGrid?'5 4':undefined} style={{...(gridColor?{stroke:gridColor}:{}),...gridStyle}}/>;
    }):null}
    {showTicks?tickPositions?.map((position,index)=>{
      const offset=(inverse?1-position:position)*length,px=horizontal?snap(x+offset,tickStyle):x+tickOffset*direction,py=horizontal?y+tickOffset*direction:snap(y-offset,tickStyle);
      return <line key={`tick-${index}`} className="sia-chart__axis-line" data-axis-tick="" x1={px} y1={py} x2={horizontal?px:px+tickSize*direction} y2={horizontal?py+tickSize*direction:py} stroke={axisColor} style={{...(axisColor?{stroke:axisColor}:{}),...tickStyle}}/>;
    }):null}
    {layer==='all'?stroke:null}
    {labels.map((label, index) => {
      if (index % Math.max(1, tickInterval) !== 0) return null;
      const rawOffset = positions?.[index]!==undefined?positions[index]!*length:labels.length <= 1 ? length / 2 : index / count * length;
      const offset = inverse ? length - rawOffset : rawOffset;
      const px = horizontal ? x + offset : x;
      const py = horizontal ? y : y - offset;
      const gridX=horizontal?snap(px,gridStyle):px,gridY=horizontal?py:snap(py,gridStyle);
      const tickX=horizontal?snap(px,tickStyle):px+tickOffset*direction,tickY=horizontal?py+tickOffset*direction:snap(py,tickStyle);
      const labelX = horizontal ? px : px + (labelMargin??tickSize + 7) * direction;
      const labelY = labelBaseline ? horizontal?py+(labelMargin??8)*direction:py : horizontal ? py + (labelMargin===undefined?tickSize+16:labelMargin+12) * direction : py + 4;
      return <g key={`${label}-${index}`}>
        {showGrid && gridLength > 0 && gridPositions===undefined ? <line
          x1={orientation === "right" ? gridX - gridLength : gridX}
          y1={orientation === "top" ? gridY + gridLength : gridY}
          x2={horizontal ? gridX : orientation === "left" ? gridX + gridLength : gridX}
          y2={orientation === "bottom" ? gridY - gridLength : gridY}
          className="sia-chart__grid-line"
          stroke={gridColor}
          style={{...(gridColor?{stroke:gridColor}:{}),...gridStyle}}
          strokeDasharray={dashedGrid ? "5 4" : undefined}
        /> : null}
        {showTicks && tickPositions===undefined ? <line data-axis-tick="" x1={tickX} y1={tickY} x2={horizontal ? tickX : tickX + tickSize * direction} y2={horizontal ? tickY + tickSize * direction : tickY} className="sia-chart__axis-line" stroke={axisColor} style={{...(axisColor?{stroke:axisColor}:{}),...tickStyle}} /> : null}
        {showLabels ? <text
          x={labelX}
          y={labelY}
          textAnchor={labelAnchor??(horizontal ? "middle" : orientation === "right" ? "start" : "end")}
          dominantBaseline={labelBaseline==='top'?'hanging':labelBaseline==='middle'?'central':labelBaseline==='bottom'?'text-after-edge':undefined}
          transform={labelRotate ? `rotate(${labelRotate} ${labelX} ${labelY})` : undefined}
          className="sia-chart__axis-label"
          style={{...labelStyle,...labelStyles?.[index]}}
        >{(formatter ? formatter(label, index) : label).split('\n').map((line,lineIndex)=><tspan key={lineIndex} x={labelX} dy={lineIndex?13:0}>{line}</tspan>)}</text> : null}
      </g>;
    })}
    {name ? <text x={horizontal ? x + length : x} y={horizontal ? y + (orientation === "bottom" ? 38 : -28) : y - length - 12} textAnchor="end" className="sia-chart__axis-name">{name}</text> : null}
  </g>;
}

/** 图表视觉映射的属性配置。 */
export interface ChartVisualMapProps {
  /**
   * 拖动过程中是否实时通知值变化。
   * @defaultValue true
   */
  realtime?:boolean;
  /** 鼠标悬停范围变化时调用。 */
  onHoverRange?:(range:readonly [number,number]|undefined)=>void;
  /** 指示器当前对应的值。 */
  indicatorValue?:number;
  /**
   * 是否使用 SVG 绘制交互手柄。
   * @defaultValue false
   */
  svgHandles?:boolean;
  /** 范围两端显示的标签。 */
  endLabels?: readonly [string,string];
  /** 允许的最小值。 */
  min: number;
  /** 允许的最大值。 */
  max: number;
  /**
   * 可选颜色或颜色序列。
   * @defaultValue ["#e6f4ff", "#1677ff"]
   */
  colors?: readonly string[];
  /**
   * 横向位置或 X 轴数据值。
   * @defaultValue 16
   */
  x?: number;
  /**
   * 纵向位置或 Y 轴数据值。
   * @defaultValue 284
   */
  y?: number;
  /**
   * 宽度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue 110
   */
  width?: number;
  /**
   * 高度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue 9
   */
  height?: number;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: string;
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /**
   * 是否允许通过拖拽图形修改数据。
   * @defaultValue false
   */
  calculable?: boolean;
  /**
   * 当前值；作为受控属性时，需要在变更回调中同步更新。
   * @defaultValue max
   */
  value?: number;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (value: number) => void;
  /** 是否启用范围选择，或指定选择范围。 */
  range?: readonly [number, number];
  /** 选择范围变化时调用。 */
  onRangeChange?: (range: [number, number]) => void;
  /** 分段视觉映射的区间配置。 */
  pieces?: readonly {
  /** 允许的最小值。 */
  min?: number;
  /** 允许的最大值。 */
  max?: number;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color: string }[];
  /** 当前选中的视觉映射分段。 */
  selectedPieces?: readonly boolean[];
  /** 切换分段选中状态时调用。 */
  onPieceToggle?: (index:number)=>void;
}

/** 图表视觉映射组件。 */
export function ChartVisualMap({ min, max, colors = ["#e6f4ff", "#1677ff"], x = 16, y = 284, width = 110, height = 9, label, endLabels, indicatorValue, onHoverRange, realtime=true, svgHandles=false, orientation = "horizontal", calculable = false, value = max, onChange, range, onRangeChange, pieces,selectedPieces,onPieceToggle }: ChartVisualMapProps) {
  const id = useId().replaceAll(":", "");
  const vertical = orientation === "vertical";
  if(svgHandles&&vertical&&!calculable&&!pieces?.length)return <ChartVerticalRange readOnly min={min} max={max} x={x} y={y} length={width} thickness={height} colors={colors} range={[min,max]} endLabels={endLabels} indicatorValue={indicatorValue} onHoverRange={onHoverRange}/>;
  if(svgHandles&&vertical&&calculable&&range&&!pieces?.length)return <ChartVerticalRange min={min} max={max} x={x} y={y} length={width} thickness={height} colors={colors} range={range} onChange={onRangeChange} endLabels={endLabels} indicatorValue={indicatorValue} onHoverRange={onHoverRange} realtime={realtime}/>;
  if(svgHandles&&!vertical&&calculable&&range&&!pieces?.length)return <ChartHorizontalRange min={min} max={max} x={x} y={y} length={width} thickness={height} colors={colors} range={range} onChange={onRangeChange} endLabels={endLabels} indicatorValue={indicatorValue} onHoverRange={onHoverRange} realtime={realtime}/>;
  return <g className="sia-chart__visual-map" aria-label={label ?? `值域 ${min} 至 ${max}`}>
    <defs><linearGradient id={id} x1="0" y1={vertical ? 1 : 0} x2={vertical ? 0 : 1} y2={vertical ? 0 : 0}>{colors.map((color,index)=><stop key={index} offset={index/Math.max(1,colors.length-1)} stopColor={color}/>)}</linearGradient></defs>
    {label ? <text x={x} y={y - 8}>{label}</text> : null}
    {pieces?.length ? pieces.map((piece, index) => <g key={index} role={onPieceToggle?'button':undefined} tabIndex={onPieceToggle?0:undefined} aria-label={onPieceToggle?`值域 ${piece.label??`${piece.min??''}–${piece.max??''}`}`:undefined} aria-pressed={onPieceToggle?selectedPieces?.[index]!==false:undefined} style={{opacity:selectedPieces?.[index]===false?.35:1,cursor:onPieceToggle?'pointer':undefined}} onPointerUp={()=>onPieceToggle?.(index)} onKeyDown={event=>{if(onPieceToggle&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onPieceToggle(index);}}} transform={`translate(${vertical ? x : x + index * (width / pieces.length)} ${vertical ? y + index * 24 : y})`}><rect width={vertical ? width : width / pieces.length - 2} height={vertical ? 18 : height} rx={3} fill={piece.color} /><text x={vertical ? width + 6 : width / pieces.length / 2} y={vertical ? 13 : height + 14} textAnchor={vertical ? "start" : "middle"}>{piece.label ?? `${piece.min ?? ""}–${piece.max ?? ""}`}</text></g>) : <rect x={x} y={y} width={vertical ? height : width} height={vertical ? width : height} rx={height / 2} fill={`url(#${id})`} />}
    {!pieces?.length ? <><text x={x} y={vertical ? y + width + 16 : y + height + 15} textAnchor="start">{endLabels?.[0]??min}</text><text x={vertical ? x : x + width} y={vertical ? y - 5 : y + height + 15} textAnchor={vertical ? "start" : "end"}>{endLabels?.[1]??max}</text></> : null}
    {calculable && !pieces?.length ? <foreignObject x={vertical ? x - 8 : x} y={vertical ? y : y - 8} width={vertical ? 26 : width} height={vertical ? width : 26}>{range ? <div className={`sia-chart__visual-map-range sia-chart__visual-map-range--${orientation}`}>
      <input aria-label={`${label ?? "值域"}下限`} type="range" min={min} max={max} value={Math.min(range[0], range[1])} onChange={(event) => onRangeChange?.([Math.min(Number(event.target.value), range[1]), range[1]])} />
      <input aria-label={`${label ?? "值域"}上限`} type="range" min={min} max={max} value={Math.max(range[0], range[1])} onChange={(event) => onRangeChange?.([range[0], Math.max(Number(event.target.value), range[0])])} />
    </div> : <input className={`sia-chart__visual-map-input sia-chart__visual-map-input--${orientation}`} aria-label={label ?? "值域控制"} type="range" min={min} max={max} value={value} onChange={(event) => onChange?.(Number(event.target.value))} />}</foreignObject> : null}
  </g>;
}

/** 图表数据缩放的属性配置。 */
export interface ChartDataZoomProps {
  /** 缩放手柄的显示标签。 */
  handleLabels?:readonly [ReactNode,ReactNode];
  /** 数据阴影绘制范围。 */
  shadowBounds?:{
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
  /**
   * 是否允许平移当前可视范围。
   * @defaultValue false
   */
  panEnabled?: boolean;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value: readonly [number, number];
  /**
   * 允许的最小值。
   * @defaultValue 0
   */
  min?: number;
  /**
   * 允许的最大值。
   * @defaultValue 100
   */
  max?: number;
  /**
   控件的无障碍名称，供屏幕阅读器识别。
   * @defaultValue "图表可见范围"
   */
  ariaLabel?: string;
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /**
   * 缩放控件内的数据概览阴影。
   * @defaultValue []
   */
  dataShadow?: readonly number[];
  /**
   * 是否显示详细数值。
   * @defaultValue false
   */
  showDetail?: boolean;
  /**
   * 允许的最小区间跨度。
   * @defaultValue 1
   */
  minSpan?: number;
  /** 将原始值转换为展示文本的函数。 */
  formatter?: (value: number) => ReactNode;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange: (value: [number, number]) => void;
}

/** 图表数据缩放组件。 */
export function ChartDataZoom({ value, min = 0, max = 100, ariaLabel = "图表可见范围", orientation = "horizontal", dataShadow = [], showDetail = false, minSpan = 1, formatter, onChange, panEnabled=false, shadowBounds,handleLabels }: ChartDataZoomProps) {
  const [activeHandle,setActiveHandle]=useState<0|1|null>(null);
  const pan=useRef<{id:number;origin:number;length:number;value:readonly [number,number]}>();
  const start = Math.min(value[0], value[1]);
  const end = Math.max(value[0], value[1]);
  const startPercent = (start - min) / Math.max(1, max - min) * 100;
  const endPercent = (end - min) / Math.max(1, max - min) * 100;
  const overviewWidth=shadowBounds?.width;
  const referenceFiller=overviewWidth?{left:Math.round(startPercent/100*overviewWidth)+8,right:overviewWidth-Math.round(startPercent/100*overviewWidth)-Math.round((endPercent-startPercent)/100*overviewWidth)+8}:undefined;
  const shadowMaximum = Math.max(1, ...dataShadow);
  const shadowPoints = dataShadow.map((item, index) => `${index / Math.max(1, dataShadow.length - 1) * 100},${18 - item / shadowMaximum * 16}`).join(" ");
  return <div className={`sia-chart-data-zoom sia-chart-data-zoom--${orientation}`} style={{ "--sia-chart-zoom-start": `${startPercent}%`, "--sia-chart-zoom-end": `${endPercent}%` } as CSSProperties}>
    {dataShadow.length ? <svg viewBox={shadowBounds?`0 0 ${shadowBounds.width} ${shadowBounds.height}`:'0 0 100 20'} preserveAspectRatio="none" aria-hidden="true"><polygon style={shadowBounds?{fill:'#efefff'}:undefined} points={shadowBounds?chartZoomShadow(dataShadow,shadowBounds.width,shadowBounds.height).map(point=>point.join(',')).join(' '):`0,20 ${shadowPoints} 100,20`} /></svg> : null}
    <div className="sia-chart-data-zoom__track"><i style={referenceFiller}/></div>
    {panEnabled?<div className="sia-chart-data-zoom__pan" style={referenceFiller} role="slider" tabIndex={0} aria-label={`${ariaLabel}整体移动`} aria-orientation={orientation} aria-valuemin={min} aria-valuemax={max-(end-start)} aria-valuenow={start} aria-valuetext={`${start} – ${end}`}
      onPointerDown={event=>{if(event.button!==0)return;const box=event.currentTarget.parentElement!.getBoundingClientRect();pan.current={id:event.pointerId,origin:orientation==='horizontal'?event.clientX:event.clientY,length:orientation==='horizontal'?box.width:box.height,value:[start,end]};event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();}}
      onPointerMove={event=>{const state=pan.current;if(!state||state.id!==event.pointerId||state.length<=0)return;const point=orientation==='horizontal'?event.clientX:event.clientY;onChange(chartZoomPan(state.value,(point-state.origin)/state.length*(max-min),min,max));}}
      onPointerUp={event=>{if(pan.current?.id===event.pointerId){pan.current=undefined;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}}
      onPointerCancel={()=>{pan.current=undefined;}} onLostPointerCapture={()=>{pan.current=undefined;}}
      onKeyDown={event=>{const negative=orientation==='horizontal'?'ArrowLeft':'ArrowUp',positive=orientation==='horizontal'?'ArrowRight':'ArrowDown';if([negative,positive,'Home','End'].includes(event.key)){event.preventDefault();onChange(chartZoomPan([start,end],event.key==='Home'?min-start:event.key==='End'?max-end:event.key===negative?-1:1,min,max));}}}/>:null}
    <input data-zoom-start="" aria-label={`${ariaLabel}起点`} type="range" min={min} max={max} value={start} onPointerEnter={()=>setActiveHandle(0)} onPointerLeave={event=>{if(event.currentTarget!==document.activeElement)setActiveHandle(null);}} onFocus={()=>setActiveHandle(0)} onBlur={()=>setActiveHandle(null)} onChange={(event) => onChange([Math.min(Number(event.target.value), end - minSpan), end])} />
    <input data-zoom-end="" aria-label={`${ariaLabel}终点`} type="range" min={min} max={max} value={end} onPointerEnter={()=>setActiveHandle(1)} onPointerLeave={event=>{if(event.currentTarget!==document.activeElement)setActiveHandle(null);}} onFocus={()=>setActiveHandle(1)} onBlur={()=>setActiveHandle(null)} onChange={(event) => onChange([start, Math.max(Number(event.target.value), start + minSpan)])} />
    {handleLabels&&activeHandle!==null?<span data-zoom-handle-detail={activeHandle} aria-hidden="true" style={{position:'absolute',pointerEvents:'none',zIndex:2,top:'50%',left:activeHandle===0?`calc(${startPercent}% - 5px)`:`calc(${endPercent}% + 5px)`,transform:activeHandle===0?'translate(-100%,-50%)':'translateY(-50%)',font:'normal 12px Arial',color:'#333',whiteSpace:'nowrap'}}>{handleLabels[activeHandle]}</span>:null}
    {showDetail ? <output>{formatter ? formatter(start) : start} – {formatter ? formatter(end) : end}</output> : null}
  </div>;
}

/** 图表时间轴的属性配置。 */
export interface ChartTimelineProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** 绘制或内容渲染器。 */
  renderer?: 'html' | 'nodes';
  /** 时间轴日期序列。 */
  dates?: readonly string[];
  /** 横向位置或 X 轴数据值。 */
  x?:number;
  /** 纵向位置或 Y 轴数据值。 */
  y?:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?:number;
  /** 各操作入口的显示或无障碍文案。 */
  labels: readonly string[];
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value: number;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange: (index: number) => void;
  /**
   * 是否自动播放时间轴。
   * @defaultValue false
   */
  autoPlay?: boolean;
  /**
   * 自动播放切换的时间间隔。
   * @defaultValue 2000
   */
  playInterval?: number;
  /**
   * 是否循环播放。
   * @defaultValue true
   */
  loop?: boolean;
}

/** 图表时间轴组件。 */
export function ChartTimeline({ labels, value, onChange, autoPlay = false, playInterval = 2000, loop = true, className = "", ...props }: ChartTimelineProps) {
  const [playing, setPlaying] = useState(autoPlay);
  useEffect(() => setPlaying(autoPlay), [autoPlay]);
  useEffect(() => {
    if (!playing || labels.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      const next = value + 1;
      if (next < labels.length) onChange(next);
      else if (loop) onChange(0);
      else setPlaying(false);
    }, Math.max(120, playInterval));
    return () => window.clearInterval(timer);
  }, [labels.length, loop, onChange, playInterval, playing, value]);
  return <div {...props} className={`sia-chart-timeline${className ? ` ${className}` : ""}`}>
    <button type="button" aria-label={playing ? "暂停时间轴" : "播放时间轴"} onClick={() => setPlaying((current) => !current)}>{playing ? "Ⅱ" : "▶"}</button>
    <input aria-label="图表时间轴" type="range" min={0} max={Math.max(0, labels.length - 1)} value={Math.min(value, Math.max(0, labels.length - 1))} onChange={(event) => onChange(Number(event.target.value))} />
    <output>{labels[value] ?? ""}</output>
  </div>;
}

/** 按数据索引循环读取调色板颜色。 */
export function chartColor(index: number, palette: readonly string[] = DEFAULT_CHART_PALETTE) {
  return palette[index % Math.max(1, palette.length)] ?? DEFAULT_CHART_PALETTE[0];
}

/** 将图表数字转换为适合标签展示的简洁文本。 */
export function formatChartNumber(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}m`;
  if (Math.abs(value) >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return Number(value.toFixed(2)).toString();
}

/** 根据数据计算包含整齐刻度的数据范围，可配置是否包含零和分段数量。 */
export function niceChartDomain(values: readonly number[], includeZero = true, splitNumber = 5, preferredSteps: readonly number[] = [1, 2, 5, 10]): [number, number, number] {
  const finite = values.filter(Number.isFinite);
  let minimum = finite.length ? Math.min(...finite) : 0;
  let maximum = finite.length ? Math.max(...finite) : 1;
  if (includeZero) {
    minimum = Math.min(0, minimum);
    maximum = Math.max(0, maximum);
  }
  if (minimum === maximum) maximum = minimum + 1;
  const roughStep = (maximum - minimum) / Math.max(1, splitNumber);
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(roughStep, Number.EPSILON)));
  const normalized = roughStep / magnitude;
  const step = (preferredSteps.find((candidate) => candidate >= normalized) ?? 10) * magnitude;
  return [Math.floor(minimum / step) * step, Math.ceil(maximum / step) * step, step];
}

/** 根据数据范围生成坐标轴刻度值。 */
export function chartTicks(domain: readonly [number, number, number]) {
  const [minimum, maximum, step] = domain;
  const result: number[] = [];
  for (let value = minimum; value <= maximum + step / 2 && result.length < 12; value += step) result.push(value);
  return result;
}

/** 将数据值从输入范围线性映射到输出范围。 */
export function linearScale(value: number, domain: readonly [number, number], range: readonly [number, number]) {
  if (domain[0] === domain[1]) return (range[0] + range[1]) / 2;
  return range[0] + (value - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0]);
}

export { svgArcPath } from "./arcPath";

/** 根据坐标点集合生成平滑 SVG 路径。 */
export function smoothSvgPath(points: readonly (readonly [number, number])[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]![0]} ${points[0]![1]}`;
  let path = `M ${points[0]![0]} ${points[0]![1]}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const middleX = (previous[0] + current[0]) / 2;
    path += ` C ${middleX} ${previous[1]}, ${middleX} ${current[1]}, ${current[0]} ${current[1]}`;
  }
  return path;
}
