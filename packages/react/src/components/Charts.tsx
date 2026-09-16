import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { ChartPointMotion } from "./ChartPointMotion";
import { ChartScatterMotion } from "./ChartScatterMotion";
import {layoutEventRiver,eventRiverOutline} from './eventRiverLayout';
import {EventRiverBubble} from './EventRiverBubble';
import {EventRiverMotion} from './EventRiverMotion';
import {calendarReferenceTicks} from './calendarReferenceTicks';
import {transferPieValue} from './pieTransfer';
import {ChartValueIsland} from './ChartValueIsland';
import {ChartPulseRing,type ChartPulseRingProps} from './ChartPulseRing';
import { smoothLineControls } from "./smoothLineControls";
import {mixedBarSlots,type MixedBarSpacing} from './mixedBarSlots';
import {mixedValueDomain,type MixedValueDomainOptions} from './mixedValueDomain';
import { chartStarPoints } from "./chartStarPoints";
import {chartPixelSample} from './chartPixelSample';
import { chartMarkerPath, type ChartPathMarker } from "./chartMarkerPath";
import {ChartLargeMapPointCanvas,type LargeMapPointCanvasGroup} from './ChartLargeMapPointCanvas';
import { ChartCrosshair } from "./ChartCrosshair";
import {HeatmapRaster} from './HeatmapRasterLayer';
import {MatrixChordPlot,type MatrixChordAppearance} from './MatrixChordPlot';
import {NodeChordPlot} from './NodeChordPlot';
import {graphLayout,advanceGraphLayout,reheatGraphLayout,type ForcePoint,type ForceLayoutOptions} from './graphLayout';
import {graphLinkGeometry} from './graphLinkGeometry';
import {forceFrameBudget} from './forceFrameBudget';
import {radarRatio,radarDataBounds,radarNiceTicks} from './radarScale';
import {transferRadarSeries} from './radarTransfer';
import {transferCartesianValue,type CartesianIsland} from './cartesianTransfer';
import {findCompositeValueTarget,type ChartValueTransferHandler} from './compositeValueTransfer';
import type {HeatRasterOptions} from './heatmapRaster';
import { ChartRoamGroup } from "./ChartRoamGroup";
import { TreeNodeGlyph } from "./TreeNodeGlyph";
import {vennLensPath} from './vennGeometry';
import {layoutCloudWords} from './wordCloudLayout';
import {buildScatterBatches} from './scatterBatch';
import {scatterStatistics} from './scatterStatistics';
import {scatterCategoryWindow} from './scatterCategoryWindow';
import {visualPieceIndex} from './visualPiece';
import {scatterValueWindow} from './scatterValueWindow';
import {chartTimeTicks} from './chartTimeTicks';
import type {CloudBounds} from './wordCloudLayout';
import { resolveTreeItemStyle } from "./treeStyles";
import type {TreeItemStyle} from "./treeStyles";
import { layoutBarValues } from "./barLayout";
import { gaugePointerPoints } from "./gaugeGeometry";
import { layoutFunnelValues } from "./funnelLayout";
import { layoutPieValues } from "./pieLayout";
import {layoutPieLabelY} from './pieLabelLayout';
import {fitMapBounds} from './mapProjection';
import {projectMapOverlay} from './mapOverlayProjection';
import {resolveMapRegionAppearance, type MapRegionAppearance} from './mapRegionAppearance';
import {mapLineControl} from './mapLineGeometry';
import {ChartMapLineEffect} from './ChartMapLineEffect';
import {ChartBundledMapCanvas} from './ChartBundledMapCanvas';
import type {BundledMapLines} from './ChartBundledMapCanvas';
import {ChartMapLineReveal} from './ChartMapLineReveal';
import {ChartMapPointEntrance} from './ChartMapPointEntrance';
import {ChartMapEffectCanvas} from './ChartMapEffectCanvas';
import {createSpecialAreaProjection} from './mapSpecialArea';
import type {MapSpecialArea} from './mapSpecialArea';
import {categoryLabelStep} from './categoryLabelInterval';
import {useMapRoam} from './useMapRoam';
import {chartColorRamp} from './chartColorRamp';
import {ChartRoamController} from './ChartRoamController';
import { layoutTreemapValues } from "./treemapLayout";
import { layoutTreeNodes } from "./treeLayout";
import type { TreemapLayoutBox } from "./treemapLayout";
import { ChartDataEditor } from "./ChartDataEditor";
import {ChartBarStatistics} from './ChartBarStatistics';
import {barStatistics} from './barStatistics';
import {barMagicLayout} from './barMagicLayout';
import {lineSegments} from './lineSegments';
import {useBarMagicState} from './useBarMagicState';
import {useBarValueTransfer} from './useBarValueTransfer';
import { logarithmicScale, logarithmicTicks, logarithmicValueAt } from "./chartScales";
import {
  ChartAxis,
  ChartDataZoom,
  ChartLegend,
  ChartMark,
  ChartVisualMap,
  DEFAULT_CHART_PALETTE,
  SiaChart,
  chartColor,
  chartTicks,
  formatChartNumber,
  linearScale,
  niceChartDomain,
  smoothSvgPath,
  svgArcPath,
} from "./Chart";
import type { ChartDataClickInfo, SiaChartProps, SiaChartRef } from "./Chart";

const PLOT = { x: 62, y: 48, width: 628, height: 250 } as const;
const PLOT_BOTTOM = PLOT.y + PLOT.height;

/** Chart的数据系列。 */
export interface ChartSeries {
  /** 名称或字段标识。 */
  name: string;
  /** 用于渲染的数据集合。 */
  data: readonly number[];
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
}

/** CartesianChart的属性配置。 */
export interface CartesianChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** 类目或数据分组集合。 */
  categories: readonly string[];
  /** 图表数据系列。 */
  series: readonly ChartSeries[];
  /** 是否显示图例。 */
  showLegend?: boolean;
  /** 是否允许通过图例切换系列显示。 */
  legendInteractive?: boolean;
  /** 图例项目的选中状态。 */
  legendSelected?: Readonly<Record<string, boolean>>;
  /** 图例选中状态变化时调用。 */
  onLegendSelectionChange?: (selected: Record<string, boolean>) => void;
  /** 将数值格式化为显示文本的函数。 */
  valueFormatter?: (value: number) => ReactNode;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<number>) => void;
}

function useLegendSelection(names: readonly string[], controlled: Readonly<Record<string, boolean>> | undefined, onChange: ((selected: Record<string, boolean>) => void) | undefined) {
  const [internal, setInternal] = useState<Record<string, boolean>>(() => Object.fromEntries(names.map((name) => [name, true])));
  useEffect(() => {
    setInternal((current) => {
      const next = { ...current };
      names.forEach((name) => { if (!(name in next)) next[name] = true; });
      return next;
    });
  }, [names.join("\u0000")]);
  const selected = controlled ?? internal;
  const replace = (next: Record<string, boolean>) => {
    if (!controlled) setInternal(next);
    onChange?.(next);
  };
  const toggle = (name: string) => {
    const next = { ...selected, [name]: selected[name] === false };
    replace(next);
  };
  return { selected, replace, toggle, isSelected: (name: string) => selected[name] !== false };
}

function getColor(index: number, color: string | undefined, palette: readonly string[] | undefined) {
  return color ?? chartColor(index, palette ?? DEFAULT_CHART_PALETTE);
}

function TooltipValue({ name, series, value, formatter }: { name: string; series?: string; value: number; formatter?: (value: number) => ReactNode }) {
  return <><strong>{name}</strong>{series ? <span>{series}</span> : null}<b>{formatter ? formatter(value) : formatChartNumber(value)}</b></>;
}

function CartesianAxes({ categories, domain, band = false }: { categories: readonly string[]; domain: readonly [number, number, number]; band?: boolean }) {
  const ticks = chartTicks(domain);
  const x = band
    ? categories.map((_, index) => PLOT.x + (index + 0.5) / Math.max(1, categories.length) * PLOT.width)
    : categories.map((_, index) => PLOT.x + index / Math.max(1, categories.length - 1) * PLOT.width);
  return <g>
    <ChartAxis orientation="left" x={PLOT.x} y={PLOT_BOTTOM} length={PLOT.height} labels={ticks.map(formatChartNumber)} gridLength={PLOT.width} />
    <line x1={PLOT.x} y1={PLOT_BOTTOM} x2={PLOT.x + PLOT.width} y2={PLOT_BOTTOM} className="sia-chart__axis-line" />
    {categories.map((label, index) => <g key={`${label}-${index}`} aria-hidden="true">
      <line x1={x[index]} y1={PLOT_BOTTOM} x2={x[index]} y2={PLOT_BOTTOM + 5} className="sia-chart__axis-line" />
      <text x={x[index]} y={PLOT_BOTTOM + 21} textAnchor="middle" className="sia-chart__axis-label">{label}</text>
    </g>)}
  </g>;
}

export function linePath(points: readonly (readonly [number, number])[], curve: LineSeries["curve"]) {
  if (curve === "smooth") {
    if (!points.length) return "";
    const controls = smoothLineControls(points);
    return points.slice(1).reduce((path, point, index) => `${path} C ${controls[index]!.outgoing.join(" ")} ${controls[index + 1]!.incoming.join(" ")} ${point.join(" ")}`, `M ${points[0]!.join(" ")}`);
  }
  if (curve === "step") {
    if (!points.length) return "";
    return points.slice(1).reduce((path, point, index) => {
      const previous = points[index]!;
      const middle = (previous[0] + point[0]) / 2;
      return `${path} H ${middle} V ${point[1]} H ${point[0]}`;
    }, `M ${points[0]![0]} ${points[0]![1]}`);
  }
  return points.map((point, index) => `${index ? "L" : "M"} ${point[0]} ${point[1]}`).join(" ");
}

function chartLayerOrder<T>(layers: T[], reverse: boolean) {
  return reverse ? layers.reverse() : layers;
}

/** 折线图上的一个数据点。 */
export type LinePoint = readonly [number | string | Date, number];

/** Line的数据系列。 */
export interface LineSeries extends Omit<ChartSeries, "data"> {
  /** 标签文字样式。 */
  labelStyle?: CSSProperties;
  /** 高亮状态的标签样式。 */
  emphasisLabelStyle?: CSSProperties;
  /** 高亮时是否显示标签集合。 */
  showEmphasisLabels?: boolean;
  /** 标签文本格式化函数。 */
  labelFormatter?: (value: number, category: string, index: number) => ReactNode;
  /** 高亮标签格式化函数。 */
  emphasisLabelFormatter?: (value: number, category: string, index: number) => ReactNode;
  /** 按数据点设置的样式集合。 */
  pointStyles?:readonly {
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 高亮状态的颜色。 */
  emphasisColor?:string;
  /** 数据符号尺寸。 */
  symbolSize?:number;
  /** 数据点或节点使用的图形符号。 */
  symbol?:LineSeries['symbol'];
  /** 数据符号使用的图片。 */
  symbolImage?:string;
  /** 数据符号旋转角度。 */
  symbolRotate?:number;
  /** 标签显示位置。 */
  labelPosition?:'inside'|'top';
  /** 高亮状态的标签位置。 */
  emphasisLabelPosition?:'inside'|'top';
  /** 是否显示标签文本。 */
  showLabel?:boolean;
  /** 高亮时是否显示标签。 */
  showEmphasisLabel?:boolean;
  /** 标签文字样式。 */
  labelStyle?:CSSProperties;
  /** 高亮状态的标签样式。 */
  emphasisLabelStyle?:CSSProperties}[];
  /** 高亮状态的颜色。 */
  emphasisColor?:string;
  /** 图形填充渐变配置。 */
  fillGradient?:BarLinearGradient;
  /** 面积区域的填充渐变。 */
  areaGradient?:BarLinearGradient;
  /** 线条阴影配置。 */
  lineShadow?: {
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string;
  /** 模糊半径。 */
  blur:number;
  /** 水平方向的偏移量。 */
  offsetX?:number;
  /** 垂直方向的偏移量。 */
  offsetY?:number};
  /** 统计标线配置。 */
  statisticLines?:readonly ('average'|'min'|'max')[];
  /** 用于渲染的数据集合。 */
  data: readonly (number | LinePoint)[];
  /** 堆叠分组标识；同标识的数据系列参与同组堆叠。 */
  stack?: string;
  /** 连接数据点的曲线类型。 */
  curve?: "straight" | "smooth" | "step";
  /** 面积区域填充配置。 */
  area?: boolean;
  /** 是否显示数据点。 */
  showPoints?: boolean;
  /** 是否显示平均值标记。 */
  markAverage?: boolean;
  /** 是否显示最小值标记。 */
  markMin?: boolean;
  /** 是否显示最大值标记。 */
  markMax?: boolean;
  /** 是否显示数据标签。 */
  showLabels?: boolean;
  /** 线条样式。 */
  lineStyle?: "solid" | "dashed" | "dotted";
  /** 线条粗细。 */
  lineWidth?: number;
  /** 数据点或节点使用的图形符号。 */
  symbol?: "circle" | "square" | "diamond" | "none" | "star" | "star6" | "heart" | "emptyHeart" | "droplet" | "pin" | "emptyPin" | "arrow" | "emptyCircle" | "image";
  /** 数据符号使用的图片。 */
  symbolImage?: string;
  /** 数据符号旋转角度。 */
  symbolRotate?: number;
  /** 数据符号尺寸。 */
  symbolSize?: number;
  /** 数据点是否使用空心符号。 */
  hollowSymbol?: boolean;
  /** 标记点配置集合。 */
  markPoints?: readonly {
  /** 名称或字段标识。 */
  name: string;
  /** 项目在当前集合中的索引，从 0 开始。 */
  index: number;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: string }[];
}

/** 折线图的属性配置。 */
export interface LineChartProps extends Omit<CartesianChartProps, "series"> {
  /**
   * 数据拖拽计算的处理模式。
   * @defaultValue 'resize'
   */
  calculableMode?:'resize'|'transfer';
  /** 图表间数据转移失败时调用。 */
  onTransferError?:(message:string)=>void;
  /** 绘图区的边距和布局配置。 */
  grid?: {
  /** 距左侧的位置或间距。 */
  left?:number;
  /** 距顶部的位置或间距。 */
  top?:number;
  /** 距右侧的位置或间距。 */
  right?:number;
  /** 距底部的位置或间距。 */
  bottom?:number};
  /** Shared value-transfer controller for composed chart mode switches. */
  valueTransfer?: ReturnType<typeof useBarValueTransfer>;
  /**
   * 类目标签显示间隔。
   * @defaultValue 0
   */
  categoryLabelInterval?:number|'auto';
  /**
   * 轴端是否保留间隔，或两端间隔的配置。
   * @defaultValue false
   */
  boundaryGap?: boolean;
  /**
   * 是否显示类目轴分隔线。
   * @defaultValue true
   */
  showCategorySplitLine?: boolean;
  /** 类目轴名称。 */
  categoryAxisName?: string;
  /** 数值轴名称。 */
  valueAxisName?: string;
  /** 图例布局配置。 */
  legendLayout?: {
  /** 横向位置或 X 轴数据值。 */
  x?: number;
  /** 纵向位置或 Y 轴数据值。 */
  y?: number;
  /** 交叉轴对齐 */
  align?: "start" | "center" | "end" };
  /**
   * 对数轴使用的底数。
   * @defaultValue 10
   */
  logBase?: number;
  /**
   * 对数刻度的指数步长。
   * @defaultValue 1
   */
  logExponentStep?: number;
  /**
   * 图形外观配置。
   * @defaultValue "sia"
   */
  appearance?: "sia" | "macarons";
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /**
   * 数据更新动画的持续时间。
   * @defaultValue 500
   */
  animationDurationUpdate?: number;
  /** 数值轴的数据范围。 */
  valueDomain?: readonly [number, number, number];
  /** 坐标轴标签格式化函数。 */
  axisLabelFormatter?: (value: number) => string;
  /** 图表数据系列。 */
  series: readonly LineSeries[];
  /**
   * 是否堆叠展示数据系列。
   * @defaultValue false
   */
  stacked?: boolean;
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "vertical"
   */
  orientation?: "vertical" | "horizontal";
  /**
   * X 轴类型。
   * @defaultValue "category"
   */
  xAxisType?: "category" | "value" | "time";
  /**
   * 数值轴类型。
   * @defaultValue "value"
   */
  valueAxisType?: "value" | "log";
  /**
   * 是否反转数值轴。
   * @defaultValue false
   */
  valueAxisInverse?: boolean;
  /**
   * 提示框按数据项还是坐标轴触发。
   * @defaultValue "item"
   */
  tooltipTrigger?: "item" | "axis";
  /**
   * 数据区域缩放配置。
   * @defaultValue false
   */
  dataZoom?: boolean;
  /** Percentage windows can address array slices rather than point-to-point distances. */
  zoomIndexMode?: 'points'|'slice';
  /**
   * 缩放控件的位置。
   * @defaultValue 'bottom'
   */
  zoomPosition?: 'top'|'bottom';
  /** 缩放控件的布局边界。 */
  zoomControlBounds?:{
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
  /**
   * 是否允许拖动缩放范围进行平移。
   * @defaultValue false
   */
  zoomPan?: boolean;
  /**
   * 缩放框选区域的形状。
   * @defaultValue 'band'
   */
  zoomSelectionShape?: 'band'|'rectangle';
  /** 缩放框选区域的样式。 */
  zoomSelectionStyle?:CSSProperties;
  /** 可接受的最小框选尺寸。 */
  zoomMinSelectionSize?:readonly [number,number];
  /**
   * 是否允许通过拖拽图形修改数据。
   * @defaultValue false
   */
  calculable?: boolean;
  /** 缩放级别或缩放范围。 */
  zoom?: readonly [number, number];
  /** 初始缩放范围或缩放级别。 */
  defaultZoom?: readonly [number, number];
  /** 缩放范围变化时调用。 */
  onZoomChange?: (value: [number, number]) => void;
  /** 数据被交互修改后调用。 */
  onDataChange?: (series: readonly LineSeries[]) => void;
}

function lineValue(datum: number | LinePoint) {
  return typeof datum === "number" ? datum : datum[1];
}

function lineXValue(datum: number | LinePoint, index: number) {
  if (typeof datum === "number") return index;
  const value = datum[0];
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : index;
}

function logDomain(values: readonly number[], base = 10, padding = false, exponentStep = 1): [number, number, number] {
  const finite = values.filter(value=>value!==0 && Number.isFinite(value));
  const negative = finite.length > 0 && finite.every(value=>value<0);
  const magnitudes = finite.filter(value=>negative ? value<0 : value>0).map(Math.abs);
  if (!magnitudes.length) return [1,base,1];
  const low=Math.log(Math.min(...magnitudes))/Math.log(base);
  const high=Math.log(Math.max(...magnitudes))/Math.log(base);
  const first=Math.floor(low)-(padding && Math.abs(low-Math.round(low))<1e-8 ? 1 : 0);
  const last=Math.ceil(high)+(padding && Math.abs(high-Math.round(high))<1e-8 ? 1 : 0);
  const minimum=base**first;
  const maximum=base**(first+Math.max(1,Math.ceil((last-first)/exponentStep))*exponentStep);
  return negative ? [-maximum,-minimum,1] : [minimum,maximum,1];
}

function logScale(value: number, domain: readonly [number, number], range: readonly [number, number]) {
  return logarithmicScale(value,domain,range);
}

function lineSymbol(type: LineSeries["symbol"], x: number, y: number, size: number, color: string, image?:string, strokeWidth=2) {
  if(type==='image')return image?<image data-chart-symbol="image" href={image} x={x-size/2} y={y-size/2} width={size} height={size} preserveAspectRatio="none"/>:null;
  if(type==='emptyCircle')return <circle cx={x} cy={y} r={size/2} fill="#fff" stroke={color} strokeWidth={2}/>;
  const pathType=type==='emptyHeart'?'heart':type==='emptyPin'?'pin':type;
  if(pathType&&['heart','droplet','pin','arrow'].includes(pathType))return <path data-chart-symbol={type} d={chartMarkerPath(pathType as ChartPathMarker,x,y,size)} fill={type?.startsWith('empty')?'#fff':color} stroke={color} strokeWidth={strokeWidth}/>;
  if(type==='star'||type==='star6')return <polygon data-chart-symbol={type} points={chartStarPoints(x,y,size,type==='star'?5:6).map(p=>p.join(',')).join(' ')} fill={color} stroke={color} strokeWidth={strokeWidth}/>;
  if (type === "none") return <circle cx={x} cy={y} r={Math.max(6, size)} fill="transparent" />;
  if (type === "square") return <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={1} fill={color} stroke="var(--sia-color-surface)" strokeWidth={2} />;
  if (type === "diamond") return <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={1} fill={color} stroke="var(--sia-color-surface)" strokeWidth={2} transform={`rotate(45 ${x} ${y})`} />;
  return <circle cx={x} cy={y} r={size / 2} fill={color} stroke="var(--sia-color-surface)" strokeWidth={2} />;
}

function useZoom(value: readonly [number, number] | undefined, defaultValue: readonly [number, number] | undefined, onChange: ((value: [number, number]) => void) | undefined) {
  const [internal, setInternal] = useState<[number, number]>([...(defaultValue ?? [0, 100])] as [number, number]);
  const current = value ?? internal;
  const update = (next: [number, number]) => {
    if (!value) setInternal(next);
    onChange?.(next);
  };
  return [current, update] as const;
}

function useToolboxMagicType(toolbox: SiaChartProps["toolbox"], fallback: string) {
  const options = toolbox === true ? {} : typeof toolbox === "object" ? toolbox : undefined;
  const [internal, setInternal] = useState(options?.activeMagicType ?? fallback);
  useEffect(() => {
    if (options?.activeMagicType) setInternal(options.activeMagicType);
  }, [options?.activeMagicType]);
  const active = options?.activeMagicType ?? internal;
  const resolved = options ? {
    ...options,
    activeMagicType: active,
    onMagicTypeChange: (type: string) => {
      if (options.activeMagicType == null) setInternal(type);
      options.onMagicTypeChange?.(type);
    },
    onRestore: () => {
      if (options.activeMagicType == null) setInternal(fallback);
      options.onRestore?.();
    },
  } : toolbox;
  return [active, resolved] as const;
}

/** 折线图组件。 */
export const LineChart = forwardRef<SiaChartRef, LineChartProps>(function LineChart(
  { calculableMode = 'resize', onTransferError, grid, valueTransfer: externalValueTransfer, categories, series: sourceSeries, appearance = "sia", categoryLabelInterval=0, boundaryGap = false, showCategorySplitLine = true, categoryAxisName, valueAxisName, legendLayout, logBase = 10, logExponentStep = 1, animationProgress, animationDurationUpdate = 500, valueDomain, axisLabelFormatter, stacked = false, orientation = "vertical", xAxisType = "category", valueAxisType = "value", valueAxisInverse = false, tooltipTrigger = "item", showLegend = true, legendInteractive = true, legendSelected, onLegendSelectionChange, valueFormatter, onDataClick, dataZoom = false, zoomIndexMode='points', zoomPosition='bottom', zoomControlBounds, zoomPan=false, zoomSelectionShape='band', zoomSelectionStyle, zoomMinSelectionSize, calculable = false, zoom, defaultZoom, onZoomChange, onDataChange, palette, toolbox, ...props },
  ref,
) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [editableSeries, setEditableSeries] = useState<readonly LineSeries[]>(sourceSeries);
  const [dragPoint, setDragPoint] = useState<readonly [number, number] | null>(null);
  const linePaintId=useId().replaceAll(':','');
  const [hoveredLinePoint,setHoveredLinePoint]=useState<string>();
  useEffect(() => setEditableSeries(sourceSeries), [sourceSeries]);
  // A composed mode has a single data owner; do not render an effect-delayed copy after a drop.
  const series = externalValueTransfer ? sourceSeries : editableSeries;
  const initialTransferSeries=useMemo(()=>sourceSeries.map(item=>({...item,data:item.data.map(lineValue)})),[sourceSeries]);
  const localTransfer=useBarValueTransfer(series.map(item=>({...item,data:item.data.map(lineValue)})),initialTransferSeries,categories,calculable&&calculableMode==='transfer'&&!externalValueTransfer,nextBars=>{
    const next=series.map((item,row)=>({...item,data:item.data.map((datum,index)=>{
      const value=barDatum(nextBars[row]!.data[index]!).value;
      return typeof datum==='number'?value:[datum[0],value] as LinePoint;
    })}));
    setEditableSeries(next);onDataChange?.(next);
  },onTransferError);
  const valueTransfer=externalValueTransfer??(calculable&&calculableMode==='transfer'?localTransfer:undefined);
  const legacy = appearance === "macarons";
  const plot = legacy ? { x: grid?.left??80, y: grid?.top??60, width: (props.viewBoxSize?.[0] ?? 720) - (grid?.left??80) - (grid?.right??80), height: (props.viewBoxSize?.[1] ?? 360) - (grid?.top??60) - (grid?.bottom??70) } : { x: 62, y: 48, width: 628, height: 250 };
  const PLOT_BOTTOM = plot.y + plot.height;
  const PLOT = plot;
  const legend = useLegendSelection(series.map((item) => item.name), legendSelected, onLegendSelectionChange);
  const [zoomValue, setZoomValue] = useZoom(zoom, defaultZoom, onZoomChange);
  const inlineZoom=dataZoom&&zoomControlBounds?<foreignObject className="sia-chart__inline-zoom sia-chart__inline-zoom--compact" {...zoomControlBounds}><ChartDataZoom handleLabels={[categories[Math.min(categories.length-1,Math.floor(Math.min(...zoomValue)/100*categories.length))]??'',categories[Math.max(0,Math.ceil(Math.max(...zoomValue)/100*categories.length)-1)]??'']} shadowBounds={zoomControlBounds} panEnabled={zoomPan} value={zoomValue} dataShadow={series[0]?.data.map(lineValue)} onChange={setZoomValue}/></foreignObject>:null;
  const [zoomBrushActive,setZoomBrushActive]=useState(false);
  const [zoomHistory,setZoomHistory]=useState<Array<readonly [number,number]>>(()=>dataZoom?[defaultZoom??zoom??[0,100]]:[]);
  const zoomBrush=dataZoom&&zoomBrushActive?{minSelectionSize:zoomMinSelectionSize,selectionStyle:zoomSelectionStyle,selectionShape:zoomSelectionShape,bounds:PLOT,onCancel:()=>setZoomBrushActive(false),onSelect:(range:readonly [number,number])=>{
    const start=Math.min(...zoomValue),span=Math.max(...zoomValue)-start;
    const next:[number,number]=[start+range[0]*span,start+range[1]*span];
    setZoomValue(next);setZoomHistory(history=>[...history,next]);
  }}:undefined;
  const [lineMagic, resolvedToolbox] = useBarMagicState(toolbox, 'line');
  const effectiveStacked=lineMagic.layout==='stack'||lineMagic.layout==='original'&&stacked;
  const chartToolbox = typeof resolvedToolbox === "object" ? {
    ...resolvedToolbox,
    zoomActive:resolvedToolbox.onZoom?resolvedToolbox.zoomActive:zoomBrushActive,
    onZoom:resolvedToolbox.onZoom??(dataZoom?()=>setZoomBrushActive(value=>!value):undefined),
    onZoomBack:resolvedToolbox.onZoomBack??(dataZoom&&!resolvedToolbox.onZoom?()=>{
      const next=zoomHistory.slice(0,-1);setZoomHistory(next);setZoomValue([...(next.at(-1)??[0,100])] as [number,number]);
    }:undefined),
    zoomBackDisabled:resolvedToolbox.onZoomBack?resolvedToolbox.zoomBackDisabled:zoomHistory.length===0,
    dataView: resolvedToolbox.dataView ?? <ChartDataEditor<number|null> allowNull readOnly={resolvedToolbox.dataViewReadOnly} series={series.map(item=>({name:item.name,data:item.data.map(datum=>{const value=lineValue(datum);return Number.isFinite(value)?value:null;})}))} onApply={values=>{
      const next = series.map((item,index)=>({...item,data:item.data.map((datum,j)=>{const value=values[index]![j]??NaN;return typeof datum === "number" ? value : [datum[0],value] as LinePoint;})}));
      setEditableSeries(next); onDataChange?.(next);
    }} />,
    onRestore: () => {
      setEditableSeries(sourceSeries);
      setZoomBrushActive(false);
      setZoomHistory(dataZoom?[defaultZoom??zoom??[0,100]]:[]);
      setZoomValue([...(defaultZoom ?? [0, 100])] as [number, number]);
      localTransfer.reset();
      legend.replace(Object.fromEntries(series.map((item) => [item.name, true])));
      resolvedToolbox.onRestore?.();
    },
  } : resolvedToolbox;
  const startIndex = dataZoom ? Math.floor(Math.min(...zoomValue) / 100 * Math.max(0, categories.length - (zoomIndexMode==='slice'?0:1))) : 0;
  const endIndex = dataZoom ? Math.max(startIndex + 1, Math.ceil(Math.max(...zoomValue) / 100 * categories.length)) : categories.length;
  const visibleCategories = categories.slice(startIndex, endIndex);
  const labelStep=categoryLabelStep(visibleCategories,orientation==='vertical'?PLOT.width:PLOT.height,categoryLabelInterval,orientation==='horizontal',boundaryGap);
  const categoryLabels=visibleCategories.map((label,index)=>index%labelStep?'':label);
  const visibleSeries = series.filter((item) => legend.isSelected(item.name)).map((item) => ({ ...item, stack:lineMagic.layout==='tiled'?undefined:item.stack, data: item.data.slice(startIndex, endIndex) }));
  if (lineMagic.shape==='bar') {
    const switched = <BarChart
      {...props}
      svgOverlay={<>{props.svgOverlay}{inlineZoom}</>}
      brush={zoomBrush??props.brush}
      appearance={appearance}
      grid={grid}
      animationProgress={animationProgress}
      animationDurationUpdate={animationDurationUpdate}
      valueDomain={valueDomain}
      axisLabelFormatter={axisLabelFormatter}
      ref={ref}
      categories={visibleCategories}
      series={series.map((item) => ({ ...item, fillGradient:undefined, stack:lineMagic.layout==='tiled'?undefined:item.stack, data: item.data.slice(startIndex, endIndex).map((datum,index) => {
        const pointStyle=item.pointStyles?.[index+startIndex];
        return { ...pointStyle, value:lineValue(datum), symbolSize:pointStyle?.symbolSize===undefined?undefined:pointStyle.symbolSize/2 };
      }) }))}
      calculable={calculable}
      calculableMode={calculableMode}
      valueTransfer={valueTransfer?{...valueTransfer,props:(row,index)=>valueTransfer.props(row,row<0?index:index+startIndex)}:undefined}
      onTransferError={onTransferError}
      onDataChange={nextBars=>{
        // Update values only: line symbols and tuple coordinates belong to the source mode.
        const next=series.map((item,seriesIndex)=>({...item,data:item.data.map((datum,index)=>{
          if(index<startIndex||index>=endIndex)return datum;
          const nextDatum=nextBars[seriesIndex]?.data[index-startIndex];
          if(nextDatum===undefined)return datum;
          const value=barDatum(nextDatum).value;
          return typeof datum==='number'?value:[datum[0],value] as LinePoint;
        })}));
        setEditableSeries(next);onDataChange?.(next);
      }}
      stacked={effectiveStacked}
      orientation={orientation}
      showLegend={showLegend}
      legendInteractive={legendInteractive}
      legendSelected={legend.selected}
      onLegendSelectionChange={legend.replace}
      valueFormatter={valueFormatter}
      onDataClick={onDataClick}
      palette={palette}
      toolbox={chartToolbox}
    />;
    return dataZoom && !zoomControlBounds ? <div className="sia-chart-with-zoom">{zoomPosition==='top'?<ChartDataZoom panEnabled={zoomPan} value={zoomValue} dataShadow={series[0]?.data.map(lineValue)} showDetail onChange={setZoomValue} />:null}{switched}{zoomPosition==='bottom'?<ChartDataZoom panEnabled={zoomPan} value={zoomValue} dataShadow={series[0]?.data.map(lineValue)} showDetail onChange={setZoomValue} />:null}</div> : switched;
  }
  const stackLayout = layoutBarValues(visibleSeries.map(item=>({stack:item.stack,data:item.data.map(lineValue)})),visibleCategories.length,effectiveStacked);
  const values = effectiveStacked || visibleSeries.some(item=>item.stack) ? stackLayout.bounds : visibleSeries.flatMap((item) => item.data.map(lineValue));
  const domain = valueDomain ?? (valueAxisType === "log" ? logDomain(values,logBase,legacy,logExponentStep) : legacy ? niceChartDomain(values, true, 6, [1, 2, 2.5, 5, 10]) : niceChartDomain(values));
  const valueTicks = valueAxisType === "log" ? logarithmicTicks([domain[0],domain[1]],logBase,logExponentStep) : chartTicks(domain);
  const valueAt = (value: number) => {
    const range = orientation === "vertical"
      ? valueAxisInverse ? [PLOT.y, PLOT_BOTTOM] as const : [PLOT_BOTTOM, PLOT.y] as const
      : valueAxisInverse ? [PLOT.x + PLOT.width, PLOT.x] as const : [PLOT.x, PLOT.x + PLOT.width] as const;
    return valueAxisType === "log" ? logScale(value, [domain[0], domain[1]], range) : linearScale(value, [domain[0], domain[1]], range);
  };
  const valueFromPointer = (event: PointerEvent<SVGGElement>) => {
    const matrix = event.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!matrix) return 0;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const screen = orientation === "vertical" ? point.y : point.x;
    const ratio = orientation === "vertical"
      ? valueAxisInverse ? (screen - PLOT.y) / PLOT.height : (PLOT_BOTTOM - screen) / PLOT.height
      : valueAxisInverse ? (PLOT.x + PLOT.width - screen) / PLOT.width : (screen - PLOT.x) / PLOT.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    return valueAxisType === "log"
      ? logarithmicValueAt(clamped,[domain[0],domain[1]])
      : domain[0] + clamped * (domain[1] - domain[0]);
  };
  const allXValues = visibleSeries.flatMap((item) => item.data.map(lineXValue));
  const xDomain = niceChartDomain(allXValues, false);
  const categoryAt = (index: number) => orientation === "vertical"
    ? PLOT.x + (index+(boundaryGap ? .5 : 0)) / Math.max(1, visibleCategories.length - (boundaryGap ? 0 : 1)) * PLOT.width
    : legacy ? PLOT_BOTTOM - index / Math.max(1, visibleCategories.length - 1) * PLOT.height : PLOT.y + index / Math.max(1, visibleCategories.length - 1) * PLOT.height;
  const pointXAt = (datum: number | LinePoint, index: number) => xAxisType === "category"
    ? categoryAt(index)
    : linearScale(lineXValue(datum, index), [xDomain[0], xDomain[1]], [PLOT.x, PLOT.x + PLOT.width]);
  const content = <SiaChart
    {...props}
    svgOverlay={<>{props.svgOverlay}{inlineZoom}</>}
    brush={zoomBrush??props.brush}
    className={`${props.className ?? ""}${legacy ? " sia-chart--macarons" : ""}`}
    ref={ref}
    palette={palette}
    toolbox={chartToolbox}
    empty={!visibleCategories.length || !series.length}
    ariaLabel={props.ariaLabel ?? "折线图"}
  >
{showLegend ? <ChartLegend symbol={legacy ? "line" : "rect"} x={legendLayout?.x ?? (props.viewBoxSize?.[0] ?? 720) / 2} y={legendLayout?.y ?? (legacy ? 14 : 20)} align={legendLayout?.align} itemGap={legacy ? 10 : 18} items={series.map((item, index) => ({ name: item.name, fillGradient: item.fillGradient, color: getColor(index, item.color, palette), disabled: !legend.isSelected(item.name) }))} selected={legend.selected} onItemClick={legendInteractive ? legend.toggle : undefined} /> : null}
    {legacy && orientation === "vertical" ? <g>
      {valueTicks.map((tick, i, ticks) => <g key={tick}>
        {i < ticks.length - 1 ? <rect x={PLOT.x} y={valueAt(ticks[i + 1]!)} width={PLOT.width} height={Math.abs(valueAt(tick) - valueAt(ticks[i + 1]!))} fill={i % 2 ? "rgba(200,200,200,.1)" : "rgba(250,250,250,.1)"} /> : null}
        <line x1={PLOT.x} x2={PLOT.x + PLOT.width} y1={valueAt(tick)} y2={valueAt(tick)} stroke="#eee" />
        <text x={PLOT.x - 8} y={valueAt(tick) + 4} textAnchor="end" className="sia-chart__axis-label">{axisLabelFormatter?.(tick) ?? tick.toLocaleString("en-US")}</text>
      </g>)}
      {categoryLabels.map((label, i) => <g key={i}>
        {showCategorySplitLine ? <line x1={categoryAt(i)} x2={categoryAt(i)} y1={PLOT.y} y2={PLOT_BOTTOM} stroke="#eee" /> : null}
        <text x={categoryAt(i)} y={PLOT_BOTTOM + 19} textAnchor="middle" className="sia-chart__axis-label">{label}</text>
      </g>)}
      <line x1={PLOT.x} x2={PLOT.x} y1={PLOT.y} y2={PLOT_BOTTOM} stroke="#008acd" strokeWidth={2} />
      <line x1={PLOT.x} x2={PLOT.x + PLOT.width} y1={valueAt(0)} y2={valueAt(0)} stroke="#008acd" strokeWidth={2} />
      {categoryAxisName ? <text x={PLOT.x+PLOT.width+5} y={valueAt(0)+4} fill="#008acd" fontSize={12}>{categoryAxisName}</text> : null}
      {valueAxisName ? <text x={PLOT.x} y={PLOT.y-9} fill="#008acd" fontSize={12}>{valueAxisName}</text> : null}
    </g> : legacy && orientation === "horizontal" ? <g>
      {valueTicks.map((tick,index)=><g key={tick}>
        {index<valueTicks.length-1 ? <rect x={valueAt(tick)} y={PLOT.y} width={Math.abs(valueAt(valueTicks[index+1]!)-valueAt(tick))} height={PLOT.height} fill={index%2 ? "rgba(200,200,200,.1)" : "rgba(250,250,250,.1)"} /> : null}
        <line x1={valueAt(tick)} x2={valueAt(tick)} y1={PLOT.y} y2={PLOT_BOTTOM} stroke="#eee" />
        <text x={valueAt(tick)} y={PLOT_BOTTOM+19} textAnchor="middle" className="sia-chart__axis-label">{axisLabelFormatter?.(tick) ?? tick.toLocaleString("en-US")}</text>
      </g>)}
      {categoryLabels.map((label,index)=><g key={index}><line x1={PLOT.x} x2={PLOT.x+PLOT.width} y1={categoryAt(index)} y2={categoryAt(index)} stroke="#eee" /><text x={PLOT.x-8} y={categoryAt(index)+4} textAnchor="end" className="sia-chart__axis-label">{label}</text></g>)}
      <line x1={PLOT.x} x2={PLOT.x} y1={PLOT.y} y2={PLOT_BOTTOM} stroke="#008acd" strokeWidth={2} />
      <line x1={PLOT.x} x2={PLOT.x+PLOT.width} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM} stroke="#008acd" strokeWidth={2} />
    </g> : orientation === "vertical" && xAxisType === "category" ? <CartesianAxes categories={categoryLabels} domain={domain} /> : orientation === "vertical" ? <g>
      <ChartAxis orientation="left" x={PLOT.x} y={PLOT_BOTTOM} length={PLOT.height} labels={valueTicks.map(formatChartNumber)} gridLength={PLOT.width} />
      <ChartAxis orientation="bottom" x={PLOT.x} y={PLOT_BOTTOM} length={PLOT.width} labels={chartTicks(xDomain).map((value) => xAxisType === "time" ? new Date(value).toLocaleDateString() : formatChartNumber(value))} gridLength={PLOT.height} />
    </g> : <g>
      <ChartAxis orientation="bottom" x={PLOT.x} y={PLOT_BOTTOM} length={PLOT.width} labels={valueTicks.map(formatChartNumber)} gridLength={PLOT.height} />
      {categoryLabels.map((label, index) => <text key={`${label}-${index}`} x={PLOT.x - 10} y={categoryAt(index) + 4} textAnchor="end" className="sia-chart__axis-label">{label}</text>)}
    </g>}
    {tooltipTrigger === "axis" && hoverIndex != null ? <line
      x1={orientation === "vertical" ? categoryAt(hoverIndex) : PLOT.x}
      y1={orientation === "vertical" ? PLOT.y : categoryAt(hoverIndex)}
      x2={orientation === "vertical" ? categoryAt(hoverIndex) : PLOT.x + PLOT.width}
      y2={orientation === "vertical" ? PLOT_BOTTOM : categoryAt(hoverIndex)}
      className="sia-chart__axis-pointer"
    /> : null}
    {tooltipTrigger === "axis" && xAxisType === "category" ? visibleCategories.map((name, index) => {
      const step = (orientation === "vertical" ? PLOT.width : PLOT.height) / Math.max(1, visibleCategories.length - 1);
      const coordinate = categoryAt(index);
      return <ChartMark
        key={`axis-${name}-${index}`}
        label={`${name}，${visibleSeries.map((item) => `${item.name} ${lineValue(item.data[index] ?? 0)}`).join("，")}`}
        tooltip={<><strong>{name}</strong>{visibleSeries.map((item) => <span key={item.name}>{item.name}：{valueFormatter ? valueFormatter(lineValue(item.data[index] ?? 0)) : formatChartNumber(lineValue(item.data[index] ?? 0))}</span>)}</>}
        tooltipPoint={orientation === "vertical" ? [coordinate, PLOT.y + 12] : [PLOT.x + PLOT.width, coordinate]}
        onPointerMove={() => setHoverIndex(index)}
        onPointerLeave={() => setHoverIndex(null)}
      ><rect x={orientation === "vertical" ? coordinate - step / 2 : PLOT.x} y={orientation === "vertical" ? PLOT.y : coordinate - step / 2} width={orientation === "vertical" ? step : PLOT.width} height={orientation === "vertical" ? PLOT.height : step} fill="transparent" /></ChartMark>;
    }) : null}
    {chartLayerOrder(visibleSeries.map((item, seriesIndex) => {
      const previous = stackLayout.rows[seriesIndex]!.map(placement=>placement?.start??0);
      const plotted = item.data.map((datum, index) => {
        const value = lineValue(datum);
        const stackedValue = stackLayout.rows[seriesIndex]?.[index]?.end ?? value;
        if(!Number.isFinite(value))return [pointXAt(datum,index),NaN] as const;
        return orientation === "vertical"
          ? [pointXAt(datum, index), valueAt(stackedValue)] as const
          : [valueAt(stackedValue), categoryAt(index)] as const;
      });
      const color = getColor(series.findIndex((candidate) => candidate.name === item.name), item.color, palette);
      const basePoints = plotted.map((point, index) => orientation === "vertical" ? [
        point[0], (stacked || item.stack) && !legacy ? valueAt(previous[index]!) : valueAt(valueAxisType === "log" ? domain[0] : 0),
      ] as const : [
        (stacked || item.stack) && !legacy ? valueAt(previous[index]!) : valueAt(valueAxisType === "log" ? domain[0] : 0), point[1],
      ] as const);
      return <ChartPointMotion key={item.name} points={item.area ? [...plotted, ...basePoints] : plotted} enabled={props.animation !== false && !dragPoint} duration={props.animationDuration ?? 2000} updateDuration={animationDurationUpdate} progress={animationProgress} horizontal={orientation === "horizontal"}>{(animatedShape) => {
      const animatedPoints = animatedShape.slice(0, plotted.length);
      const animatedBase = animatedShape.slice(plotted.length);
      // Each finite run owns its baseline; missing values must split the area as well as the line.
      const areaRuns:string[]=[];
      let areaStart=0;
      for(let index=0;item.area&&index<=animatedPoints.length;index++){
        if(index<animatedPoints.length&&animatedPoints[index]!.every(Number.isFinite)&&animatedBase[index]!.every(Number.isFinite))continue;
        if(index>areaStart)areaRuns.push(`${linePath(animatedPoints.slice(areaStart,index),item.curve)} ${animatedBase.slice(areaStart,index).reverse().map(point=>`L ${point[0]} ${point[1]}`).join(' ')} Z`);
        areaStart=index+1;
      }
      const areaPath=areaRuns.join(' ');
      const itemValues = item.data.map(lineValue);
      const statistics=barStatistics(itemValues);
      const gradient=item.fillGradient,gradientId=`${linePaintId}-${seriesIndex}`;
      const strokePaint=gradient?`url(#${gradientId})`:color;
      const areaGradient=item.areaGradient,areaGradientId=`${gradientId}-area`;
      const average = itemValues.reduce((sum, value) => sum + value, 0) / Math.max(1, itemValues.length);
      const averageCoordinate = valueAt(average);
      const extremeIndexes = [item.markMin ? itemValues.indexOf(Math.min(...itemValues)) : -1, item.markMax ? itemValues.indexOf(Math.max(...itemValues)) : -1].filter((index) => index >= 0);
      return <g key={`${item.name}-${seriesIndex}`}>
        {gradient?<defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={gradient.start[0]} y1={gradient.start[1]} x2={gradient.end[0]} y2={gradient.end[1]}>{gradient.stops.map((stop,i)=><stop key={i} offset={stop.offset} stopColor={stop.color}/>)}</linearGradient></defs>:null}
        {statistics&&item.statisticLines?<ChartBarStatistics values={statistics} kinds={item.statisticLines} project={valueAt} plot={PLOT} horizontal={orientation==='horizontal'} color={color} gradient={gradient} seriesName={item.name}/>:null}
        {areaGradient?<defs><linearGradient id={areaGradientId} gradientUnits="userSpaceOnUse" x1={areaGradient.start[0]} y1={areaGradient.start[1]} x2={areaGradient.end[0]} y2={areaGradient.end[1]}>{areaGradient.stops.map((stop,i)=><stop key={i} offset={stop.offset} stopColor={stop.color}/>)}</linearGradient></defs>:null}
        {item.area ? <path d={areaPath} fill={areaGradient?`url(#${areaGradientId})`:color} style={areaGradient?{opacity:1}:undefined} className="sia-chart__area" /> : null}
        {item.markAverage ? <g className="sia-chart__mark-line" style={legacy ? { color } : undefined}>
          <line x1={orientation === "vertical" ? PLOT.x : averageCoordinate} y1={orientation === "vertical" ? averageCoordinate : PLOT.y} x2={orientation === "vertical" ? PLOT.x + PLOT.width : averageCoordinate} y2={orientation === "vertical" ? averageCoordinate : PLOT_BOTTOM} stroke={color} />
          {legacy && orientation === "vertical" ? <>
            <circle cx={PLOT.x} cy={averageCoordinate} r={2} fill="#fff" stroke={color} />
            <path d={`M ${PLOT.x + PLOT.width - 8} ${averageCoordinate - 4} L ${PLOT.x + PLOT.width} ${averageCoordinate} L ${PLOT.x + PLOT.width - 8} ${averageCoordinate + 4} Z`} fill={color} />
          </> : null}
          <text x={orientation === "vertical" ? PLOT.x + PLOT.width + (legacy ? 10 : -4) : averageCoordinate + 6} y={orientation === "vertical" ? averageCoordinate + (legacy ? 4 : -6) : PLOT.y + 12} textAnchor={orientation === "vertical" && !legacy ? "end" : "start"}>{legacy ? Number(average.toFixed(2)) : `均值 ${formatChartNumber(average)}`}</text>
        </g> : null}
        {lineSegments(animatedPoints).map((segment,i)=><path key={i} d={linePath(segment, item.curve)} fill="none" stroke={strokePaint} strokeDasharray={item.lineStyle === "dashed" ? "7 5" : item.lineStyle === "dotted" ? "2 4" : undefined} style={{ filter:item.lineShadow?`drop-shadow(${item.lineShadow.offsetX??0}px ${item.lineShadow.offsetY??0}px ${item.lineShadow.blur}px ${item.lineShadow.color})`:undefined, strokeWidth: item.lineWidth ?? (legacy ? 2 : 2.5), animation: "none" }} className="sia-chart__line" />)}
        {extremeIndexes.map((index) => {
          const point = plotted[index]!;
          const value = itemValues[index]!;
          const kind = value === Math.max(...itemValues) ? "最大值" : "最小值";
          return legacy ? <ChartPin key={`${kind}-${index}`} point={point} color={color} label={formatChartNumber(value)} /> : <g key={`${kind}-${index}`} className="sia-chart__mark-point"><circle cx={point[0]} cy={point[1]} r={10} fill={color} /><text x={point[0]} y={point[1] - 15} textAnchor="middle">{kind} {formatChartNumber(value)}</text></g>;
        })}
        {item.markPoints?.map((mark) => <ChartPin key={mark.name} point={[categoryAt(mark.index - startIndex), valueAt(mark.value)]} color={color} label={mark.label ?? formatChartNumber(mark.value)} />)}
        {animatedPoints.map((point, index) => {
          if(!point.every(Number.isFinite)) {
            if(!valueTransfer || Number.isFinite(lineValue(item.data[index] ?? NaN)))return null;
            const coordinate=pointXAt(item.data[index]!,index);
            const previousEmptyOffset=visibleSeries.slice(0,seriesIndex).filter(candidate=>!Number.isFinite(lineValue(candidate.data[index]??NaN))).reduce((offset,candidate)=>offset+(candidate.symbolSize??6)+5,0);
            const shapedEmpty=legacy&&item.symbol!==undefined&&['arrow','heart','droplet','pin','star','star6','image','none'].includes(item.symbol);
            const emptySize=legacy?(item.symbolSize??6):6;
            const baseline=legacy ? (orientation==='vertical'?PLOT.y:PLOT.x)+emptySize+5+previousEmptyOffset : valueAt(valueAxisType==='log'?domain[0]:0);
            if(!Number.isFinite(coordinate)||!Number.isFinite(baseline))return null;
            const x=orientation==='vertical'?coordinate:baseline;
            const y=orientation==='vertical'?baseline:categoryAt(index);
            const emptyKey=`${item.name}:${index}`, highlighted=hoveredLinePoint===emptyKey;
            return <ChartMark key={`empty-${index}`} {...valueTransfer.props(series.findIndex(candidate=>candidate.name===item.name),index+startIndex)} onPointerEnter={()=>setHoveredLinePoint(emptyKey)} onPointerLeave={()=>setHoveredLinePoint(undefined)} onFocus={()=>setHoveredLinePoint(emptyKey)} onBlur={()=>setHoveredLinePoint(undefined)} label={`${item.name}，${visibleCategories[index]}，空槽`} tooltip={<>拖入数值：{item.name} {visibleCategories[index]}</>}>{shapedEmpty?lineSymbol(item.symbol,x,y,emptySize,highlighted?(item.emphasisColor??color):'#ccc',item.symbolImage,highlighted?4:2):<circle cx={x} cy={y} r={legacy?emptySize/2:7} fill={legacy&&!highlighted?'#ccc':'#fff'} stroke={legacy&&!highlighted?'#ccc':color} strokeWidth={legacy?(highlighted?4:2):1} strokeDasharray={legacy?undefined:'2 2'}/>}{legacy&&highlighted&&item.showEmphasisLabels?<text x={x} y={y-emptySize/2-5} textAnchor="middle" className="sia-chart__point-label" style={{fill:item.emphasisColor??color,fontSize:12,fontFamily:"微软雅黑, Arial, Verdana, sans-serif",...item.labelStyle,...item.emphasisLabelStyle}}>-</text>:null}</ChartMark>;
          }
          const value = lineValue(item.data[index] ?? 0);
          const name = visibleCategories[index] ?? `${index + 1}`;
          const pointStyle=item.pointStyles?.[index+startIndex],pointKey=`${item.name}:${index}`;
          const pointColor=(hoveredLinePoint===pointKey?pointStyle?.emphasisColor??item.emphasisColor:undefined)??pointStyle?.color??item.color??strokePaint;
          const pointSize=pointStyle?.symbolSize??item.symbolSize;
          const transferProps = valueTransfer?.props(series.findIndex(candidate=>candidate.name===item.name), index + startIndex);
          const {onPointerMove: transferMove, ...transferHandlers} = transferProps ?? {};
          const emphasized = hoveredLinePoint === pointKey;
          const normalLabel=pointStyle?.showLabel??item.showLabels;
          const showLabel = emphasized ? pointStyle?.showEmphasisLabel??item.showEmphasisLabels??normalLabel : normalLabel;
          const labelPosition=(emphasized?pointStyle?.emphasisLabelPosition:undefined)??pointStyle?.labelPosition;
          const label = (emphasized ? item.emphasisLabelFormatter?.(value, name, index + startIndex) : undefined)
            ?? item.labelFormatter?.(value, name, index + startIndex) ?? formatChartNumber(value);
          const labelStyle: CSSProperties = {
            ...(legacy ? {fill: pointColor} : {}),
            ...item.labelStyle,
            ...pointStyle?.labelStyle,
            ...(emphasized ? {...item.emphasisLabelStyle,...pointStyle?.emphasisLabelStyle} : {}),
          };
          return <ChartMark
            key={`${name}-${index}`}
            className={calculable ? "sia-chart__calculable" : undefined}
            label={`${item.name}，${name}，${formatChartNumber(value)}`}
            tooltip={tooltipTrigger === "item" ? <TooltipValue name={name} series={item.name} value={value} formatter={valueFormatter} /> : undefined}
            tooltipPoint={point}
            onPointerDown={(event) => {
              if (!calculable) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragPoint([series.findIndex((candidate) => candidate.name === item.name), index]);
            }}
            onPointerMove={(event) => {
              setHoveredLinePoint(pointKey);
              if (valueTransfer) { transferMove?.(event); return; }
              const originalSeriesIndex = series.findIndex((candidate) => candidate.name === item.name);
              if (!calculable || dragPoint?.[0] !== originalSeriesIndex || dragPoint[1] !== index) return;
              const nextValue = valueFromPointer(event);
              const next = series.map((candidate, candidateIndex) => candidateIndex !== originalSeriesIndex ? candidate : {
                ...candidate,
                data: candidate.data.map((datum, datumIndex) => datumIndex !== startIndex + index ? datum : typeof datum === "number" ? nextValue : [datum[0], nextValue] as LinePoint),
              });
              setEditableSeries(next);
              onDataChange?.(next);
            }}
            onPointerUp={(event) => {
              if (dragPoint) {
                event.currentTarget.releasePointerCapture(event.pointerId);
                setDragPoint(null);
              } else onDataClick?.({ name, value, seriesName: item.name, data: value, nativeEvent: event });
            }}
            onPointerCancel={() => setDragPoint(null)}
            onPointerLeave={()=>setHoveredLinePoint(undefined)}
            onFocus={()=>setHoveredLinePoint(pointKey)}
            onBlur={()=>setHoveredLinePoint(undefined)}
            {...transferHandlers}
          ><g transform={`rotate(${pointStyle?.symbolRotate??item.symbolRotate??0} ${point[0]} ${point[1]})`}>{item.hollowSymbol && !pointStyle?.symbol ? <circle cx={point[0]} cy={point[1]} r={(pointSize ?? 6) / 2} fill="#fff" stroke={pointColor} strokeWidth={legacy && emphasized ? 4 : 2} /> : lineSymbol(item.showPoints === false ? "none" : pointStyle?.symbol ?? item.symbol, point[0], point[1], pointSize ?? 9, pointColor, pointStyle?.symbolImage??item.symbolImage)}</g>{showLabel ? <text x={point[0]} y={labelPosition==='inside'?point[1]:point[1] - Math.max(10, (pointSize ?? 6) / 2 + 5)} dominantBaseline={labelPosition==='inside'?'middle':undefined} textAnchor="middle" className="sia-chart__point-label" style={labelStyle}>{label}</text> : null}</ChartMark>;
        })}
      </g>;
      }}</ChartPointMotion>;
    }), legacy && stacked)}
    {valueTransfer?.islands.map((island,index)=><ChartMark key={`line-island-${index}`} {...valueTransfer.props(-1,index)} label={`孤岛 ${island.name} ${island.value}`} tooltip={<>{island.seriesName} {island.name}：{island.value}</>}><circle cx={island.x} cy={island.y} r={20} fill="#fff" stroke="#2ec7c9" strokeWidth={2}/><text x={island.x} y={island.y+4} textAnchor="middle" fontSize={11}>{island.value}</text></ChartMark>)}
  </SiaChart>;
  return dataZoom && !zoomControlBounds ? <div className="sia-chart-with-zoom">{zoomPosition==='top'?<ChartDataZoom panEnabled={zoomPan} value={zoomValue} dataShadow={series[0]?.data.map(lineValue)} showDetail onChange={setZoomValue} />:null}{content}{zoomPosition==='bottom'?<ChartDataZoom panEnabled={zoomPan} value={zoomValue} dataShadow={series[0]?.data.map(lineValue)} showDetail onChange={setZoomValue} />:null}</div> : content;
});

function ChartPin({ point, color, label }: { point: readonly [number, number]; color: string; label: string }) {
  const scale = Math.max(1,(label.length*3.2+2)/13);
  return <g transform={`translate(${point[0]} ${point[1]})`} className="sia-chart__pin">
    <path d="M 0 0 C -4 -8 -13 -14 -13 -23 A 13 13 0 1 1 13 -23 C 13 -14 4 -8 0 0 Z" fill={color} transform={`scale(${scale})`} />
    <text y={-23*scale+4} textAnchor="middle" fill="#fff" fontSize={12}>{label}</text>
  </g>;
}

/** 柱形线性渐变的方向及颜色停靠点配置。 */
export interface BarLinearGradient {
  /** 范围起点。 */
  start:readonly [number,number];
  /** 范围终点。 */
  end:readonly [number,number];
  /** 渐变颜色停靠点集合。 */
  stops:readonly {
  /** 相对于默认位置的偏移。 */
  offset:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string}[];
}

/** Bar的单条数据。 */
export interface BarDatum {
  /** Radius used by the corresponding point after switching to a line chart. */
  symbolSize?:number;
  /** 是否显示标签文本。 */
  showLabel?:boolean;
  /** 高亮时是否显示标签。 */
  showEmphasisLabel?:boolean;
  /** 标签文字样式。 */
  labelStyle?:CSSProperties;
  /** 高亮状态的标签样式。 */
  emphasisLabelStyle?:CSSProperties;
  /** 高亮状态的标签位置。 */
  emphasisLabelPosition?:BarDatum['labelPosition'];
  /** 图形填充渐变配置。 */
  fillGradient?:BarLinearGradient;
  /** 高亮状态的填充渐变。 */
  emphasisFillGradient?:BarLinearGradient;
  /** 高亮状态的颜色。 */
  emphasisColor?:string;
  /** 高亮状态的边框颜色。 */
  emphasisBorderColor?:string;
  /** 高亮状态的边框宽度。 */
  emphasisBorderWidth?:number;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 范围起点。 */
  start?: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 透明度，0 为完全透明，1 为完全不透明。 */
  opacity?: number;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: ReactNode;
  /** 是否隐藏此项。 */
  hidden?: boolean;
  /** 边框颜色。 */
  borderColor?: string;
  /** 边框线宽。 */
  borderWidth?: number;
  /** 标签显示位置。 */
  labelPosition?: "top" | "bottom" | "left" | "right" | "inside" | "insideTop" | "insideRight" | "insideLeft";
}

/** Bar的数据系列。 */
export interface BarSeries extends Omit<ChartSeries, "data"> {
  /** 统计标线配置。 */
  statisticLines?:readonly ('average'|'min'|'max')[];
  /** 高亮时是否显示标签集合。 */
  showEmphasisLabels?:boolean;
  /** 标签文字样式。 */
  labelStyle?:CSSProperties;
  /** 高亮状态的标签样式。 */
  emphasisLabelStyle?:CSSProperties;
  /** 高亮状态的标签位置。 */
  emphasisLabelPosition?:BarDatum['labelPosition'];
  /** 高亮标签格式化函数。 */
  emphasisLabelFormatter?:(value:number,category:string,index:number)=>ReactNode;
  /** 图形填充渐变配置。 */
  fillGradient?:BarLinearGradient;
  /** 高亮状态的填充渐变。 */
  emphasisFillGradient?:BarLinearGradient;
  /** 高亮状态的颜色。 */
  emphasisColor?:string;
  /** 高亮状态的边框颜色。 */
  emphasisBorderColor?:string;
  /** 高亮状态的边框宽度。 */
  emphasisBorderWidth?:number;
  /** Share a category slot without stacking values (overlapping comparison bars). */
  overlayGroup?: string;
  /** 用于渲染的数据集合。 */
  data: readonly (number | BarDatum)[];
  /** 图形半径或圆角配置。 */
  radius?: number;
  /** 堆叠分组标识；同标识的数据系列参与同组堆叠。 */
  stack?: string;
  /** 是否显示数据标签。 */
  showLabels?: boolean;
  /** 透明度，0 为完全透明，1 为完全不透明。 */
  opacity?: number;
  /** 柱形宽度。 */
  barWidth?: number;
  /** 是否显示平均值标记。 */
  markAverage?: boolean;
  /** 是否显示最小值标记。 */
  markMin?: boolean;
  /** 是否显示最大值标记。 */
  markMax?: boolean;
  /** 是否将该系列显示在图例中。 */
  showInLegend?: boolean;
  /** 边框颜色。 */
  borderColor?: string;
  /** 边框线宽。 */
  borderWidth?: number;
  /** 标签文字颜色。 */
  labelColor?: string;
  /** 标签文本格式化函数。 */
  labelFormatter?: (value: number, category: string, index: number) => ReactNode;
  /** 标签显示位置。 */
  labelPosition?: BarDatum["labelPosition"];
  /** 需要标记的数据范围。 */
  markRange?: boolean;
  /** 标记点配置集合。 */
  markPoints?: readonly {
  /** 项目在当前集合中的索引，从 0 开始。 */
  index: number;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: string }[];
}

/** 柱状图的属性配置。 */
export interface BarChartProps extends Omit<CartesianChartProps, "series"> {
  /** Shared data/island owner when composed as another Cartesian chart's mode. */
  valueTransfer?:ReturnType<typeof useBarValueTransfer>;
  /**
   * 数据拖拽计算的处理模式。
   * @defaultValue 'resize'
   */
  calculableMode?:'resize'|'transfer';
  /** 图表间数据转移失败时调用。 */
  onTransferError?:(message:string)=>void;
  /** 图例的排列顺序。 */
  legendOrder?: readonly string[];
  /** 图例布局配置。 */
  legendLayout?: {
  /** 横向位置或 X 轴数据值。 */
  x?: number;
  /** 纵向位置或 Y 轴数据值。 */
  y?: number;
  /** 相邻项目的间距。 */
  itemGap?: number;
  /** 默认可见行数 */
  rows?: number };
  /**
   * 不同类目柱组之间的间距。
   * @defaultValue .2
   */
  barCategoryGap?: number;
  /**
   * 数值轴两端增加的留白。
   * @defaultValue 0
   */
  valuePadding?: number;
  /** 绘图区的边距和布局配置。 */
  grid?: {
  /** 距左侧的位置或间距。 */
  left?: number;
  /** 距顶部的位置或间距。 */
  top?: number;
  /** 距右侧的位置或间距。 */
  right?: number;
  /** 距底部的位置或间距。 */
  bottom?: number };
  /**
   * 数值轴所在位置。
   * @defaultValue "bottom"
   */
  valueAxisPosition?: "top" | "bottom";
  /**
   * 图形外观配置。
   * @defaultValue "sia"
   */
  appearance?: "sia" | "macarons";
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /**
   * 数据更新动画的持续时间。
   * @defaultValue 500
   */
  animationDurationUpdate?: number;
  /** 数值轴的数据范围。 */
  valueDomain?: readonly [number, number, number];
  /** 坐标轴标签格式化函数。 */
  axisLabelFormatter?: (value: number) => string;
  /**
   * 是否显示数值轴。
   * @defaultValue true
   */
  showValueAxis?: boolean;
  /**
   * 是否显示类目轴。
   * @defaultValue true
   */
  showCategoryAxis?: boolean;
  /**
   * 是否显示类目轴分隔线。
   * @defaultValue false
   */
  showCategorySplitLine?: boolean;
  /**
   * 提示框按数据项还是坐标轴触发。
   * @defaultValue "item"
   */
  tooltipTrigger?: "item" | "axis";
  /** 提示框内容的格式化函数。 */
  tooltipFormatter?: (name: string, values: readonly {
  /** 名称或字段标识。 */
  name: string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color: string }[]) => ReactNode;
  /** 图表数据系列。 */
  series: readonly BarSeries[];
  /**
   * 是否堆叠展示数据系列。
   * @defaultValue false
   */
  stacked?: boolean;
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "vertical"
   */
  orientation?: "vertical" | "horizontal";
  /**
   * 柱形允许的最小尺寸。
   * @defaultValue 1
   */
  minBarSize?: number;
  /**
   * 是否允许通过拖拽图形修改数据。
   * @defaultValue false
   */
  calculable?: boolean;
  /** 数据被交互修改后调用。 */
  onDataChange?: (series: readonly BarSeries[]) => void;
}

function barDatum(datum: number | BarDatum): BarDatum {
  return typeof datum === "number" ? { value: datum } : datum;
}

/** 柱状图组件。 */
export const BarChart = forwardRef<SiaChartRef, BarChartProps>(function BarChart(
  { valueTransfer:externalValueTransfer, calculableMode='resize',onTransferError,categories, series: sourceSeries, appearance = "sia", animationProgress, animationDurationUpdate = 500, valueDomain, axisLabelFormatter, grid, valueAxisPosition = "bottom", showValueAxis = true, showCategoryAxis = true, showCategorySplitLine = false, tooltipTrigger = "item", tooltipFormatter, stacked = false, orientation = "vertical", minBarSize = 1, calculable = false, onDataChange, showLegend = true, legendOrder, legendLayout, barCategoryGap = .2, valuePadding = 0, legendInteractive = true, legendSelected, onLegendSelectionChange, valueFormatter, onDataClick, palette, toolbox, ...props },
  ref,
) {
  const [editableSeries, setEditableSeries] = useState<readonly BarSeries[]>(sourceSeries);
  const [dragBar, setDragBar] = useState<readonly [number, number] | null>(null);
  const [hoveredBar,setHoveredBar]=useState<string>();
  const barPaintId=useId().replaceAll(':','');
  const localTransfer=useBarValueTransfer(editableSeries,sourceSeries,categories,calculable&&calculableMode==='transfer'&&!externalValueTransfer,next=>{setEditableSeries(next);onDataChange?.(next);},onTransferError);
  const transfer=externalValueTransfer??localTransfer;
  useEffect(() => setEditableSeries(sourceSeries), [sourceSeries]);
  const series = externalValueTransfer?sourceSeries:editableSeries;
  const legacy = appearance === "macarons";
  const PLOT = legacy ? { x: grid?.left ?? 80, y: grid?.top ?? 60, width: (props.viewBoxSize?.[0] ?? 720) - (grid?.left ?? 80) - (grid?.right ?? 80), height: (props.viewBoxSize?.[1] ?? 360) - (grid?.top ?? 60) - (grid?.bottom ?? 70) } : { x: 62, y: 48, width: 628, height: 250 };
  const PLOT_BOTTOM = PLOT.y + PLOT.height;
  const legend = useLegendSelection(series.map((item) => item.name), legendSelected, onLegendSelectionChange);
  const [barMagic, resolvedToolbox] = useBarMagicState(toolbox);
  const chartToolbox = typeof resolvedToolbox === "object" ? {
    ...resolvedToolbox,
    dataView: resolvedToolbox.dataView ?? <ChartDataEditor<number|null> allowNull readOnly={resolvedToolbox.dataViewReadOnly} series={series.map(item=>({name:item.name,data:item.data.map(datum=>{const d=barDatum(datum);return d.hidden||!Number.isFinite(d.value)?null:d.value;})}))} onApply={values=>{
      const next = series.map((item,index)=>({...item,data:item.data.map((datum,j)=>{const value=values[index]![j]!;return value===null?{...barDatum(datum),value:NaN,hidden:true}:typeof datum === "number"?value:{...datum,value,hidden:false};})}));
      setEditableSeries(next); onDataChange?.(next);
    }} />,
    onRestore: () => {
      setEditableSeries(sourceSeries);
      transfer.reset();
      legend.replace(Object.fromEntries(series.map((item) => [item.name, true])));
      resolvedToolbox.onRestore?.();
    },
  } : resolvedToolbox;
  if (barMagic.shape==='line') return <LineChart
    {...props}
    valueTransfer={calculable&&calculableMode==='transfer'?transfer:undefined}
    grid={grid}
    boundaryGap
    ref={ref}
    categories={categories}
    appearance={appearance}
    animationProgress={animationProgress}
    animationDurationUpdate={animationDurationUpdate}
    series={series.map((item) => ({ ...item, curve:appearance==='macarons'?'smooth':undefined, hollowSymbol:true, symbolSize:6, pointStyles:item.data.map(d=>{const p=barDatum(d);return {labelPosition:p.labelPosition==='inside'?'inside' as const:undefined,color:p.color,emphasisColor:p.emphasisColor,symbolSize:p.symbolSize===undefined?undefined:p.symbolSize*2};}), stack:barMagic.layout==='tiled'?undefined:item.stack, markPoints:item.markPoints?.map((mark,index)=>({...mark,name:mark.label??String(index)})), data: item.data.map((datum) => barDatum(datum).value) }))}
    stacked={barMagic.layout==='stack'||barMagic.layout==='original'&&stacked}
    orientation={orientation}
    showLegend={showLegend}
    legendInteractive={legendInteractive}
    legendSelected={legend.selected}
    onLegendSelectionChange={legend.replace}
    valueFormatter={valueFormatter}
    onDataClick={onDataClick}
    palette={palette}
    toolbox={chartToolbox}
  />;
  const activeSeries = series.filter((item) => legend.isSelected(item.name));
  const layout = barMagicLayout(activeSeries, categories.length, barMagic.layout, stacked);
  const maximumValue = Math.max(...layout.bounds);
  const domain = valueDomain ?? niceChartDomain([...layout.bounds,maximumValue+(maximumValue-Math.min(...layout.bounds))*valuePadding], true, legacy ? 6 : 5, legacy ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]);
  const ticks = chartTicks(domain);
  const visualGroups = layout.groups;
  const band = (orientation === "vertical" ? PLOT.width : PLOT.height) / Math.max(1, categories.length);
  const explicitWidths = visualGroups.map((_,groupIndex)=>activeSeries.find((item,seriesIndex)=>item.barWidth != null && layout.rows[seriesIndex]?.some(placement=>placement?.group===groupIndex))?.barWidth);
  const flexibleCount = explicitWidths.filter(width=>width==null).length;
  const unitWidth = Math.max(1, (band * (1-Math.max(0,Math.min(.95,barCategoryGap))) - explicitWidths.reduce<number>((sum,width)=>sum+(width??0),0)) / Math.max(1,flexibleCount + .3*Math.max(0,visualGroups.length-1)));
  const groupWidths = explicitWidths.map(width=>width??unitWidth);
  const gap = unitWidth*.3;
  const occupied = groupWidths.reduce((sum,width)=>sum+width,0)+gap*Math.max(0,groupWidths.length-1);
  const labelStep = legacy && orientation === "vertical" ? Math.max(1,Math.ceil(Math.max(...categories.map(name=>Array.from(name).reduce((width,char)=>width+(char.charCodeAt(0)>255?12:7),0)))/band)) : 1;
  const valueAt = (value: number) => linearScale(value, [domain[0], domain[1]], orientation === "vertical" ? [PLOT_BOTTOM, PLOT.y] : [PLOT.x, PLOT.x + PLOT.width]);
  const categoryAt = (index: number) => orientation === "vertical" ? PLOT.x + (index + .5) * band : legacy ? PLOT_BOTTOM - (index + .5) * band : PLOT.y + (index + .5) * band;
  const invisible = (color?: string) => color === "transparent" || color?.replaceAll(" ","") === "rgba(0,0,0,0)";
  const axisTooltip = (index: number) => {
    const rows = activeSeries.filter(item=>!invisible(item.color) && !barDatum(item.data[index]??0).hidden).map(item=>({name:item.name,value:barDatum(item.data[index]??0).value,color:barDatum(item.data[index]??0).color??item.color??getColor(series.indexOf(item),undefined,palette)}));
    return tooltipFormatter?.(categories[index]!,rows) ?? <><strong>{categories[index]}</strong>{rows.map((row,i)=><span key={i}>{row.name}：{valueFormatter?.(row.value) ?? row.value.toLocaleString("en-US")}</span>)}</>;
  };
  return <SiaChart {...props} className={`${props.className ?? ""}${legacy ? " sia-chart--macarons" : ""}`} ref={ref} palette={palette} toolbox={chartToolbox} empty={!categories.length || !series.length} ariaLabel={props.ariaLabel ?? "柱状图"}>
    {showLegend ? Array.from({length:Math.max(1,legendLayout?.rows??1)},(_,row)=>{
      const items=series.map((item, index) => ({ name: item.name, fillGradient: item.fillGradient, color: getColor(index, item.color, palette), borderColor:item.borderColor, disabled: !legend.isSelected(item.name) })).filter((_,index)=>series[index]!.showInLegend !== false).filter((item,index,all)=>all.findIndex(other=>other.name===item.name)===index).sort((a,b)=>legendOrder ? legendOrder.indexOf(a.name)-legendOrder.indexOf(b.name) : 0);
      const rowSize=Math.ceil(items.length/Math.max(1,legendLayout?.rows??1));
      return <ChartLegend key={row} x={legendLayout?.x ?? (props.viewBoxSize?.[0] ?? 720)/2} y={(legendLayout?.y ?? (legacy?14:20))+row*20} itemGap={legendLayout?.itemGap ?? (legacy?10:18)} items={items.slice(row*rowSize,(row+1)*rowSize)} selected={legend.selected} onItemClick={legendInteractive?legend.toggle:undefined} />;
    }) : null}
    {legacy ? <g>
      {showValueAxis ? ticks.map((tick,index) => <g key={tick}>
        {orientation === "vertical" ? <>
          {index < ticks.length-1 ? <rect x={PLOT.x} y={valueAt(ticks[index+1]!)} width={PLOT.width} height={Math.abs(valueAt(tick)-valueAt(ticks[index+1]!))} fill={index%2 ? "rgba(200,200,200,.1)" : "rgba(250,250,250,.1)"} /> : null}
          <line x1={PLOT.x} x2={PLOT.x+PLOT.width} y1={valueAt(tick)} y2={valueAt(tick)} stroke="#eee" />
          <text x={PLOT.x-8} y={valueAt(tick)+4} textAnchor="end" className="sia-chart__axis-label">{axisLabelFormatter?.(tick) ?? tick.toLocaleString("en-US")}</text>
        </> : <>
          {index < ticks.length-1 ? <rect x={valueAt(tick)} y={PLOT.y} width={Math.abs(valueAt(ticks[index+1]!)-valueAt(tick))} height={PLOT.height} fill={index%2 ? "rgba(200,200,200,.1)" : "rgba(250,250,250,.1)"} /> : null}
          <line x1={valueAt(tick)} x2={valueAt(tick)} y1={PLOT.y} y2={PLOT_BOTTOM} stroke="#eee" /><text x={valueAt(tick)} y={valueAxisPosition === "top" ? PLOT.y-12 : PLOT_BOTTOM+19} textAnchor="middle" className="sia-chart__axis-label">{axisLabelFormatter?.(tick) ?? tick.toLocaleString("en-US")}</text></>}
      </g>) : null}
      {showCategorySplitLine && orientation === "vertical" ? categories.map((_,index)=>index%labelStep ? null : <line key={index} x1={PLOT.x+index*band} x2={PLOT.x+index*band} y1={PLOT.y} y2={PLOT_BOTTOM} stroke="#eee" />) : null}
      {showCategoryAxis ? categories.map((name,index)=>index%labelStep ? null : <text key={index} x={orientation === "vertical" ? categoryAt(index) : PLOT.x-8} y={orientation === "vertical" ? PLOT_BOTTOM+19 : categoryAt(index)+4} textAnchor={orientation === "vertical" ? "middle" : "end"} className="sia-chart__axis-label">{name}</text>) : null}
      {showValueAxis ? <line x1={PLOT.x} x2={orientation === "vertical" ? PLOT.x : PLOT.x+PLOT.width} y1={orientation === "vertical" || valueAxisPosition === "top" ? PLOT.y : PLOT_BOTTOM} y2={orientation === "horizontal" && valueAxisPosition === "top" ? PLOT.y : PLOT_BOTTOM} stroke="#008acd" strokeWidth={2} /> : null}
      {showCategoryAxis ? <line x1={orientation === "vertical" ? PLOT.x : valueAt(0)} x2={orientation === "vertical" ? PLOT.x+PLOT.width : valueAt(0)} y1={orientation === "vertical" ? valueAt(0) : PLOT.y} y2={orientation === "vertical" ? valueAt(0) : PLOT_BOTTOM} stroke="#008acd" strokeWidth={2} /> : null}
    </g> : orientation === "vertical" ? <CartesianAxes categories={categories} domain={domain} band /> : <g>
      <ChartAxis orientation="bottom" x={PLOT.x} y={PLOT_BOTTOM} length={PLOT.width} labels={ticks.map(formatChartNumber)} gridLength={PLOT.height} />
      {categories.map((name, index) => <text key={`${name}-${index}`} x={PLOT.x - 10} y={PLOT.y + (index + 0.5) * band + 4} textAnchor="end" className="sia-chart__axis-label">{name}</text>)}
    </g>}
    {tooltipTrigger === "axis" ? categories.map((name,index)=><ChartMark key={`axis-${index}`} label={`${name}数据`} tooltip={axisTooltip(index)}><rect x={orientation === "vertical" ? categoryAt(index)-band/2 : PLOT.x} y={orientation === "vertical" ? PLOT.y : categoryAt(index)-band/2} width={orientation === "vertical" ? band : PLOT.width} height={orientation === "vertical" ? PLOT.height : band} fill="transparent" /></ChartMark>) : null}
    {activeSeries.map((item, seriesIndex) => {
      const originalSeriesIndex = series.indexOf(item);
      const seriesColor = getColor(originalSeriesIndex, item.color, palette);
      const seriesValues = item.data.map((datum) => barDatum(datum).value);
      const statistics=barStatistics(item.data);
      const average = seriesValues.reduce((sum, value) => sum + value, 0) / Math.max(1, seriesValues.length);
      const averagePosition = linearScale(average, [domain[0], domain[1]], orientation === "vertical" ? [PLOT_BOTTOM, PLOT.y] : [PLOT.x, PLOT.x + PLOT.width]);
      const groupIndex = layout.rows[seriesIndex]?.find(Boolean)?.group ?? 0;
      const groupCenter = (index: number) => categoryAt(index)-band/2+(band-occupied)/2+groupWidths.slice(0,groupIndex).reduce((sum,width)=>sum+width,0)+groupIndex*gap+groupWidths[groupIndex]!/2;
      const minimumIndex = seriesValues.indexOf(Math.min(...seriesValues));
      const maximumIndex = seriesValues.indexOf(Math.max(...seriesValues));
      return <g key={`${item.name}-${seriesIndex}`}>
        {statistics&&item.statisticLines?<ChartBarStatistics values={statistics} kinds={item.statisticLines} project={valueAt} plot={PLOT} horizontal={orientation==='horizontal'} color={seriesColor} gradient={item.fillGradient} seriesName={item.name}/>:null}
        {item.markAverage ? <g className="sia-chart__mark-line" style={legacy ? {color:seriesColor} : undefined}><line x1={orientation === "vertical" ? PLOT.x : averagePosition} y1={orientation === "vertical" ? averagePosition : PLOT.y} x2={orientation === "vertical" ? PLOT.x + PLOT.width : averagePosition} y2={orientation === "vertical" ? averagePosition : PLOT_BOTTOM} stroke={seriesColor} /><text x={orientation === "vertical" ? PLOT.x + PLOT.width + (legacy ? 8 : -4) : averagePosition + 6} y={orientation === "vertical" ? averagePosition + (legacy ? 4 : -6) : PLOT.y + 12} textAnchor={orientation === "vertical" && !legacy ? "end" : "start"}>{legacy ? Number(average.toFixed(2)) : `均值 ${formatChartNumber(average)}`}</text></g> : null}
        {item.markRange ? <line className="sia-chart__range-line" x1={orientation === "vertical" ? groupCenter(minimumIndex) : valueAt(seriesValues[minimumIndex]!)} y1={orientation === "vertical" ? valueAt(seriesValues[minimumIndex]!) : groupCenter(minimumIndex)} x2={orientation === "vertical" ? groupCenter(maximumIndex) : valueAt(seriesValues[maximumIndex]!)} y2={orientation === "vertical" ? valueAt(seriesValues[maximumIndex]!) : groupCenter(maximumIndex)} stroke={seriesColor} strokeDasharray="7 7" /> : null}
        {item.markPoints?.map((mark,index)=><ChartPin key={index} point={orientation === "vertical" ? [groupCenter(mark.index),valueAt(mark.value)] : [valueAt(mark.value),groupCenter(mark.index)]} color={seriesColor} label={mark.label ?? String(mark.value)} />)}
        {categories.map((name, index) => {
          const datum = barDatum(item.data[index] ?? 0);
          const value = datum.value;
          const placement = layout.rows[seriesIndex]?.[index];
          if (!placement) {
            if(!calculable||calculableMode!=='transfer')return null;
            const slotGroup=layout.rows[seriesIndex]?.find(Boolean)?.group??0;
            const stackTop=Math.max(0,...layout.rows.map(row=>row[index]).filter(point=>point?.group===slotGroup).map(point=>point!.end));
            const slot=groupCenter(index),zero=valueAt(stackTop),slotWidth=Math.max(8,groupWidths[slotGroup]??10);
            return <ChartMark key={`${name}-${index}`} {...transfer.props(originalSeriesIndex,index)} label={`${item.name}，${name}，空槽`} tooltip={<>{item.name} {name}：空槽</>}><rect x={orientation==='vertical'?slot-slotWidth/2:zero-7} y={orientation==='vertical'?zero-14:slot-slotWidth/2} width={orientation==='vertical'?slotWidth:14} height={orientation==='vertical'?14:slotWidth} fill="transparent" stroke={seriesColor} strokeDasharray="3 2"/></ChartMark>;
          }
          const previous = placement.start;
          const groupIndex = placement.group;
          const seriesBand = groupWidths[groupIndex]!;
          const cross = (band-occupied)/2 + groupWidths.slice(0,groupIndex).reduce((sum,width)=>sum+width,0) + groupIndex*gap;
          const start = linearScale(previous, [domain[0], domain[1]], orientation === "vertical" ? [PLOT_BOTTOM, PLOT.y] : [PLOT.x, PLOT.x + PLOT.width]);
          const end = linearScale(previous + value, [domain[0], domain[1]], orientation === "vertical" ? [PLOT_BOTTOM, PLOT.y] : [PLOT.x, PLOT.x + PLOT.width]);
          const x = orientation === "vertical" ? PLOT.x + index * band + cross : Math.min(start, end);
          const y = orientation === "vertical" ? Math.min(start, end) : legacy ? categoryAt(index) + band / 2 - cross - seriesBand : categoryAt(index) - band / 2 + cross;
          const width = orientation === "vertical" ? seriesBand : Math.max(minBarSize, Math.abs(end - start));
          const height = orientation === "vertical" ? Math.max(minBarSize, Math.abs(end - start)) : seriesBand;
          const hoverKey=`${originalSeriesIndex}:${index}`,emphasized=hoveredBar===hoverKey;
          const normalGradient=datum.fillGradient??(datum.color===undefined?item.fillGradient:undefined);
          const gradient=emphasized?(datum.emphasisFillGradient??(datum.emphasisColor!==undefined?undefined:item.emphasisFillGradient??(item.emphasisColor!==undefined?undefined:normalGradient))):normalGradient;
          const gradientId=`${barPaintId}-${originalSeriesIndex}-${index}`;
          const color = (emphasized?datum.emphasisColor??item.emphasisColor:undefined)??datum.color??seriesColor;
          const resolvedBorderColor=(emphasized?datum.emphasisBorderColor??item.emphasisBorderColor:undefined)??datum.borderColor??item.borderColor;
          const extreme = (item.markMin && value === Math.min(...seriesValues)) || (item.markMax && value === Math.max(...seriesValues));
          return <ChartPointMotion key={`${name}-${index}`} points={[[0,start],[0,end]]} enabled={props.animation !== false && !dragBar} duration={props.animationDuration ?? 2000} updateDuration={animationDurationUpdate} progress={animationProgress}>{(motion) => {
          const animatedStart = motion[0]![1];
          const animatedEnd = motion[1]![1];
          const animatedX = orientation === "vertical" ? x : Math.min(animatedStart, animatedEnd);
          const animatedY = orientation === "vertical" ? Math.min(animatedStart, animatedEnd) : y;
          const animatedWidth = orientation === "vertical" ? width : Math.abs(animatedEnd-animatedStart);
          const animatedHeight = orientation === "vertical" ? Math.abs(animatedEnd-animatedStart) : height;
          const labelPosition = (emphasized?datum.emphasisLabelPosition??item.emphasisLabelPosition:undefined)??datum.labelPosition ?? item.labelPosition ?? (orientation === "vertical" ? "top" : "right");
          const {onPointerMove:transferMove,...transferProps}=transfer.props(originalSeriesIndex,index);
          const normalShowLabel=datum.showLabel??(item.showLabels||datum.label!=null);
          const showLabel=emphasized?(datum.showEmphasisLabel??item.showEmphasisLabels??normalShowLabel):normalShowLabel;
          const inside = labelPosition.startsWith("inside");
          const labelX = labelPosition === "left" ? animatedX-6 : labelPosition === "right" ? animatedX+animatedWidth+6 : labelPosition === "insideRight" ? animatedX+animatedWidth-6 : labelPosition === "insideLeft" ? animatedX+6 : animatedX+animatedWidth/2;
          const borderWidth = Math.min((emphasized?datum.emphasisBorderWidth??item.emphasisBorderWidth:undefined)??datum.borderWidth??item.borderWidth??0,animatedWidth,animatedHeight);
          const labelY = labelPosition === "top" ? animatedY-6 : labelPosition === "bottom" ? animatedY+animatedHeight+14 : labelPosition === "insideTop" ? animatedY+14 : animatedY+animatedHeight/2+4;
          const label = (emphasized?item.emphasisLabelFormatter?.(value,name,index):undefined)??item.labelFormatter?.(value,name,index) ?? datum.label ?? (legacy ? value.toLocaleString("en-US") : formatChartNumber(value));
          return <ChartMark
            key={`${name}-${index}`}
            className={calculable ? "sia-chart__calculable" : undefined}
            label={`${item.name}，${name}，${formatChartNumber(value)}`}
            style={invisible(color) ? {pointerEvents:"none"} : undefined}
            tooltip={tooltipTrigger === "axis" ? axisTooltip(index) : <TooltipValue name={name} series={item.name} value={value} formatter={valueFormatter} />}
            tooltipPoint={[x + width / 2, y]}
            onPointerDown={(event) => {
              if (!calculable) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragBar([series.indexOf(item), index]);
            }}
            onPointerMove={(event) => {
              setHoveredBar(hoverKey);
              if(calculable&&calculableMode==='transfer'){transferMove?.(event);return;}
              const originalSeriesIndex = series.indexOf(item);
              if (!calculable || dragBar?.[0] !== originalSeriesIndex || dragBar[1] !== index) return;
              const matrix = event.currentTarget.ownerSVGElement?.getScreenCTM();
              if (!matrix) return;
              const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
              const screen = orientation === "vertical" ? point.y : point.x;
              const ratio = orientation === "vertical" ? (PLOT_BOTTOM - screen) / PLOT.height : (screen - PLOT.x) / PLOT.width;
              const absoluteValue = domain[0] + Math.max(0, Math.min(1, ratio)) * (domain[1] - domain[0]);
              const nextValue = absoluteValue - previous;
              const next = series.map((candidate, candidateIndex) => candidateIndex !== originalSeriesIndex ? candidate : {
                ...candidate,
                data: candidate.data.map((candidateDatum, datumIndex) => datumIndex !== index ? candidateDatum : typeof candidateDatum === "number" ? nextValue : { ...candidateDatum, value: nextValue }),
              });
              setEditableSeries(next);
              onDataChange?.(next);
            }}
            onPointerUp={(event) => {
              if (dragBar) {
                event.currentTarget.releasePointerCapture(event.pointerId);
                setDragBar(null);
              } else onDataClick?.({ name, value, seriesName: item.name, data: value, nativeEvent: event });
            }}
            onPointerCancel={() => setDragBar(null)}
            onPointerLeave={()=>setHoveredBar(undefined)}
            onFocus={()=>setHoveredBar(hoverKey)}
            onBlur={()=>setHoveredBar(undefined)}
            {...transferProps}
          >{gradient?<defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={gradient.start[0]} y1={gradient.start[1]} x2={gradient.end[0]} y2={gradient.end[1]}>{gradient.stops.map((stop,i)=><stop key={i} offset={stop.offset} stopColor={stop.color}/>)}</linearGradient></defs>:null}<rect x={animatedX+borderWidth/2} y={animatedY+borderWidth/2} width={Math.max(0, animatedWidth-borderWidth)} height={Math.max(0, animatedHeight-borderWidth)} rx={item.radius ?? (legacy ? 5 : 4)} fill={gradient?`url(#${gradientId})`:color} stroke={resolvedBorderColor} strokeWidth={borderWidth} opacity={datum.opacity ?? item.opacity} style={{animation:"none",transition:"none"}} className="sia-chart__bar" />
            {showLabel ? <text x={labelX} y={labelY} textAnchor={labelPosition === "left" || labelPosition === "insideRight" ? "end" : labelPosition === "right" || labelPosition === "insideLeft" ? "start" : "middle"} style={{fill:item.labelColor ?? (inside ? "#fff" : legacy ? gradient?`url(#${gradientId})`:color : undefined),...item.labelStyle,...datum.labelStyle,...(emphasized?{...item.emphasisLabelStyle,...datum.emphasisLabelStyle}:undefined)}} className="sia-chart__point-label">{typeof label === "string" && label.includes("\n") ? label.split("\n").map((line,i,lines)=><tspan key={i} x={labelX} dy={i===0?-(lines.length-1)*14:14}>{line || " "}</tspan>) : label}</text> : null}
            {extreme ? legacy ? <ChartPin point={orientation === "vertical" ? [x+width/2,y] : [x+width,y+height/2]} color={color} label={String(value)} /> : <circle cx={orientation === "vertical" ? x + width / 2 : x + width} cy={orientation === "vertical" ? y : y + height / 2} r={5} fill={color} stroke="var(--sia-color-surface)" strokeWidth={2} /> : null}
          </ChartMark>;
          }}</ChartPointMotion>;
        })}
      </g>;
    })}
    {calculable&&calculableMode==='transfer'?transfer.islands.map((island,index)=><ChartMark key={`bar-island-${index}`} {...transfer.props(-1,index)} label={`孤岛 ${island.name} ${island.value}`} tooltip={<>{island.seriesName} {island.name}：{island.value}</>}><circle cx={island.x} cy={island.y} r={20} fill="#fff" stroke="#2ec7c9" strokeWidth={2}/><text x={island.x} y={island.y+4} textAnchor="middle" fontSize={11}>{island.value}</text></ChartMark>):null}
  </SiaChart>;
});

/** Scatter的单条数据。 */
export interface ScatterDatum {
  /** 高亮状态的颜色。 */
  emphasisColor?:string;
  /** 高亮状态的边框宽度。 */
  emphasisBorderWidth?:number;
  /** 符号填充颜色。 */
  symbolFill?:string;
  /** 是否显示标签文本。 */
  showLabel?:boolean;
  /** 高亮时是否显示标签。 */
  showEmphasisLabel?:boolean;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?:ReactNode;
  /** 标签文本格式化函数。 */
  labelFormatter?:(item:ScatterDatum)=>ReactNode;
  /** 标签文字样式。 */
  labelStyle?:CSSProperties;
  /** 数据符号使用的图片。 */
  symbolImage?:string;
  /** 数据符号旋转角度。 */
  symbolRotate?:number;
  /** 边框线宽。 */
  borderWidth?:number;
  /** Optional third data dimension, independent of the rendered symbol radius. */
  value?: number;
  /** 名称或字段标识。 */
  name?: string;
  /** 横向位置或 X 轴数据值。 */
  x: number;
  /** 纵向位置或 Y 轴数据值。 */
  y: number;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 所属类目或分组。 */
  category?: string;
  /** 数据点或节点使用的图形符号。 */
  symbol?: "circle" | "square" | "diamond" | "emptyCircle" | "emptyTriangle" | "image";
}

/** 散点数值到颜色和尺寸的视觉映射配置。 */
export interface ScatterVisualMap {
  /** 是否允许通过拖拽图形修改数据。 */
  calculable?:boolean;
  /** 组件的水平或垂直排列方向。 */
  orientation?:'horizontal'|'vertical';
  /** 是否允许选中项目。 */
  selectable?:boolean;
  /** 参与统计或映射的数据维度。 */
  dimension: "x" | "y" | "size" | "value";
  /** 分段视觉映射的区间配置。 */
  pieces?: readonly {
  /** 允许的最小值。 */
  min:number;
  /** 允许的最大值。 */
  max:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?:string}[];
  /** 横向位置或 X 轴数据值。 */
  x?:number;
  /** 纵向位置或 Y 轴数据值。 */
  y?:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?:number;
  /** 允许的最小值。 */
  min?: number;
  /** 允许的最大值。 */
  max?: number;
  /** 可选颜色或颜色序列。 */
  colors?: readonly [string, string];
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: string;
}

/** 散点图的属性配置。 */
export interface ScatterChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /**
   * 数据符号动画配置。
   * @defaultValue false
   */
  symbolAnimation?: boolean;
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /**
   * 数据更新动画的持续时间。
   * @defaultValue 500
   */
  animationDurationUpdate?: number;
  /**
   * 统计点标记配置。
   * @defaultValue []
   */
  statisticPoints?:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 参与统计或映射的数据维度。 */
  dimension:'x'|'y';
  /** 补全项或节点的类别。 */
  kind:'min'|'max';
  /** 所属类目或分组。 */
  category?:string;
  /** 数据点或节点使用的图形符号。 */
  symbol?:'pin'|'arrow';
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 边框颜色。 */
  borderColor?:string;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?:number}[];
  /**
   * 统计标线配置。
   * @defaultValue []
   */
  statisticLines?:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 参与统计或映射的数据维度。 */
  dimension:'x'|'y';
  /** 所属类目或分组。 */
  category?:string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string}[];
  /** Fixed coordinate annotations, separate from editable scatter values. */
  annotations?:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value:number;
  /** 所属类目或分组。 */
  category?:string;
  /** 图形半径或圆角配置。 */
  radius?:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string}[];
  /**
   * 是否显示 X 轴。
   * @defaultValue true
   */
  showXAxis?:boolean;
  /**
   * 是否显示 X 轴分隔线。
   * @defaultValue true
   */
  showXSplitLine?:boolean;
  /**
   * 是否显示 Y 轴分隔线。
   * @defaultValue true
   */
  showYSplitLine?:boolean;
  /** 提示框内容的格式化函数。 */
  tooltipFormatter?:(item:ScatterDatum)=>ReactNode;
  /** 标记颜色。 */
  markColor?: string;
  /** X 轴的数据范围。 */
  xDomain?: readonly [number,number,number];
  /** Y 轴的数据范围。 */
  yDomain?: readonly [number,number,number];
  /**
   * 是否显示数据点标签。
   * @defaultValue false
   */
  showPointLabels?: boolean;
  /**
   * Y 轴所在位置。
   * @defaultValue 'left'
   */
  yAxisPosition?:'left'|'right';
  /** X 轴类目集合。 */
  xCategories?: readonly number[];
  /** X 轴数值的格式化函数。 */
  xFormatter?: (value:number)=>string;
  /**
   * 十字辅助线配置。
   * @defaultValue false
   */
  crosshair?: boolean;
  /** Pin extrema and value-only mean labels used by legacy reference charts. */
  markAppearance?: 'label' | 'pin';
  /**
   * X 轴分段数量。
   * @defaultValue 5
   */
  xSplitNumber?: number;
  /**
   * Y 轴分段数量。
   * @defaultValue 5
   */
  ySplitNumber?: number;
  /** 按数据点计算显示尺寸的函数。 */
  symbolSize?: (item: ScatterDatum) => number;
  /**
   * 是否按类目绘制统计标记。
   * @defaultValue false
   */
  markByCategory?: boolean;
  /**
   * X 轴数值单位。
   * @defaultValue ''
   */
  xUnit?: string;
  /**
   * Y 轴数值单位。
   * @defaultValue ''
   */
  yUnit?: string;
  /**
   * 符号最小半径。
   * @defaultValue 5
   */
  minSymbolRadius?: number;
  /** 绘图区边界。 */
  plotBounds?: {
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
  /** 用于渲染的数据集合。 */
  data: readonly ScatterDatum[];
  /** X 轴标题。 */
  xLabel?: string;
  /** Y 轴标题。 */
  yLabel?: string;
  /**
   * X 轴类型。
   * @defaultValue "value"
   */
  xAxisType?: "value" | "time";
  /**
   * 是否显示图例。
   * @defaultValue true
   */
  showLegend?: boolean;
  /**
   * 是否允许通过图例切换系列显示。
   * @defaultValue true
   */
  legendInteractive?: boolean;
  /** 图例项目的选中状态。 */
  legendSelected?: Readonly<Record<string, boolean>>;
  /** 图例选中状态变化时调用。 */
  onLegendSelectionChange?: (selected: Record<string, boolean>) => void;
  /**
   * 数据区域缩放配置。
   * @defaultValue false
   */
  dataZoom?: boolean;
  /** 缩放级别或缩放范围。 */
  zoom?: readonly [number, number];
  /** 初始缩放范围或缩放级别。 */
  defaultZoom?: readonly [number, number];
  /** 缩放范围变化时调用。 */
  onZoomChange?: (value: [number, number]) => void;
  /** 数据到颜色、大小等视觉通道的映射配置。 */
  visualMap?: ScatterVisualMap;
  /** 是否显示平均值标记。 */
  markAverage?: "x" | "y" | "both";
  /**
   * 是否标记极值数据。
   * @defaultValue false
   */
  markExtremes?: boolean;
  /**
   * 启用大数据量渲染优化的阈值。
   * @defaultValue 1200
   */
  largeThreshold?: number;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<ScatterDatum>) => void;
}

/** 散点图组件。 */
export const ScatterChart = forwardRef<SiaChartRef, ScatterChartProps>(function ScatterChart(
  { symbolAnimation=false, animationProgress, animationDurationUpdate=500, statisticPoints=[], statisticLines=[], annotations=[], data:initialData,toolbox,showXAxis=true,showXSplitLine=true,showYSplitLine=true,tooltipFormatter,plotBounds,xDomain:fixedXDomain,yDomain:fixedYDomain,showPointLabels=false,yAxisPosition='left',xCategories,xFormatter,crosshair=false,markColor,xSplitNumber=5,ySplitNumber=5,symbolSize,markAppearance='label',markByCategory=false,xUnit='',yUnit='',minSymbolRadius=5,xLabel, yLabel, xAxisType = "value", showLegend = true, legendInteractive = true, legendSelected, onLegendSelectionChange, dataZoom = false, zoom, defaultZoom, onZoomChange, visualMap, markAverage, markExtremes = false, largeThreshold = 1200, onDataClick, palette, ...props }, ref,
) {
  const [data,setData]=useState(initialData);
  const [emphasizedPoint,setEmphasizedPoint]=useState<number|null>(null);
  const [emphasizedAnnotation,setEmphasizedAnnotation]=useState<string>();
  useEffect(()=>setData(initialData),[initialData]);
  const plot=plotBounds??PLOT,bottom=plot.y+plot.height;
  const [zoomValue, setZoomValue] = useZoom(zoom, defaultZoom, onZoomChange);
  const allCategories = [...new Set(data.map((item) => item.category).filter((value): value is string => Boolean(value)))];
  const legend = useLegendSelection(allCategories, legendSelected, onLegendSelectionChange);
  const activeData = data.filter((item) => !item.category || legend.isSelected(item.category));
  const sorted = useMemo(() => [...activeData].sort((left, right) => left.x - right.x), [activeData]);
  const startIndex = dataZoom ? Math.floor(Math.min(...zoomValue) / 100 * Math.max(0, sorted.length - 1)) : 0;
  const endIndex = dataZoom ? Math.max(startIndex + 1, Math.ceil(Math.max(...zoomValue) / 100 * sorted.length)) : sorted.length;
  const categoryWindow=xCategories?scatterCategoryWindow(xCategories,dataZoom?zoomValue:[0,100]):undefined;
  const timeWindow=xAxisType==='time'?scatterValueWindow(data.map(item=>item.x),dataZoom?zoomValue:[0,100]):undefined;
  const visibleData = categoryWindow?sorted.filter(item=>categoryWindow.includes(item.x)):timeWindow?sorted.filter(item=>item.x>=timeWindow[0]&&item.x<=timeWindow[1]):sorted.slice(startIndex, endIndex);
  const xDomain: readonly [number,number,number] = fixedXDomain??(categoryWindow?[ -.5,Math.max(.5,categoryWindow.length-.5),1]:timeWindow?[timeWindow[0],timeWindow[1],Math.max(1,(timeWindow[1]-timeWindow[0])/xSplitNumber)]:niceChartDomain(visibleData.map((item) => item.x), false, xSplitNumber));
  const yDomain = fixedYDomain??niceChartDomain(visibleData.map((item) => item.y), false, ySplitNumber);
  const categories = [...new Set(visibleData.map((item) => item.category).filter((value): value is string => Boolean(value)))];
  const xTicks = categoryWindow??(timeWindow?chartTimeTicks(timeWindow,xSplitNumber):chartTicks(xDomain));
  const yTicks = chartTicks(yDomain);
  const visualValues = visibleData.map((item) => item[visualMap?.dimension ?? "y"] ?? 0);
  const visualMinimum = visualMap?.min ?? (visualValues.length ? Math.min(...visualValues) : 0);
  const visualMaximum = visualMap?.max ?? (visualValues.length ? Math.max(...visualValues) : 1);
  const visualColors = visualMap?.colors ?? ["#e6f4ff", "#1677ff"];
  const [selectedPieces,setSelectedPieces]=useState<boolean[]>([]);
  const [visualRange,setVisualRange]=useState<[number,number]|undefined>();
  const piecesKey=JSON.stringify(visualMap?.pieces??[]);
  useEffect(()=>setSelectedPieces([]),[piecesKey]);
  const statistics=scatterStatistics(visibleData,markByCategory);
  const plotted = visibleData.map((item, index) => {
    const x = linearScale(categoryWindow?categoryWindow.indexOf(item.x):item.x, [xDomain[0], xDomain[1]], [plot.x, plot.x + plot.width]);
    const y = linearScale(item.y, [yDomain[0], yDomain[1]], [bottom, plot.y]);
    const categoryIndex = Math.max(0, allCategories.indexOf(item.category ?? ""));
    const visualValue = item[visualMap?.dimension ?? "y"] ?? 0;
    const pieceIndex=visualPieceIndex(visualValue,visualMap?.pieces??[]);
    const piece=visualMap?.pieces?.[pieceIndex];
    const color = item.color ?? piece?.color ?? (visualMap ? colorBetween(visualColors[0], visualColors[1], (visualValue - visualMinimum) / Math.max(1, visualMaximum - visualMinimum)) : getColor(item.category?categoryIndex:index, undefined, palette));
    return { item: symbolSize ? {...item,size:Math.max(0,symbolSize(item))} : item, index, x, y, color, pieceIndex, visualValue };
  }).filter(point=>(!visualMap?.calculable||!visualRange||point.visualValue>=visualRange[0]&&point.visualValue<=visualRange[1])&&(!visualMap?.selectable||point.pieceIndex<0||selectedPieces[point.pieceIndex]!==false));
  const dimensions=data.some(d=>d.value!==undefined)?3:2;
  const coordinates=(d:ScatterDatum)=>dimensions===3?[d.x,d.y,d.value??0]:[d.x,d.y];
  const chartToolbox=typeof toolbox==='object'?{...toolbox,dataView:toolbox.dataView??<ChartDataEditor readOnly={toolbox.dataViewReadOnly} series={allCategories.length?allCategories.map(name=>({name,data:data.filter(d=>d.category===name).flatMap(coordinates)})):[{name:'散点数据（x,y 交替）',data:data.flatMap(coordinates)}]} onApply={values=>{const cursors=values.map(()=>0);setData(data.map(d=>{const group=allCategories.length?Math.max(0,allCategories.indexOf(d.category??'')):0,index=cursors[group]!;cursors[group]=index+dimensions;return {...d,x:values[group]![index]!,y:values[group]![index+1]!,...(dimensions===3?{value:values[group]![index+2]!}:{})};}));}}/>,onRestore:()=>{setVisualRange(undefined);setSelectedPieces([]);setData(initialData);legend.replace(Object.fromEntries(allCategories.map(c=>[c,true])));setZoomValue(defaultZoom?[...defaultZoom]:[0,100]);toolbox.onRestore?.();}}:toolbox;
  const content = <SiaChart {...props} toolbox={chartToolbox} ref={ref} palette={palette} empty={!visibleData.length} ariaLabel={props.ariaLabel ?? "散点图"}>
    {crosshair?<ChartCrosshair bounds={plot} xDomain={[xDomain[0],xDomain[1]]} yDomain={[yDomain[0],yDomain[1]]} formatX={value=>{const axisValue=categoryWindow?categoryWindow[Math.max(0,Math.min(categoryWindow.length-1,Math.round(value)))]??0:value;return xFormatter?xFormatter(axisValue):xAxisType==='time'?new Date(axisValue).toLocaleString():`${Number(axisValue.toFixed(2))}${xUnit}`;}} formatY={value=>`${Number(value.toFixed(2))}${yUnit}`}/>:null}
    {showLegend && allCategories.length ? <ChartLegend items={allCategories.map((name, index) => ({ name, color: getColor(index, undefined, palette), disabled: !legend.isSelected(name) }))} selected={legend.selected} onItemClick={legendInteractive ? legend.toggle : undefined} /> : null}
    {showXAxis?<ChartAxis positions={timeWindow?xTicks.map(value=>(value-timeWindow[0])/Math.max(1,timeWindow[1]-timeWindow[0])):undefined} boundaryGap={!!categoryWindow} tickInterval={categoryWindow?Math.max(1,Math.ceil(categoryWindow.length/7)):1} orientation="bottom" x={plot.x} y={bottom} length={plot.width} labels={xTicks.map((value) => xFormatter?xFormatter(value):xAxisType === "time" ? new Date(value).toLocaleDateString() : `${formatChartNumber(value)}${xUnit}`)} gridLength={showXSplitLine?plot.height:undefined} />:null}
    <ChartAxis boundaryGap={false} orientation={yAxisPosition} x={yAxisPosition==="right"?plot.x+plot.width:plot.x} y={bottom} length={plot.height} labels={yTicks.map(value=>`${formatChartNumber(value)}${yUnit}`)} gridLength={showYSplitLine?plot.width:undefined} />
    {xLabel ? <text x={plot.x + plot.width} y={bottom + 38} textAnchor="end" className="sia-chart__axis-name">{xLabel}</text> : null}
    {yLabel ? <text x={plot.x} y={plot.y - 12} textAnchor="start" className="sia-chart__axis-name">{yLabel}</text> : null}
    {visualMap ? <ChartVisualMap calculable={visualMap.calculable} orientation={visualMap.orientation} range={visualRange??[visualMinimum,visualMaximum]} onRangeChange={setVisualRange} min={visualMinimum} max={visualMaximum} colors={visualColors} pieces={visualMap.pieces} selectedPieces={selectedPieces} onPieceToggle={visualMap.selectable?index=>setSelectedPieces(current=>{const next=[...current];next[index]=current[index]===false;return next;}):undefined} x={visualMap.x??plot.x + plot.width - 116} y={visualMap.y??322} width={visualMap.width??116} label={visualMap.label} /> : null}
    {markAverage === "x" || markAverage === "both" ? statistics.map(stat=><g key={stat.category} className="sia-chart__mark-line"><line style={{stroke:markColor??(markByCategory?getColor(Math.max(0,allCategories.indexOf(stat.category)),undefined,palette):undefined)}} x1={linearScale(stat.averageX, [xDomain[0], xDomain[1]], [plot.x, plot.x + plot.width])} y1={plot.y} x2={linearScale(stat.averageX, [xDomain[0], xDomain[1]], [plot.x, plot.x + plot.width])} y2={bottom} /><text x={linearScale(stat.averageX, [xDomain[0], xDomain[1]], [plot.x, plot.x + plot.width]) + 5} y={plot.y + 12}>{markByCategory?stat.category+" ":""}均值 {stat.averageX.toFixed(2)}</text></g>) : null}
    {markAverage === "y" || markAverage === "both" ? statistics.map(stat=>{
      const y=linearScale(stat.averageY,[yDomain[0],yDomain[1]],[bottom,plot.y]);
      const color=markColor??(markByCategory?getColor(Math.max(0,allCategories.indexOf(stat.category)),undefined,palette):undefined);
      const pin=markAppearance==='pin',end=plot.x+plot.width;
      return <g key={stat.category} className="sia-chart__mark-line">
        <line style={{stroke:color}} x1={plot.x} y1={y} x2={end} y2={y}/>
        {pin?<><circle cx={plot.x} cy={y} r={2} fill={color}/><path d={`M ${end-7} ${y-4} L ${end} ${y} L ${end-7} ${y+4} Z`} fill={color}/></>:null}
        <text x={pin?end+8:end-4} y={pin?y+4:y-6} textAnchor={pin?'start':'end'} style={pin?{fill:color}:undefined}>{pin?Number(stat.averageY.toFixed(2)):`${markByCategory?stat.category+" ":""}均值 ${stat.averageY.toFixed(2)}`}</text>
      </g>;
    }) : null}
    {plotted.length >= largeThreshold ? buildScatterBatches(plotted.map(({x,y,item,color})=>({x,y,color,radius:Math.max(1,(item.size??6)/2)}))).map(batch=><path key={batch.color} d={batch.path} data-point-count={batch.count} fill={batch.color} opacity={.66} className="sia-chart__large-scatter"/>) : plotted.map(({ item, index, x, y, color:baseColor }) => {
      const emphasized=emphasizedPoint===index;
      const color=emphasized?(item.emphasisColor??baseColor):baseColor;
      const borderWidth=emphasized?(item.emphasisBorderWidth??item.borderWidth):item.borderWidth;
      const name = item.name ?? `数据点 ${index + 1}`;
      const stats=statistics.find(s=>s.category===(markByCategory?item.category??'':''));
      const extreme = markExtremes && stats && (item.y === stats.maxY || item.y === stats.minY);
      return <ChartScatterMotion key={`${name}-${index}`} x={x} y={y} radius={item.size??9} enabled={symbolAnimation&&props.animation!==false} duration={props.animationDuration??2000} updateDuration={animationDurationUpdate} progress={animationProgress}><ChartMark key={`${name}-${index}`} label={`${name}，${item.x}，${item.y}`} onPointerEnter={()=>setEmphasizedPoint(index)} onPointerLeave={()=>setEmphasizedPoint(null)} onFocus={()=>setEmphasizedPoint(index)} onBlur={()=>setEmphasizedPoint(null)} tooltip={tooltipFormatter?tooltipFormatter(item):<><strong>{name}</strong><span>{item.category}</span><b>{xAxisType==='time'?new Date(item.x).toLocaleString():xFormatter?xFormatter(item.x):item.x}{xUnit}, {item.y}{yUnit}{item.value!==undefined?`, ${item.value}`:''}</b></>} tooltipPoint={[x, y]} onPointerUp={(event) => onDataClick?.({ name, value: [item.x, item.y], seriesName: item.category, data: item, nativeEvent: event })}>
        {item.symbol==="image"?<image data-scatter-symbol="image" href={item.symbolImage} x={x-(item.size??9)} y={y-(item.size??9)} width={(item.size??9)*2} height={(item.size??9)*2}/>:item.symbol==="emptyCircle"?<circle data-scatter-symbol="emptyCircle" cx={x} cy={y} r={item.size??9} fill={item.symbolFill??"#fff"} stroke={color} strokeWidth={borderWidth??2}/>:item.symbol==="emptyTriangle"?<path data-scatter-symbol="emptyTriangle" d={`M ${x} ${y-(item.size??9)} L ${x+(item.size??9)} ${y+(item.size??9)} L ${x-(item.size??9)} ${y+(item.size??9)} Z`} fill={item.symbolFill??"#fff"} stroke={color} strokeWidth={borderWidth??2} transform={`rotate(${item.symbolRotate??0} ${x} ${y})`}/>:item.symbol === "square" ? <rect x={x - Math.max(5, item.size ?? 9)} y={y - Math.max(5, item.size ?? 9)} width={Math.max(10, (item.size ?? 9) * 2)} height={Math.max(10, (item.size ?? 9) * 2)} fill={color} className="sia-chart__bubble" /> : item.symbol === "diamond" ? <rect x={x - Math.max(4, (item.size ?? 9) * .7)} y={y - Math.max(4, (item.size ?? 9) * .7)} width={Math.max(8, (item.size ?? 9) * 1.4)} height={Math.max(8, (item.size ?? 9) * 1.4)} transform={`rotate(45 ${x} ${y})`} fill={color} className="sia-chart__bubble" /> : <circle cx={x} cy={y} r={Math.max(minSymbolRadius, item.size ?? 9)} fill={color} className="sia-chart__bubble" />}
        {(emphasized?(item.showEmphasisLabel??item.showLabel??showPointLabels):(item.showLabel??showPointLabels)) ? <text x={x} y={y - Math.max(minSymbolRadius, item.size ?? 9) - 7} textAnchor="middle" className="sia-chart__point-label" style={{fill:color,...item.labelStyle}}>{item.labelFormatter?.(item)??item.label??name}</text> : null}
        {extreme && markAppearance==='label' ? <text x={x} y={y - Math.max(5, item.size ?? 9) - 7} textAnchor="middle" className="sia-chart__point-label">{formatChartNumber(item.y)}</text> : null}
      </ChartMark></ChartScatterMotion>;
    })}
    {markExtremes && markAppearance==='pin' ? statistics.flatMap(stat=>[stat.maxY,stat.minY].map((value,kind)=>{
      // One mark per statistic, even when multiple data points share its value.
      const point=plotted.find(p=>p.item.y===value&&(!markByCategory||(p.item.category??'')===stat.category));
      if(!point)return null;
      const {x,y,color}=point,label=String(value),radius=Math.max(15,label.length*4);
      return <ChartMark key={`${stat.category}-${kind}`} label={`${stat.category} ${kind?'最小值':'最大值'} ${label}${yUnit}`} tooltip={<><strong>{stat.category} {kind?'最小值':'最大值'}</strong><b>{label}{yUnit}</b></>} tooltipPoint={[x,y]}>
        <path data-scatter-extreme={kind?'min':'max'} d={`M ${x} ${y} C ${x-radius*.3} ${y-radius*.6} ${x-radius} ${y-radius} ${x-radius} ${y-radius*1.6} A ${radius} ${radius} 0 1 1 ${x+radius} ${y-radius*1.6} C ${x+radius} ${y-radius} ${x+radius*.3} ${y-radius*.6} ${x} ${y} Z`} fill={color}/>
        <text x={x} y={y-radius*1.6} textAnchor="middle" dominantBaseline="central" style={{fill:'#fff',fontSize:12,pointerEvents:'none'}}>{label}</text>
      </ChartMark>;
    })) : null}
    {statisticLines.map(mark=>{
      const selected=visibleData.filter(item=>(!mark.category||item.category===mark.category)&&Number.isFinite(item.x)&&Number.isFinite(item.y));
      if(!selected.length)return null;
      const value=selected.reduce((sum,item)=>sum+item[mark.dimension],0)/selected.length;
      const vertical=mark.dimension==='x',position=vertical?linearScale(value,[xDomain[0],xDomain[1]],[plot.x,plot.x+plot.width]):linearScale(value,[yDomain[0],yDomain[1]],[bottom,plot.y]);
      const x1=vertical?position:plot.x,y1=vertical?bottom:position,x2=vertical?position:plot.x+plot.width,y2=vertical?plot.y:position,color=mark.color??'#2ec7c9',key=`statistic-${mark.name}`,width=emphasizedAnnotation===key?3.5:1.5;
      return <ChartPointMotion key={key} points={[[x1,y1],[x2,y2]]} origin={[x1,y1]} enabled={symbolAnimation&&props.animation!==false} duration={props.animationDuration??2000} updateDuration={animationDurationUpdate} progress={animationProgress}>{frame=>{const [[x1,y1],[x2,y2]]=frame as readonly [readonly [number,number],readonly [number,number]];return <ChartMark key={key} data-scatter-statistic={mark.dimension} label={`${mark.name}，${value.toFixed(2)}`} tooltip={<><strong>{mark.name}</strong><span>{value.toFixed(2)}</span></>} tooltipPoint={[x2,y2]} onPointerEnter={()=>setEmphasizedAnnotation(key)} onPointerLeave={()=>setEmphasizedAnnotation(undefined)} onFocus={()=>setEmphasizedAnnotation(key)} onBlur={()=>setEmphasizedAnnotation(undefined)}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeDasharray="5 5"/>
        <circle cx={x1} cy={y1} r={2} fill={color}/><path d={vertical?`M ${x2-4} ${y2+8} L ${x2} ${y2} L ${x2+4} ${y2+8} Z`:`M ${x2-8} ${y2-4} L ${x2} ${y2} L ${x2-8} ${y2+4} Z`} fill={color}/>
        <text x={vertical?x2:x2+5} y={vertical?y2-5:y2+4} textAnchor={vertical?'middle':'start'} style={{fill:color,fontSize:12}}>{value.toFixed(2)}</text>
      </ChartMark>;}}</ChartPointMotion>;
    })}
    {statisticPoints.map(mark=>{
      const selected=visibleData.filter(item=>(!mark.category||item.category===mark.category)&&Number.isFinite(item.x)&&Number.isFinite(item.y));
      if(!selected.length)return null;
      const point=selected.reduce((best,item)=>(mark.kind==='max'?item[mark.dimension]>best[mark.dimension]:item[mark.dimension]<best[mark.dimension])?item:best);
      const x=linearScale(categoryWindow?categoryWindow.indexOf(point.x):point.x,[xDomain[0],xDomain[1]],[plot.x,plot.x+plot.width]),y=linearScale(point.y,[yDomain[0],yDomain[1]],[bottom,plot.y]);
      const size=mark.size??34,symbol=mark.symbol??'pin',color=mark.color??'#2ec7c9',key=`extreme-${mark.name}`,value=point[mark.dimension];
      return <ChartScatterMotion key={key} x={x} y={y} radius={size/2} enabled={symbolAnimation&&props.animation!==false} duration={props.animationDuration??2000} updateDuration={animationDurationUpdate} progress={animationProgress}><ChartMark key={key} data-scatter-statistic-point={mark.name} label={`${mark.name}，${value}`} tooltip={<><strong>{mark.name}</strong><span>{value}</span></>} tooltipPoint={[x,y]} onPointerEnter={()=>setEmphasizedAnnotation(key)} onPointerLeave={()=>setEmphasizedAnnotation(undefined)} onFocus={()=>setEmphasizedAnnotation(key)} onBlur={()=>setEmphasizedAnnotation(undefined)}>
        <path d={chartMarkerPath(symbol,x,y,size)} fill={color} stroke={mark.borderColor??color} strokeWidth={emphasizedAnnotation===key?4:2}/>
        <text x={x} y={symbol==='pin'?y-size*.75+4:y+4} textAnchor="middle" style={{fill:'#fff',fontSize:12,pointerEvents:'none'}}>{value}</text>
      </ChartMark></ChartScatterMotion>;
    })}
    {annotations.filter(mark=>!mark.category||legend.isSelected(mark.category)).map(mark=>{
      const x=linearScale(categoryWindow?categoryWindow.indexOf(mark.x):mark.x,[xDomain[0],xDomain[1]],[plot.x,plot.x+plot.width]);
      const y=linearScale(mark.y,[yDomain[0],yDomain[1]],[bottom,plot.y]),radius=mark.radius??20,color=mark.color??'#2ec7c9';
      return <ChartScatterMotion key={`annotation-${mark.name}`} x={x} y={y} radius={radius} enabled={symbolAnimation&&props.animation!==false} duration={props.animationDuration??2000} updateDuration={animationDurationUpdate} progress={animationProgress}><ChartMark key={`annotation-${mark.name}`} label={`${mark.name}，${mark.value}`} tooltip={<><strong>{mark.name}</strong><span>{mark.value.toLocaleString('en-US')}</span></>} tooltipPoint={[x,y]} onPointerEnter={()=>setEmphasizedAnnotation(mark.name)} onPointerLeave={()=>setEmphasizedAnnotation(undefined)} onFocus={()=>setEmphasizedAnnotation(mark.name)} onBlur={()=>setEmphasizedAnnotation(undefined)}>
        <circle data-scatter-annotation={mark.name} cx={x} cy={y} r={radius} fill="none" stroke={color} strokeWidth={emphasizedAnnotation===mark.name?4:2} pointerEvents="stroke"/>
        <text x={x} y={y-radius-5} textAnchor="middle" style={{fill:color,fontSize:12,fontFamily:'微软雅黑, Arial, Verdana, sans-serif'}}>{mark.value.toLocaleString('en-US')}</text>
      </ChartMark></ChartScatterMotion>;
    })}
  </SiaChart>;
  return dataZoom ? <div className="sia-chart-with-zoom">{content}<ChartDataZoom value={zoomValue} onChange={setZoomValue} /></div> : content;
});

/** Candlestick的单条数据。 */
export interface CandlestickDatum {
  /** 名称或字段标识。 */
  name: string;
  /** 是否打开；传入后由外部控制显示状态。 */
  open: number;
  /** 关闭当前界面或实例。 */
  close: number;
  /** 最低值。 */
  low: number;
  /** 最高值。 */
  high: number;
  /** 成交量。 */
  volume?: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 边框颜色。 */
  borderColor?: string;
  /** 边框线宽。 */
  borderWidth?: number;
  /** 高亮状态的颜色。 */
  emphasisColor?: string;
}

/** 蜡烛图的属性配置。 */
export interface CandlestickChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** Hide axes when sharing a plot with another chart layer. */
  showAxes?: boolean;
  /** 数值轴的数据范围。 */
  valueDomain?: readonly [number,number,number];
  /** 坐标轴标签格式化函数。 */
  axisLabelFormatter?: (value:number)=>string;
  /** Index into the full input data; null explicitly clears a controlled highlight. */
  activeIndex?: number | null;
  /** 当前激活数据索引变化时调用。 */
  onActiveIndexChange?: (index:number|null)=>void;
  /** 各数据系列的可见状态。 */
  seriesVisible?: boolean;
  /** 系列可见性变化时调用。 */
  onSeriesVisibilityChange?: (visible:boolean)=>void;
  /**
   * 是否显示图例。
   * @defaultValue true
   */
  showLegend?: boolean;
  /**
   * 是否显示类目标签。
   * @defaultValue true
   */
  showCategoryLabels?: boolean;
  /** 绘图区边界。 */
  plotBounds?: {
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
  /** 标记点配置集合。 */
  markPoints?: readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 关联的日期或时间。 */
  date:string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string}[];
  /** 数据系列名称。 */
  seriesName?: string;
  /** 上涨蜡烛图的边框颜色。 */
  risingBorderColor?: string;
  /** 下跌蜡烛图的边框颜色。 */
  fallingBorderColor?: string;
  /**
   * 边框线宽。
   * @defaultValue 2
   */
  borderWidth?: number;
  /** 上涨数据高亮时的颜色。 */
  risingEmphasisColor?: string;
  /** 下跌数据高亮时的颜色。 */
  fallingEmphasisColor?: string;
  /**
   * 柱形允许的最大宽度。
   * @defaultValue 34
   */
  maxBarWidth?: number;
  /**
   * 图形外观配置。
   * @defaultValue 'sia'
   */
  appearance?: 'sia'|'macarons';
  /** 用于渲染的数据集合。 */
  data: readonly CandlestickDatum[];
  /**
   * 上涨数据的颜色。
   * @defaultValue "#f5222d"
   */
  risingColor?: string;
  /**
   * 下跌数据的颜色。
   * @defaultValue "#52c41a"
   */
  fallingColor?: string;
  /**
   * 上涨蜡烛图是否使用空心样式。
   * @defaultValue false
   */
  hollowRising?: boolean;
  /**
   * 数据区域缩放配置。
   * @defaultValue false
   */
  dataZoom?: boolean;
  /** 缩放级别或缩放范围。 */
  zoom?: readonly [number, number];
  /** 初始缩放范围或缩放级别。 */
  defaultZoom?: readonly [number, number];
  /** 缩放范围变化时调用。 */
  onZoomChange?: (value: [number, number]) => void;
  /**
   * 是否标记极值数据。
   * @defaultValue false
   */
  markExtremes?: boolean;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<CandlestickDatum>) => void;
}

/** 蜡烛图组件。 */
export const CandlestickChart = forwardRef<SiaChartRef, CandlestickChartProps>(function CandlestickChart(
  { showAxes=true,data:initialData,valueDomain,axisLabelFormatter,activeIndex,onActiveIndexChange,seriesVisible:controlledVisible,onSeriesVisibilityChange,showLegend=true,showCategoryLabels=true,plotBounds,markPoints,seriesName,risingBorderColor,fallingBorderColor,borderWidth=2,risingEmphasisColor,fallingEmphasisColor,maxBarWidth=34,appearance='sia',risingColor = "#f5222d", fallingColor = "#52c41a", hollowRising = false, dataZoom = false, zoom, defaultZoom, onZoomChange, markExtremes = false, onDataClick,toolbox, ...props }, ref,
) {
  const [data,setData]=useState(initialData),[internalActive,setInternalActive]=useState<number|null>(null),[internalVisible,setInternalVisible]=useState(true);
  const active=activeIndex===undefined?internalActive:activeIndex;
  const seriesVisible=controlledVisible??internalVisible;
  const setActive=(index:number|null)=>{if(activeIndex===undefined)setInternalActive(index);onActiveIndexChange?.(index);};
  const setSeriesVisible=(visible:boolean)=>{if(controlledVisible===undefined)setInternalVisible(visible);onSeriesVisibilityChange?.(visible);};
  useEffect(()=>{setData(initialData);},[initialData]);
  const legacy=appearance==='macarons';
  const plot=plotBounds??(legacy?{x:80,y:60,width:(props.viewBoxSize?.[0]??720)-160,height:(props.viewBoxSize?.[1]??360)-120}:PLOT);
  const bottom=plot.y+plot.height;
  const [zoomValue, setZoomValue] = useZoom(zoom, defaultZoom, onZoomChange);
  const startIndex = dataZoom ? Math.min(Math.max(0,data.length-1),Math.floor(Math.min(...zoomValue) / 100 * Math.max(0, legacy?data.length:data.length - 1))) : 0;
  const endIndex = dataZoom ? Math.max(startIndex + 1, Math.ceil(Math.max(...zoomValue) / 100 * data.length)) : data.length;
  const visibleData = data.slice(startIndex, endIndex);
  const domain = valueDomain??niceChartDomain(visibleData.flatMap((item) => [item.low, item.high]), false);
  const band = plot.width / Math.max(1, visibleData.length);
  const highest = Math.max(...visibleData.map((item) => item.high));
  const lowest = Math.min(...visibleData.map((item) => item.low));
  const chartToolbox=typeof toolbox==='object'?{...toolbox,dataView:toolbox.dataView??<ChartDataEditor readOnly={toolbox.dataViewReadOnly} series={data.map(d=>({name:d.name,data:[d.open,d.close,d.low,d.high]}))} onApply={values=>setData(data.map((d,i)=>({...d,open:values[i]![0]!,close:values[i]![1]!,low:values[i]![2]!,high:values[i]![3]!})))}/>,onRestore:()=>{setData(initialData);setZoomValue(defaultZoom?[...defaultZoom]:[0,100]);setActive(null);setSeriesVisible(true);toolbox.onRestore?.();}}:toolbox;
  const zoomControl=<ChartDataZoom value={zoomValue} onChange={setZoomValue} dataShadow={data.map(d=>d.close)} showDetail={!legacy}/>;
  const content = <SiaChart {...props} toolbox={chartToolbox} className={`${props.className??''}${legacy?' sia-chart--macarons':''}`} ref={ref} empty={!visibleData.length} ariaLabel={props.ariaLabel ?? "K 线图"}>
    {showLegend&&seriesName?<ChartLegend x={(props.viewBoxSize?.[0]??720)/2} items={[{name:seriesName,color:risingColor}]} selected={{[seriesName]:seriesVisible}} onItemClick={()=>setSeriesVisible(!seriesVisible)}/>:null}
    {showAxes?<ChartAxis boundaryGap={false} orientation="left" x={plot.x} y={bottom} length={plot.height} labels={chartTicks(domain).map(v=>axisLabelFormatter?axisLabelFormatter(v):legacy?v.toLocaleString('en-US'):formatChartNumber(v))} gridLength={plot.width}/>:null}
    {showAxes?<line x1={plot.x} y1={bottom} x2={plot.x+plot.width} y2={bottom} className="sia-chart__axis-line"/>:null}
    {showCategoryLabels?visibleData.map((d,i)=>(i%Math.max(1,Math.ceil(visibleData.length/6))===0?<text key={d.name} x={plot.x+(i+.5)*band} y={bottom+20} textAnchor="middle" className="sia-chart__axis-label">{d.name}</text>:null)):null}
    {seriesVisible&&active!=null&&active>=startIndex&&active<endIndex?<rect data-candlestick-active-index={active} x={plot.x+(active-startIndex)*band} y={plot.y} width={band} height={plot.height} fill="currentColor" opacity={.06} pointerEvents="none"/>:null}
    {seriesVisible?visibleData.map((item, index) => {
      const x = plot.x + (index + 0.5) * band;
      const openY = linearScale(item.open, [domain[0], domain[1]], [bottom, plot.y]);
      const closeY = linearScale(item.close, [domain[0], domain[1]], [bottom, plot.y]);
      const lowY = linearScale(item.low, [domain[0], domain[1]], [bottom, plot.y]);
      const highY = linearScale(item.high, [domain[0], domain[1]], [bottom, plot.y]);
      const rising = item.close >= item.open;
      const normalColor=item.color??(rising?risingColor:fallingColor);
      const color=active===index+startIndex?(item.emphasisColor??(rising?risingEmphasisColor:fallingEmphasisColor)??normalColor):normalColor;
      const stroke=item.borderColor??(rising?risingBorderColor:fallingBorderColor)??normalColor;
      const candleWidth=Math.min(maxBarWidth,band*.6);
      return <ChartMark onPointerMove={()=>setActive(index+startIndex)} onPointerLeave={()=>setActive(null)} onFocus={()=>setActive(index+startIndex)} onBlur={()=>setActive(null)} key={`${item.name}-${index}`} label={`${item.name}，开盘 ${item.open}，收盘 ${item.close}`} tooltip={<><strong>{seriesName} {item.name}</strong><span>开盘 {item.open}　最高 {item.high}</span><span>收盘 {item.close}　最低 {item.low}</span></>} tooltipPoint={[x, Math.min(openY, closeY)]} onPointerUp={(event) => onDataClick?.({ name: item.name, value: [item.open, item.close, item.low, item.high], data: item, nativeEvent: event })}>
        <line x1={x} y1={highY} x2={x} y2={lowY} stroke={stroke} strokeWidth={item.borderWidth??borderWidth} />
        <rect x={x-candleWidth/2} y={Math.min(openY, closeY)} width={candleWidth} height={Math.max(1, Math.abs(closeY - openY))} fill={rising && hollowRising ? "var(--sia-color-surface)" : color} stroke={stroke} strokeWidth={item.borderWidth??borderWidth} className="sia-chart__candlestick" />
        {markExtremes && item.high === highest ? <text x={x} y={highY - 8} textAnchor="middle" className="sia-chart__point-label">最高 {formatChartNumber(item.high)}</text> : null}
        {markExtremes && item.low === lowest ? <text x={x} y={lowY + 16} textAnchor="middle" className="sia-chart__point-label">最低 {formatChartNumber(item.low)}</text> : null}
      </ChartMark>;
    }):null}
{seriesVisible?markPoints?.map((point,i)=>{const index=visibleData.findIndex(d=>d.name===point.date);if(index<0)return null;const x=plot.x+(index+.5)*band,y=linearScale(point.y,[domain[0],domain[1]],[bottom,plot.y]),color=point.color??'#2ec7c9';const star=Array.from({length:10},(_,j)=>{const a=-Math.PI/2+j*Math.PI/5,r=j%2===0?12:5;return `${x+Math.cos(a)*r},${y+Math.sin(a)*r}`;}).join(' ');return <ChartMark key={i} label={`${point.name}，${point.value}`} tooltip={<TooltipValue name={point.name} value={point.value}/>} tooltipPoint={[x,y]}><polygon points={star} fill={color}/><text x={x} y={y-18} textAnchor="middle" fill={color} fontSize={12}>{point.value.toLocaleString('en-US')}</text></ChartMark>;}):null}
    {legacy&&dataZoom?<foreignObject className="sia-chart__inline-zoom" x={plot.x} y={bottom+30} width={plot.width} height={30}>{zoomControl}</foreignObject>:null}
  </SiaChart>;
  return dataZoom&&!legacy ? <div className="sia-chart-with-zoom">{content}{zoomControl}</div> : content;
});

/** 饼图径向渐变配置。 */
export interface PieRadialGradient {
  /** 中心位置。 */
  center:readonly [number,number];
  /** 环形图形的内半径。 */
  innerRadius?:number;
  /** 环形图形的外半径。 */
  outerRadius:number;
  /** 渐变颜色停靠点集合。 */
  stops:readonly {
  /** 相对于默认位置的偏移。 */
  offset:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string}[];
}

/** PieLabel的配置选项。 */
export interface PieLabelOptions {
  /** 标签文本格式化函数。 */
  labelFormatter?:(item:PieDatum,percent:number)=>string;
  /** 高亮标签格式化函数。 */
  emphasisLabelFormatter?:(item:PieDatum,percent:number)=>string;
  /** 标签文字样式。 */
  labelStyle?:CSSProperties;
  /** 高亮状态的标签样式。 */
  emphasisLabelStyle?:CSSProperties;
  /** 高亮时是否显示标签。 */
  showEmphasisLabel?:boolean;
  /** 标签引导线配置。 */
  labelLine?:{
  /** 是否显示该功能。 */
  show?:boolean;
  /** 长度。 */
  length?:number;
  /** 组件根节点的内联样式。 */
  style?:CSSProperties};
  /** 高亮状态的标签引导线配置。 */
  emphasisLabelLine?:{
  /** 是否显示该功能。 */
  show?:boolean;
  /** 长度。 */
  length?:number;
  /** 组件根节点的内联样式。 */
  style?:CSSProperties};
}
/** Pie的单条数据。 */
export interface PieDatum extends PieLabelOptions {
  /** Missing source slot after a calculable transfer; not a zero-valued slice. */
  missing?:boolean;
  /** 是否显示标签文本。 */
  showLabel?:boolean;
  /** 渐变填充配置。 */
  gradient?:PieRadialGradient;
  /** 高亮状态的渐变填充。 */
  emphasisGradient?:PieRadialGradient;
  /** 高亮状态的颜色。 */
  emphasisColor?:string;
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 是否处于选中状态。 */
  selected?: boolean;
  /** 是否将该系列显示在图例中。 */
  showInLegend?: boolean;
  /** 是否启用交互。 */
  interactive?: boolean;
}

/** Pie的数据系列。 */
export interface PieSeries extends PieLabelOptions {
  /** 高亮状态的渐变填充。 */
  emphasisGradient?:PieRadialGradient;
  /** SVG degrees; overrides the chart angle for this ring only. */
  startAngle?: number;
  /** 中心区域显示的标签。 */
  centerLabel?: ReactNode;
  /** 名称或字段标识。 */
  name?: string;
  /** 用于渲染的数据集合。 */
  data: readonly PieDatum[];
  /** 环形图形的内半径。 */
  innerRadius?: number;
  /** 环形图形的外半径。 */
  outerRadius?: number;
  /** 是否启用南丁格尔玫瑰图模式。 */
  rose?: boolean | "radius" | "area";
  /** 是否显示数据标签。 */
  showLabels?: boolean;
  /** 中心位置。 */
  center?: readonly [number,number];
  /** 标签显示位置。 */
  labelPosition?: "outside" | "inside";
  /** 高亮状态的标签配置。 */
  emphasisLabel?: "center" | "outside";
  /** 图形的选中模式。 */
  selectedMode?: false | "single" | "multiple";
  /** 是否按顺时针方向绘制。 */
  clockwise?: boolean;
}

/** 饼图的属性配置。 */
export interface PieChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** 数据点脉冲环效果配置。 */
  pulseRing?:ChartPulseRingProps;
  /**
   * 是否允许通过拖拽图形修改数据。
   * @defaultValue false
   */
  calculable?:boolean;
  /** Fixed-position star annotations; percentage coordinates use the SVG viewport. */
  markPoints?:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value:number;
  /** 横向位置或 X 轴数据值。 */
  x:number|`${number}%`;
  /** 纵向位置或 Y 轴数据值。 */
  y:number|`${number}%`;
  /** 图形半径或圆角配置。 */
  radius?:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string}[];
  /** 将数据值拖出当前绘图区时调用。 */
  onValueDragOut?: (seriesIndex:number,dataIndex:number,point:readonly [number,number])=>void;
  /** 外侧标签的布局规则。 */
  outsideLabelLayout?:{
  /** 距顶部的位置或间距。 */
  top:number;
  /** 距底部的位置或间距。 */
  bottom:number;
  /** 预设或自定义间距 */
  gap?:number;
  /** 距左侧的位置或间距。 */
  left?:number;
  /** 距右侧的位置或间距。 */
  right?:number};
  /** Controlled data transfer between charts in the same ChartComposite. */
  transferId?:string;
  /** 图表间转移数据值时调用。 */
  onValueTransfer?:ChartValueTransferHandler;
  /** 图表间数据转移失败时调用。 */
  onTransferError?:(message:string)=>void;
  /**
   * 是否显示辅助参考环。
   * @defaultValue false
   */
  showGuideRings?: boolean;
  /**
   * 图形外观配置。
   * @defaultValue "sia"
   */
  appearance?: "sia" | "macarons";
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /**
   * 数据更新动画的持续时间。
   * @defaultValue 500
   */
  animationDurationUpdate?: number;
  /** 图例布局配置。 */
  legendLayout?: {
  /** 横向位置或 X 轴数据值。 */
  x?:number;
  /** 纵向位置或 Y 轴数据值。 */
  y?:number;
  /** 组件的水平或垂直排列方向。 */
  orientation?:"horizontal"|"vertical";
  /** 交叉轴对齐 */
  align?:"start"|"center"|"end";
  /** 相邻项目的间距。 */
  itemGap?:number};
  /** 数据被交互修改后调用。 */
  onDataChange?: (series:readonly PieSeries[])=>void;
  /**
   用于渲染的数据集合。
   * @defaultValue EMPTY_PIE_DATA
   */
  data?: readonly PieDatum[];
  /** 图表数据系列。 */
  series?: readonly PieSeries[];
  /**
   * 环形图形的内半径。
   * @defaultValue 62
   */
  innerRadius?: number;
  /**
   * 环形图形的外半径。
   * @defaultValue 124
   */
  outerRadius?: number;
  /**
   * 是否启用南丁格尔玫瑰图模式。
   * @defaultValue false
   */
  rose?: boolean | "radius" | "area";
  /**
   * 中心位置。
   * @defaultValue [360,173]
   */
  center?: readonly [number, number];
  /**
   * 绘制起始角度。
   * @defaultValue -90
   */
  startAngle?: number;
  /**
   * 是否按顺时针方向绘制。
   * @defaultValue true
   */
  clockwise?: boolean;
  /**
   * 相邻扇区之间的间隔角度。
   * @defaultValue 0
   */
  padAngle?: number;
  /**
   * 是否显示图例。
   * @defaultValue true
   */
  showLegend?: boolean;
  /**
   * 是否允许通过图例切换系列显示。
   * @defaultValue true
   */
  legendInteractive?: boolean;
  /** 图例项目的选中状态。 */
  legendSelected?: Readonly<Record<string, boolean>>;
  /** 图例选中状态变化时调用。 */
  onLegendSelectionChange?: (selected: Record<string, boolean>) => void;
  /**
   * 是否显示数据标签。
   * @defaultValue true
   */
  showLabels?: boolean;
  /**
   * 是否显示标签引导线。
   * @defaultValue true
   */
  showLabelLines?: boolean;
  /** 中心区域显示的标签。 */
  centerLabel?: ReactNode;
  /**
   * 图形的选中模式。
   * @defaultValue false
   */
  selectedMode?: false | "single" | "multiple";
  /** 是否处于选中状态。 */
  selected?: readonly string[];
  /** 初始化时选中的图形或状态。 */
  defaultSelected?: readonly string[];
  /**
   * 选中扇区向外偏移的距离。
   * @defaultValue 9
   */
  selectedOffset?: number;
  /** 编辑器选区变化时调用。 */
  onSelectionChange?: (names: string[]) => void;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<PieDatum>) => void;
}

const EMPTY_PIE_DATA: readonly PieDatum[] = [];

/** 饼图组件。 */
export const PieChart = forwardRef<SiaChartRef, PieChartProps>(function PieChart(
  { pulseRing, calculable=false, markPoints=[], data = EMPTY_PIE_DATA, series, innerRadius = 62, outerRadius = 124, rose = false, center = [360,173], startAngle = -90, clockwise = true, padAngle = 0, showLegend = true, legendInteractive = true, legendSelected, onLegendSelectionChange, showLabels = true, showLabelLines = true, centerLabel, selectedMode = false, selected, defaultSelected, selectedOffset = 9, onSelectionChange, onDataClick, palette, toolbox, appearance = "sia", animationProgress, animationDurationUpdate = 500, legendLayout, showGuideRings = false, onDataChange, transferId,onValueTransfer,onTransferError,onValueDragOut,outsideLabelLayout, ...props }, ref,
) {
  const pieGradientId=useId().replace(/:/g,"");
  const [pieIslands,setPieIslands]=useState<{name:string;value:number;x:number;y:number;color:string}[]>([]);
  const sourceRings = useMemo<readonly PieSeries[]>(()=>series?.length?series:[{data,innerRadius,outerRadius,rose,showLabels}],[series,data,innerRadius,outerRadius,rose,showLabels]);
  const [editableRings,setEditableRings]=useState(sourceRings);
  const valueDrag=useRef<{key:string;x:number;y:number;moved:boolean}|null>(null);
  const [valueOffset,setValueOffset]=useState<{key:string;x:number;y:number}>();
  useEffect(()=>setEditableRings(sourceRings),[sourceRings]);
  const allData=editableRings.flatMap(ring=>ring.data).filter(item=>!item.missing);
  const names=[...new Set(allData.map(item=>item.name))];
  const legend=useLegendSelection(names,legendSelected,onLegendSelectionChange);
  const [magicType,resolvedToolbox]=useToolboxMagicType(toolbox,"饼图");
  const [hovered,setHovered]=useState<string>();
  const [internalSelected,setInternalSelected]=useState<string[]>(()=>[...(defaultSelected??allData.filter(item=>item.selected).map(item=>item.name))]);
  const selectedNames=selected??internalSelected;
  const legacy=appearance==="macarons";
  const colorNames=[...new Set(allData.filter(item=>item.showInLegend!==false).map(item=>item.name))];
  const colorFor=(item:PieDatum)=>getColor(Math.max(0,colorNames.indexOf(item.name)),item.color,palette);
  const chartToolbox=typeof resolvedToolbox==="object"?{
    ...resolvedToolbox,
    dataView:resolvedToolbox.dataView??<ChartDataEditor readOnly={resolvedToolbox.dataViewReadOnly} series={editableRings.map((ring,i)=>({name:ring.name??`系列 ${i+1}`,data:ring.data.map(item=>item.missing?null:item.value)}))} onApply={values=>{
      const next=editableRings.map((ring,i)=>({...ring,data:ring.data.map((item,j)=>({...item,missing:values[i]![j]===null,value:Math.max(0,values[i]![j]??0)}))}));
      setEditableRings(next);onDataChange?.(next);
    }} />,
    onRestore:()=>{
      setEditableRings(sourceRings);setHovered(undefined);setPieIslands([]);
      legend.replace(Object.fromEntries(names.map(name=>[name,true])));
      if(!selected)setInternalSelected([...(defaultSelected??sourceRings.flatMap(ring=>ring.data).filter(item=>item.selected).map(item=>item.name))]);
      resolvedToolbox.onRestore?.();
    },
  }:resolvedToolbox;
  function toggle(name:string,mode:PieChartProps["selectedMode"]) {
    if(!mode)return;
    const next=mode==="single"?(selectedNames.includes(name)?[]:[name]):selectedNames.includes(name)?selectedNames.filter(item=>item!==name):[...selectedNames,name];
    if(!selected)setInternalSelected(next);onSelectionChange?.(next);
  }
  const legendData=[...new Map(allData.filter(item=>item.showInLegend!==false).map(item=>[item.name,item])).values()];
  if(/funnel|漏斗/i.test(magicType))return <FunnelChart {...props} ref={ref} series={editableRings.map(ring=>({name:ring.name,data:ring.data}))} showLegend={showLegend} legendInteractive={legendInteractive} legendSelected={legend.selected} onLegendSelectionChange={legend.replace} onDataClick={onDataClick} palette={palette} toolbox={chartToolbox} />;
  return <SiaChart {...props} className={`${props.className??""}${legacy?" sia-chart--macarons":""}`} ref={ref} palette={palette} toolbox={chartToolbox} empty={!allData.length||allData.every(item=>item.value<=0)} ariaLabel={props.ariaLabel??"饼图"}>
    {showLegend?<ChartLegend rowGap={legacy?18:undefined} maxWidth={legacy?(props.viewBoxSize?.[0]??720)-20:undefined} symbol={legacy?"sector":"rect"} x={legendLayout?.x??360} y={legendLayout?.y??330} align={legendLayout?.align} orientation={legendLayout?.orientation} itemGap={legendLayout?.itemGap} items={legendData.map(item=>({name:item.name,color:colorFor(item),disabled:!legend.isSelected(item.name)}))} selected={legend.selected} onItemClick={legendInteractive?legend.toggle:undefined}/>:null}
    {editableRings.flatMap((ring,ringIndex)=>{
      const visible=ring.data.filter(item=>!item.missing&&legend.isSelected(item.name));
      const ringCenter=ring.center??center;
      const ringInner=ring.innerRadius??(series?14+ringIndex*116/editableRings.length:innerRadius);
      const ringOuter=ring.outerRadius??(series?14+(ringIndex+1)*116/editableRings.length-3:outerRadius);
      const direction=ring.clockwise??clockwise;
      const geometry=layoutPieValues(visible.map(item=>item.value),{innerRadius:ringInner,outerRadius:ringOuter,rose:ring.rose??rose,startAngle:ring.startAngle??startAngle,clockwise:direction,padAngle});
      const labelYs=outsideLabelLayout?layoutPieLabelY(geometry.map(arc=>({y:ringCenter[1]+Math.sin(arc.middle)*(arc.radius+20),right:Math.cos(arc.middle)>=0,visible:arc.sweep>0})),outsideLabelLayout.top,outsideLabelLayout.bottom,outsideLabelLayout.gap):undefined;
const marks=visible.map((item,index)=>{
        const arc=geometry[index]!;
        const key=`${ringIndex}-${ring.data.indexOf(item)}-${item.name}`;
        const isHovered=hovered===key;
        const mode=ring.selectedMode??selectedMode;
        const offset=mode&&selectedNames.includes(item.name)?selectedOffset:0;
        const cx=ringCenter[0]+Math.cos(arc.middle)*offset,cy=ringCenter[1]+Math.sin(arc.middle)*offset;
        const color=isHovered?(item.emphasisColor??colorFor(item)):colorFor(item);
        const gradient=isHovered?(item.emphasisGradient??ring.emphasisGradient??item.gradient):item.gradient;
        const gradientId=`${pieGradientId}-${ringIndex}-${index}`;
        const inside=ring.labelPosition==="inside";
        const labelLine={...ring.labelLine,...item.labelLine,...(isHovered?{...ring.emphasisLabelLine,...item.emphasisLabelLine}:{})};
        const labelRadius=inside?(arc.inner+arc.radius)/2:(legacy&&(ring.rose??rose)?ringOuter:arc.radius)+(labelLine.length??20);
        const lx=labelYs&&!inside?cx+(Math.cos(arc.middle)>=0?1:-1)*(ringOuter+12):cx+Math.cos(arc.middle)*labelRadius;
        const ly=labelYs&&!inside?labelYs[index]!:cy+Math.sin(arc.middle)*labelRadius;
        const right=Math.cos(arc.middle)>=0;
        const naturalLabelX=inside?lx:lx+(right?24:-24);
        // Conservative glyph width; optional bounds leave existing layouts unchanged.
        const labelWidth=Array.from(item.name).reduce((sum,char)=>sum+(char.codePointAt(0)!>255?12:8),0);
        const labelX=!inside&&outsideLabelLayout?.left!==undefined&&outsideLabelLayout.right!==undefined
          ?Math.max(outsideLabelLayout.left+(right?0:labelWidth),Math.min(outsideLabelLayout.right-(right?labelWidth:0),naturalLabelX))
          :naturalLabelX;
        const normalLabel=item.showLabel??ring.showLabels??showLabels;
        const allowLabel=(isHovered?(item.showEmphasisLabel??ring.showEmphasisLabel??(normalLabel||ring.emphasisLabel==="outside")):normalLabel)&&arc.sweep>0;
        const labelFormatter=isHovered?(item.emphasisLabelFormatter??ring.emphasisLabelFormatter??item.labelFormatter??ring.labelFormatter):(item.labelFormatter??ring.labelFormatter);
        const labelText=labelFormatter?.(item,Number((arc.fraction*100).toFixed(2)))??item.name;
        const labelStyle={...(legacy?{fill:inside?"#fff":color,fontSize:12}:{}),...ring.labelStyle,...item.labelStyle,...(isHovered?{...ring.emphasisLabelStyle,...item.emphasisLabelStyle}:{})};
        const interactive=item.interactive!==false;
        const transferable=interactive&&(calculable||!!transferId&&(!!onValueTransfer||!!onValueDragOut));
        const moving=valueOffset?.key===key;
        return <ChartMark key={key} label={`${ring.name??"饼图"}，${item.name}，${item.value}`} style={{pointerEvents:!interactive||moving?'none':undefined,cursor:transferable?'move':undefined,touchAction:transferable?'none':undefined}} tabIndex={interactive?0:-1}
          data-pie-target={calculable?"slice":undefined} data-value-chart={transferable?transferId:undefined} data-value-series={ringIndex} data-value-index={ring.data.indexOf(item)}
          transform={moving?`translate(${valueOffset.x} ${valueOffset.y})`:undefined}
          onPointerDown={event=>{if(!transferable||event.button!==0)return;event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);valueDrag.current={key,x:event.clientX,y:event.clientY,moved:false};}}
          onPointerCancel={()=>{valueDrag.current=null;setValueOffset(undefined);}}
          tooltip={interactive?<><strong>{ring.name}</strong><span>{item.name}：{item.value} ({Number((arc.fraction*100).toFixed(2))}%)</span></>:undefined}
          onPointerMove={event=>{setHovered(key);const drag=valueDrag.current;if(!drag||drag.key!==key)return;if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<4)return;drag.moved=true;const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();if(!matrix)return;const start=new DOMPoint(drag.x,drag.y).matrixTransform(matrix.inverse()),end=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());setValueOffset({key,x:end.x-start.x,y:end.y-start.y});}} onPointerLeave={()=>setHovered(undefined)} onFocus={()=>setHovered(key)} onBlur={()=>setHovered(undefined)}
          onPointerUp={event=>{
            const drag=valueDrag.current;valueDrag.current=null;setValueOffset(undefined);
            if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
            if(drag?.moved&&calculable){const element=event.currentTarget;const hit=document.elementsFromPoint(event.clientX,event.clientY).map(node=>node.closest<SVGGElement>('[data-pie-target]')).find(node=>node&&node!==element&&node.ownerSVGElement===element.ownerSVGElement);try{const result=transferPieValue(editableRings.map(ring=>({...ring,data:ring.data.map(item=>({...item,value:item.missing?'-' as const:item.value}))})),{series:ringIndex,index:ring.data.indexOf(item)},hit?{series:Number(hit.getAttribute('data-value-series')),index:Number(hit.getAttribute('data-value-index'))}:null);const next=editableRings.map((ring,i)=>({...ring,data:result.series[i]!.data.map((datum,j)=>({...ring.data[j]!,name:datum.name,missing:datum.value==='-',value:datum.value==='-'?0:datum.value}))}));setEditableRings(next);onDataChange?.(next);setHovered(undefined);if(!hit&&result.island){const matrix=element.ownerSVGElement?.getScreenCTM();if(matrix){const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());const island=result.island;setPieIslands(current=>[...current,{...island,x:point.x,y:point.y,color}]);}}}catch(error){onTransferError?.(error instanceof Error?error.message:String(error));}return;}
            if(drag?.moved){const target=findCompositeValueTarget(event.currentTarget,event.clientX,event.clientY);if(target&&transferId)try{onValueTransfer?.({chart:transferId,series:ringIndex,index:ring.data.indexOf(item)},target);}catch(error){onTransferError?.(error instanceof Error?error.message:String(error));}if(!target&&onValueDragOut){const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();if(matrix){const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());onValueDragOut(ringIndex,ring.data.indexOf(item),[point.x,point.y]);}}return;}
            if(interactive){toggle(item.name,mode);onDataClick?.({name:item.name,value:item.value,seriesName:ring.name,data:item,nativeEvent:event});}
          }} onKeyDown={event=>{if(interactive&&(event.key==="Enter"||event.key===" ")){event.preventDefault();toggle(item.name,mode);}}}>
          {gradient?<defs><radialGradient id={gradientId} gradientUnits="userSpaceOnUse" cx={gradient.center[0]} cy={gradient.center[1]} r={gradient.outerRadius}>{gradient.stops.map((stop,index)=>{const inner=Math.max(0,Math.min(1,(gradient.innerRadius??0)/gradient.outerRadius));return <stop key={index} offset={inner+(1-inner)*stop.offset} stopColor={stop.color}/>;})}</radialGradient></defs>:null}
          <ChartPointMotion points={[[0,arc.start],[0,arc.end]]} enabled={props.animation!==false} duration={props.animationDuration??2000} updateDuration={animationDurationUpdate} progress={animationProgress}>{frame=><path d={svgArcPath(cx,cy,arc.radius,frame[0]![1],frame[1]![1],arc.inner,direction)} fill={gradient?`url(#${gradientId})`:color} stroke={legacy?"#fff":undefined} strokeWidth={legacy?1:undefined} className="sia-chart__sector" style={{animation:"none",transform:legacy?"none":undefined}} />}</ChartPointMotion>
          {allowLabel&&!inside&&(labelLine.show??showLabelLines)?<path d={`M ${cx+Math.cos(arc.middle)*arc.radius} ${cy+Math.sin(arc.middle)*arc.radius} L ${lx} ${ly} L ${labelX+(right?-4:4)} ${ly}`} fill="none" stroke={color} className="sia-chart__pie-label-line" style={labelLine.style}/>:null}
          {allowLabel?<text x={labelX} y={ly+4} textAnchor={inside?"middle":right?"start":"end"} className="sia-chart__pie-label" style={labelStyle}>{labelText.split('\n').map((line,lineIndex)=><tspan key={lineIndex} x={labelX} dy={lineIndex?'1.2em':0}>{line}</tspan>)}</text>:null}
          {isHovered&&ring.emphasisLabel==="center"?<text x={ringCenter[0]} y={ringCenter[1]+10} textAnchor="middle" fontSize={30} fontWeight="bold" fill={color} style={{...ring.emphasisLabelStyle,...item.emphasisLabelStyle}} pointerEvents="none">{labelText}</text>:null}
        </ChartMark>;
      });
      return [calculable?<path key={`case-${ringIndex}`} data-pie-target="case" data-value-series={ringIndex} data-value-index={-1} d={svgArcPath(ringCenter[0],ringCenter[1],ringOuter+10,-Math.PI/2,Math.PI*1.5,ringInner<=10?0:ringInner-10,true)} fill="transparent" stroke="#ccc" strokeWidth={1} pointerEvents="all"/>:null,showGuideRings?<g key={`guide-${ringIndex}`} fill="none" stroke="#ccc" strokeWidth={1} pointerEvents="none"><circle cx={ringCenter[0]} cy={ringCenter[1]} r={ringOuter+10}/>{ringInner>10?<circle cx={ringCenter[0]} cy={ringCenter[1]} r={ringInner-10}/>:null}</g>:null,...marks,ring.centerLabel?<foreignObject key={`center-${ringIndex}`} x={ringCenter[0]-60} y={ringCenter[1]-30} width={120} height={60}><div className="sia-chart__center-label">{ring.centerLabel}</div></foreignObject>:null];
    })}
    {centerLabel?<foreignObject x={center[0]-100} y={center[1]-45} width={200} height={90}><div className="sia-chart__center-label">{centerLabel}</div></foreignObject>:null}
    {pulseRing?<ChartPulseRing {...pulseRing} enabled={props.animation!==false&&pulseRing.enabled!==false}/>:null}
    {calculable?pieIslands.map((island,index)=><ChartValueIsland key={index} {...island} resolveTarget={(element,x,y)=>{const hit=document.elementsFromPoint(x,y).map(node=>node.closest<SVGElement>('[data-pie-target]')).find(node=>node&&node.ownerSVGElement===element.ownerSVGElement);return hit?{chart:'pie',series:Number(hit.getAttribute('data-value-series')),index:Number(hit.getAttribute('data-value-index'))}:null;}} onDrop={(target,point)=>{if(!target){setPieIslands(current=>current.map((item,i)=>i===index?{...item,x:point[0],y:point[1]}:item));return;}try{const result=transferPieValue([...editableRings.map(ring=>({...ring,data:ring.data.map(item=>({...item,value:item.missing?'-' as const:item.value}))})),{data:[{name:island.name,value:island.value}]}],{series:editableRings.length,index:0},target);const next=editableRings.map((ring,i)=>({...ring,data:result.series[i]!.data.map((datum,j)=>({...ring.data[j],name:datum.name,missing:datum.value==='-',value:datum.value==='-'?0:datum.value}))}));setEditableRings(next);onDataChange?.(next);setPieIslands(current=>current.filter((_,i)=>i!==index));}catch(error){onTransferError?.(error instanceof Error?error.message:String(error));}}}/>):null}
    {markPoints.map((mark,index)=>{const coordinate=(value:number|string,length:number)=>typeof value==='number'?value:parseFloat(value)*length/100;const x=coordinate(mark.x,props.viewBoxSize?.[0]??720),y=coordinate(mark.y,props.viewBoxSize?.[1]??360),radius=mark.radius??10,color=mark.color??'#dc69aa',key=`mark-${index}`;return <ChartScatterMotion key={key} x={x} y={y} radius={radius} enabled={props.animation!==false} duration={props.animationDuration??2000} progress={animationProgress}><ChartMark data-pie-mark={mark.name} label={`${mark.name}，${mark.value}`} tooltip={<><strong>{mark.name}</strong><span>{mark.value.toLocaleString('en-US')}</span></>} tooltipPoint={[x,y]} onPointerMove={()=>setHovered(key)} onPointerLeave={()=>setHovered(undefined)} onFocus={()=>setHovered(key)} onBlur={()=>setHovered(undefined)}><polygon points={chartStarPoints(x,y,radius*2,5).map(point=>point.join(',')).join(' ')} fill={color} stroke={color} strokeWidth={hovered===key?4:2}/><text x={x} y={y} dominantBaseline="central" textAnchor="middle" style={{fill:'#fff',fontSize:12,fontFamily:'微软雅黑, Arial, Verdana, sans-serif',pointerEvents:'none'}}>{mark.value.toLocaleString('en-US')}</text></ChartMark></ChartScatterMotion>;})}
  </SiaChart>;
});

/** 雷达图的一项指标，定义名称、范围及标签显示。 */
export interface RadarIndicator {
  /** 名称或字段标识。 */
  name: string;
  /** 允许的最大值。 */
  max?: number;
  /** 允许的最小值。 */
  min?: number;
}

/** Radar的数据系列。 */
export interface RadarSeries extends ChartSeries {
  /** 面积区域的填充渐变。 */
  areaGradient?:{
  /** 中心位置。 */
  center:readonly [number,number];
  /** 图形半径或圆角配置。 */
  radius:number;
  /** 将焦点移入控件。 */
  focus?:readonly [number,number];
  /** 渐变颜色停靠点集合。 */
  stops:readonly {
  /** 相对于默认位置的偏移。 */
  offset:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string}[]};
  /** 数据点图形符号。 */
  pointSymbol?:'circle'|'star';
  /** 数据点半径。 */
  pointRadius?:number;
  /** 按数据点及索引计算颜色的函数。 */
  pointColor?:(value:number,index:number)=>string|undefined;
  /** 是否显示数值标签。 */
  showValueLabels?:boolean;
  /** 数值标签格式化函数。 */
  valueLabelFormatter?:(value:number,index:number)=>string;
  /** 高亮线条宽度。 */
  emphasisLineWidth?:number;
  /** 高亮面积区域颜色。 */
  emphasisAreaColor?:string;
  /** 用于渲染的数据集合。 */
  data: readonly number[];
  /** 面积填充透明度。 */
  areaOpacity?: number;
  /** 线条样式。 */
  lineStyle?: "solid" | "dashed" | "dotted";
  /** 线条粗细。 */
  lineWidth?: number;
  /** 是否显示数据点。 */
  showPoints?: boolean;
}

/** 雷达图的坐标系面板配置。 */
export interface RadarPanel {
  /** 是否根据数据自动计算缩放范围。 */
  autoScale?:boolean;
  /** 缩放比例或比例尺配置。 */
  scale?:boolean;
  /** 轴端是否保留间隔，或两端间隔的配置。 */
  boundaryGap?:readonly [number,number];
  /** 坐标轴线颜色。 */
  axisColor?:string;
  /** 轴线粗细。 */
  axisWidth?:number;
  /** 分隔线颜色。 */
  splitLineColor?:string;
  /** 分隔线粗细。 */
  splitLineWidth?:number;
  /** 坐标轴分隔区域的填充颜色。 */
  splitAreaColors?:readonly string[];
  /** 指标文字或指示器颜色。 */
  indicatorColor?:string;
  /** 指标文字格式化函数。 */
  indicatorFormatter?:(name:string)=>string;
  /** 是否显示轴标签。 */
  showAxisLabels?:boolean;
  /** 坐标轴标签颜色。 */
  axisLabelColor?:string;
  /** 雷达图各指标的定义。 */
  indicators: readonly RadarIndicator[];
  /** 图表数据系列。 */
  series: readonly RadarSeries[];
  /** 中心位置。 */
  center?: readonly [number, number];
  /** 图形半径或圆角配置。 */
  radius?: number;
  /** 分层布局或雷达网格的层级配置。 */
  levels?: number;
  /** 外观形状。 */
  shape?: "polygon" | "circle";
  /** 绘制起始角度。 */
  startAngle?: number;
}

/** 雷达图的属性配置。 */
export interface RadarChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /**
   * 是否允许通过拖拽图形修改数据。
   * @defaultValue false
   */
  calculable?:boolean;
  /** 图表间数据转移失败时调用。 */
  onTransferError?:(message:string)=>void;
  /** 在指定文本范围显示错误、警告或信息波浪线 */
  markers?:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value:number;
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 是否使用空心样式。 */
  hollow?:boolean}[];
  /**
   * 图形外观配置。
   * @defaultValue "sia"
   */
  appearance?: "sia" | "macarons";
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /** 图例的排列顺序。 */
  legendOrder?: readonly string[];
  /** 图例布局配置。 */
  legendLayout?: {
  /** 横向位置或 X 轴数据值。 */
  x?:number;
  /** 纵向位置或 Y 轴数据值。 */
  y?:number;
  /** 组件的水平或垂直排列方向。 */
  orientation?:"horizontal"|"vertical";
  /** 交叉轴对齐 */
  align?:"start"|"center"|"end"};
  /** 数据被交互修改后调用。 */
  onDataChange?: (panels: readonly RadarPanel[]) => void;
  /**
   * 雷达图各指标的定义。
   * @defaultValue EMPTY_RADAR_INDICATORS
   */
  indicators?: readonly RadarIndicator[];
  /**
   * 图表数据系列。
   * @defaultValue EMPTY_RADAR_SERIES
   */
  series?: readonly RadarSeries[];
  /** 雷达坐标系集合。 */
  radars?: readonly RadarPanel[];
  /**
   * 分层布局或雷达网格的层级配置。
   * @defaultValue 5
   */
  levels?: number;
  /**
   * 是否显示图例。
   * @defaultValue true
   */
  showLegend?: boolean;
  /**
   * 是否允许通过图例切换系列显示。
   * @defaultValue true
   */
  legendInteractive?: boolean;
  /** 图例项目的选中状态。 */
  legendSelected?: Readonly<Record<string, boolean>>;
  /** 图例选中状态变化时调用。 */
  onLegendSelectionChange?: (selected: Record<string, boolean>) => void;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<RadarSeries>) => void;
}

const EMPTY_RADAR_INDICATORS: readonly RadarIndicator[]=[];
const EMPTY_RADAR_SERIES: readonly RadarSeries[]=[];
/** 雷达图组件。 */
export const RadarChart = forwardRef<SiaChartRef, RadarChartProps>(function RadarChart(
  { indicators = EMPTY_RADAR_INDICATORS, series = EMPTY_RADAR_SERIES, radars, calculable=false, onTransferError, markers, levels = 5, showLegend = true, legendInteractive = true, legendSelected, onLegendSelectionChange, onDataClick, palette, toolbox, appearance="sia", animationProgress, legendOrder, legendLayout, onDataChange, ...props }, ref,
) {
  const legacy=appearance==="macarons";
  const initialPanels=useMemo(()=>radars?.length?radars:[{indicators,series,levels}],[radars,indicators,series,levels]);
  const [sourcePanels,setSourcePanels]=useState<readonly RadarPanel[]>(initialPanels);
  const [hoveredRadar,setHoveredRadar]=useState<string|null>(null);
  const radarPaintId=`sia-radar-${useId().replaceAll(':','')}`;
  const radarDrag=useRef<{panel:number;series:number;x:number;y:number;moved:boolean}|null>(null);
  const [radarOffset,setRadarOffset]=useState<{panel:number;series:number;x:number;y:number}|null>(null);
  useEffect(()=>{setSourcePanels(initialPanels);radarDrag.current=null;setRadarOffset(null);},[initialPanels]);

  const allSeries = sourcePanels.flatMap((panel) => panel.series);
  const legend = useLegendSelection(allSeries.map((item) => item.name), legendSelected, onLegendSelectionChange);
  const legendSeries=[...new Map(allSeries.map(item=>[item.name,item])).values()];
  if(legendOrder)legendSeries.sort((a,b)=>legendOrder.indexOf(a.name)-legendOrder.indexOf(b.name));
  const chartToolbox=typeof toolbox==="object"?{...toolbox,dataView:<ChartDataEditor series={allSeries} onApply={values=>{let cursor=0;const next=sourcePanels.map(panel=>({...panel,series:panel.series.map(item=>({...item,data:values[cursor++]!}))}));setSourcePanels(next);onDataChange?.(next);}}/>,onRestore:()=>{radarDrag.current=null;setRadarOffset(null);setHoveredRadar(null);setSourcePanels(initialPanels);legend.replace(Object.fromEntries(allSeries.map(item=>[item.name,true])));toolbox.onRestore?.();}}:toolbox;
  const panels = sourcePanels.map((panel) => {
    const visible=panel.series.filter(item=>legend.isSelected(item.name));
    const resolvedIndicators=panel.indicators.map((indicator,index)=>{
      if(!panel.autoScale||indicator.max!==undefined)return {...indicator,max:indicator.max??100};
      const bounds=radarDataBounds(visible.map(item=>item.data),index,{levels:panel.levels??levels,scale:panel.scale,boundaryGap:panel.boundaryGap});
      const ticks=radarNiceTicks(bounds.min,bounds.max,panel.levels??levels);
      return {...indicator,min:ticks.min,max:ticks.max};
    });
    return {...panel,indicators:resolvedIndicators,series:visible};
  });
  return <SiaChart {...props} className={`${props.className??""}${legacy?" sia-chart--macarons":""}`} toolbox={chartToolbox} ref={ref} palette={palette} empty={!sourcePanels.some((panel) => panel.indicators.length && panel.series.length)} ariaLabel={props.ariaLabel ?? "雷达图"}>
    {showLegend ? <ChartLegend x={legendLayout?.x??360} y={legendLayout?.y??20} orientation={legendLayout?.orientation} align={legendLayout?.align} symbol={legacy?"line":"rect"} itemGap={legacy?10:18} items={legendSeries.map((item, index) => ({ name: item.name, color: getColor(index, item.color, palette), disabled: !legend.isSelected(item.name) }))} selected={legend.selected} onItemClick={legendInteractive ? legend.toggle : undefined} /> : null}
    {markers?.map((marker,index)=>{
      const size=marker.size??32,x=marker.x,y=marker.y-size*.25,a=size*.5,b=size;
      const path=`M ${x} ${y} C ${x+a/2} ${y-2*b/3} ${x+2*a} ${y+b/3} ${x} ${y+b} C ${x-2*a} ${y+b/3} ${x-a/2} ${y-2*b/3} ${x} ${y} Z`;
      const color=marker.color??'#d87a80';
      return <ChartMark key={index} label={`${marker.name}，${marker.value}`} tooltip={<TooltipValue name={marker.name} value={marker.value}/>} tooltipPoint={[marker.x,marker.y]}><path className="sia-chart__radar-marker" d={path} fill={marker.hollow?'#fff':color} stroke={color} strokeWidth={2}/><text x={marker.x} y={marker.y+4} textAnchor="middle" style={{fill:marker.hollow?color:'#fff',fontSize:12}}>{marker.value}</text></ChartMark>;
    })}
    {panels.map((panel, panelIndex) => {
      const panelCenter = panel.center ?? (panels.length === 1 ? [360, 185] : [120 + panelIndex * 480 / Math.max(1, panels.length - 1), 185]);
      const panelRadius = panel.radius ?? (panels.length === 1 ? 118 : Math.min(88, 250 / panels.length));
      const panelLevels = panel.levels ?? levels;
      const start = (panel.startAngle ?? -90) / 180 * Math.PI;
      const pointAt = (index: number, ratio: number) => {
        const angle = start + (legacy?-1:1)*index / Math.max(1, panel.indicators.length) * Math.PI * 2;
        return [panelCenter[0] + Math.cos(angle) * panelRadius * ratio, panelCenter[1] + Math.sin(angle) * panelRadius * ratio] as const;
      };
      return <g key={panelIndex}>
        {calculable?(panel.shape==='circle'?<circle data-radar-drop-panel={panelIndex} cx={panelCenter[0]} cy={panelCenter[1]} r={panelRadius} fill="transparent"/>:<polygon data-radar-drop-panel={panelIndex} points={panel.indicators.map((_,index)=>pointAt(index,1).join(',')).join(' ')} fill="transparent"/>):null}
        {panel.splitAreaColors?.length?Array.from({length:panelLevels},(_,level)=>{
          const boundary=(ratio:number)=>{const r=panelRadius*ratio;if(!r)return '';if(panel.shape==='circle')return `M ${panelCenter[0]-r} ${panelCenter[1]} a ${r} ${r} 0 1 0 ${r*2} 0 a ${r} ${r} 0 1 0 ${-r*2} 0 Z`;return panel.indicators.map((_,index)=>`${index?'L':'M'} ${pointAt(index,ratio).join(' ')}`).join(' ')+' Z';};
          return <path key={level} className="sia-chart__radar-band" d={`${boundary((level+1)/panelLevels)} ${boundary(level/panelLevels)}`} fillRule="evenodd" fill={panel.splitAreaColors![level%panel.splitAreaColors!.length]} />;
        }):null}
        {Array.from({ length: panelLevels }, (_, index) => {const level=legacy?panelLevels-1-index:index;const style={fill:panel.splitAreaColors?.length?'none':legacy?(level%2?"rgba(200,200,200,.25)":"rgba(250,250,250,.5)"):undefined,stroke:panel.splitLineColor??(legacy?'#ddd':undefined),strokeWidth:panel.splitLineWidth};return panel.shape === "circle"
          ? <circle key={level} cx={panelCenter[0]} cy={panelCenter[1]} r={panelRadius * (level + 1) / panelLevels} style={style} className="sia-chart__radar-grid" />
          : <polygon key={level} points={panel.indicators.map((_, index) => pointAt(index, (level + 1) / panelLevels).join(",")).join(" ")} style={style} className="sia-chart__radar-grid" />;})}
        {panel.indicators.map((indicator, index) => {
          const edge = pointAt(index, 1);
          const label = pointAt(index, legacy?1+15/panelRadius:1.18);
          return <g key={`${indicator.name}-${index}`}><line x1={panelCenter[0]} y1={panelCenter[1]} x2={edge[0]} y2={edge[1]} style={{stroke:panel.axisColor,strokeWidth:panel.axisWidth}} className="sia-chart__grid-line" /><text x={label[0]} y={label[1] + 4} textAnchor={Math.abs(label[0] - panelCenter[0]) < 4 ? "middle" : label[0] > panelCenter[0] ? "start" : "end"} style={{fill:panel.indicatorColor}} className="sia-chart__radar-label">{panel.indicatorFormatter?.(indicator.name)??indicator.name}</text>{panel.showAxisLabels?Array.from({length:panelLevels+1},(_,tick)=>{const point=pointAt(index,tick/panelLevels),min=indicator.min??0,value=min+(indicator.max-min)*tick/panelLevels;return <text key={tick} x={point[0]+5} y={point[1]+4} className="sia-chart__radar-axis-label" style={{fill:panel.axisLabelColor??'#ccc',fontSize:12}}>{Number(value.toPrecision(12))}</text>;}):null}</g>;
        })}
        {panel.series.map((item, seriesIndex) => {
          const points = panel.indicators.map((indicator, index) => {
            const minimum = indicator.min ?? 0;
            return pointAt(index, radarRatio(item.data[index],minimum,indicator.max));
          });
          const color = getColor(legendSeries.findIndex(s=>s.name===item.name), item.color, palette);
          const hoverKey=`${panelIndex}-${item.name}-${seriesIndex}`,emphasis=hoveredRadar===hoverKey?item.emphasisAreaColor:undefined;
          const gradient=item.areaGradient,gradientId=`${radarPaintId}-${panelIndex}-${seriesIndex}`;
          const originalIndex=sourcePanels[panelIndex]!.series.indexOf(item),dragging=radarOffset?.panel===panelIndex&&radarOffset.series===originalIndex;
          return <ChartMark data-radar-panel={panelIndex} data-radar-series={originalIndex} transform={dragging?`translate(${radarOffset.x} ${radarOffset.y})`:undefined} style={{cursor:calculable?'move':undefined,pointerEvents:dragging?'none':undefined}} onPointerDown={event=>{
            if(!calculable||event.button!==0)return;
            event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
            radarDrag.current={panel:panelIndex,series:originalIndex,x:event.clientX,y:event.clientY,moved:false};
          }} onPointerMove={event=>{
            const drag=radarDrag.current;if(!drag||drag.panel!==panelIndex||drag.series!==originalIndex)return;
            const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<4)return;
            drag.moved=true;const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();if(!matrix)return;
            const inverse=matrix.inverse(),start=new DOMPoint(drag.x,drag.y).matrixTransform(inverse),end=new DOMPoint(event.clientX,event.clientY).matrixTransform(inverse);
            setRadarOffset({panel:panelIndex,series:originalIndex,x:end.x-start.x,y:end.y-start.y});
          }} onPointerCancel={()=>{radarDrag.current=null;setRadarOffset(null);}} key={`${item.name}-${seriesIndex}`} onPointerEnter={()=>setHoveredRadar(hoverKey)} onPointerLeave={()=>setHoveredRadar(null)} onFocus={()=>setHoveredRadar(hoverKey)} onBlur={()=>setHoveredRadar(null)} label={`${item.name}，${item.data.join("，")}`} tooltip={<><strong>{item.name}</strong>{panel.indicators.map((indicator, index) => <span key={indicator.name}>{indicator.name}：{item.data[index] ?? 0}</span>)}</>} tooltipPoint={panelCenter} onPointerUp={event=>{
            const drag=radarDrag.current;radarDrag.current=null;setRadarOffset(null);
            if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
            if(!drag?.moved){onDataClick?.({name:item.name,value:item.data,seriesName:item.name,data:item,nativeEvent:event});return;}
            const svg=event.currentTarget.ownerSVGElement;
            const hits=document.elementsFromPoint(event.clientX,event.clientY).filter(element=>svg?.contains(element));
            const hitSeries=hits.map(element=>element.closest('[data-radar-series]')).find(element=>element&&element!==event.currentTarget);
            const hitPanel=hits.map(element=>element.closest('[data-radar-drop-panel]')).find(Boolean);
            const target=hitSeries?{panel:Number(hitSeries.getAttribute('data-radar-panel')),series:Number(hitSeries.getAttribute('data-radar-series'))}:hitPanel?{panel:Number(hitPanel.getAttribute('data-radar-drop-panel'))}:null;
            try{const next=transferRadarSeries<RadarSeries,RadarPanel>(sourcePanels,drag,target);setSourcePanels(next);onDataChange?.(next);}catch(error){onTransferError?.(error instanceof Error?error.message:'雷达数据拖放失败');}
          }}>
            <ChartPointMotion origin={legacy?[panelCenter[0],panelCenter[1]]:undefined} points={[[panelCenter[0],panelCenter[1]],...points]} enabled={props.animation!==false} duration={props.animationDuration??2000} progress={animationProgress}>{frame=><g>
            {gradient?<defs><radialGradient id={gradientId} gradientUnits="userSpaceOnUse" cx={gradient.center[0]} cy={gradient.center[1]} r={gradient.radius} fx={gradient.focus?.[0]??gradient.center[0]} fy={gradient.focus?.[1]??gradient.center[1]}>{gradient.stops.map((stop,index)=><stop key={index} offset={stop.offset} stopColor={stop.color}/>)}</radialGradient></defs>:null}
            <polygon points={frame.slice(1).map((point) => point.join(",")).join(" ")} fill={emphasis??(gradient?`url(#${gradientId})`:color)} fillOpacity={emphasis?1:item.areaOpacity ?? (gradient?1:0.18)} stroke={color} strokeDasharray={item.lineStyle === "dashed" ? "7 5" : item.lineStyle === "dotted" ? "2 4" : undefined} style={{strokeWidth:hoveredRadar===hoverKey?(item.emphasisLineWidth??item.lineWidth):item.lineWidth}} className="sia-chart__radar-series" />
            {frame.slice(1).map((point,index)=>{
              const value=item.data[index]??0,pointColor=item.pointColor?.(value,index)??color,radius=item.pointRadius??(legacy?3:3.5);
              return <g key={index}>{item.showPoints!==false?(item.pointSymbol==='star'?<polygon className="sia-chart__radar-point" data-symbol="star" points={Array.from({length:10},(_,vertex)=>{const angle=-Math.PI/2+vertex*Math.PI/5,r=vertex%2?radius*.5:radius;return `${point[0]+Math.cos(angle)*r},${point[1]+Math.sin(angle)*r}`;}).join(' ')} fill={pointColor}/>:<circle className="sia-chart__radar-point" cx={point[0]} cy={point[1]} r={radius} fill={legacy?'#fff':pointColor} stroke={legacy?pointColor:undefined} strokeWidth={legacy?2:undefined}/>):null}{item.showValueLabels?<text className="sia-chart__radar-value" x={point[0]} y={point[1]-radius-5} textAnchor="middle" style={{fill:pointColor,fontSize:12}}>{item.valueLabelFormatter?.(value,index)??String(value)}</text>:null}</g>;
            })}
            </g>}</ChartPointMotion>
          </ChartMark>;
        })}
      </g>;
    })}
  </SiaChart>;
});

/** 弦图中的节点定义。 */
export interface ChordNode {
  /** 节点图形符号。 */
  nodeSymbol?:'circle'|'star';
  /** 唯一标识，用于关联实例或插件。 */
  id: string;
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
}

/** 弦图节点间的关系和权重。 */
export interface ChordLink {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?:string;
  /** 触发来源，用于区分不同入口的操作。 */
  source: string;
  /** 关联的目标元素或获取目标元素的函数。 */
  target: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
}

/** 弦图的属性配置。 */
export interface ChordChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** 矩阵弦图的外观配置。 */
  matrixAppearance?:MatrixChordAppearance;
  /** 节点几何形状配置。 */
  nodeGeometry?:{
  /** 中心位置。 */
  center:readonly [number,number];
  /** 节点环绕轨道的半径。 */
  orbitRadius:number;
  /** 允许的最小半径。 */
  minRadius:number;
  /** 允许的最大半径。 */
  maxRadius:number;
  /** 绘制起始角度。 */
  startAngle?:number};
  /** 矩阵图的数据系列。 */
  matrixSeries?:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string;
  /** 关系权重矩阵。 */
  matrix:readonly (readonly number[])[]}[];
  /**
   * 是否显示节点名称。
   * @defaultValue false
   */
  showNodeLabels?:boolean;
  /**
   * 是否沿节点方向旋转标签。
   * @defaultValue false
   */
  rotateNodeLabels?:boolean;
  /** 矩阵连线的标签配置。 */
  matrixLinkLabel?:(source:number,target:number)=>string;
  /** 矩阵图几何布局配置。 */
  matrixGeometry?:{
  /** 中心位置。 */
  center:readonly [number,number];
  /** 环形图形的内半径。 */
  innerRadius:number;
  /** 环形图形的外半径。 */
  outerRadius:number;
  /** 绘制起始角度。 */
  startAngle?:number};
  /**
   * 是否启用兼容模式的子分组排序。
   * @defaultValue false
   */
  legacySubSort?:boolean;
  /**
   * 是否显示刻度。
   * @defaultValue false
   */
  showScale?:boolean;
  /** 关系权重矩阵。 */
  matrix?:readonly (readonly number[])[];
  /**
   * 子分组排序方式。
   * @defaultValue 'none'
   */
  sortSub?:'none'|'ascending'|'descending';
  /** 图中节点的数据集合。 */
  nodes: readonly ChordNode[];
  /** 节点之间的连线集合。 */
  links: readonly ChordLink[];
  /**
   * 相邻扇区之间的间隔角度。
   * @defaultValue 0.035
   */
  padAngle?: number;
  /**
   * 弦带的外观与绘制配置。
   * @defaultValue true
   */
  ribbon?: boolean;
  /**
   * 是否按顺时针方向绘制。
   * @defaultValue true
   */
  clockwise?: boolean;
  /**
   * 数据或图形排序规则。
   * @defaultValue "none"
   */
  sort?: "ascending" | "descending" | "none";
  /** 节点点击回调 */
  onNodeClick?: (info: ChartDataClickInfo<ChordNode>) => void;
  /** 点击节点连线时调用。 */
  onLinkClick?: (info: ChartDataClickInfo<ChordLink>) => void;
}

/** 弦图组件。 */
export const ChordChart = forwardRef<SiaChartRef, ChordChartProps>(function ChordChart(
  { nodes, links, nodeGeometry,matrixAppearance,matrix,matrixSeries,showNodeLabels=false,rotateNodeLabels=false,matrixLinkLabel,matrixGeometry,legacySubSort=false,showScale=false,sortSub='none',padAngle = 0.035, ribbon = true, clockwise = true, sort = "none", onNodeClick, onLinkClick, palette, toolbox, ...props }, ref,
) {
  const [magicType, resolvedToolbox] = useToolboxMagicType(toolbox, "和弦");
  if (/force|力导向|关系/i.test(magicType)) return <GraphChart
    {...props}
    ref={ref}
    nodes={nodes.map(node=>({...node,symbol:node.nodeSymbol}))}
    links={links}
    layout="force"
    draggable
    palette={palette}
    toolbox={resolvedToolbox}
    onNodeClick={(info) => {
      const datum = nodes.find((node) => node.id === info.data.id);
      if (datum) onNodeClick?.({ ...info, data: datum });
    }}
  />;
  if(matrix||matrixSeries)return <SiaChart {...props} ref={ref} palette={palette} toolbox={resolvedToolbox} empty={!nodes.length||matrixSeries?.length===0}><MatrixChordPlot appearance={matrixAppearance} linkLabel={matrixLinkLabel} rotateNodeLabels={rotateNodeLabels} series={matrixSeries} showNodeLabels={showNodeLabels} geometry={matrixGeometry} legacySubSort={legacySubSort} showScale={showScale} names={nodes.map(n=>n.name)} matrix={matrix??[]} sort={sort} sortSub={sortSub} padAngle={padAngle} clockwise={clockwise} palette={palette}/></SiaChart>;
  if(!ribbon&&nodeGeometry)return <SiaChart {...props} ref={ref} palette={palette} toolbox={resolvedToolbox} empty={!nodes.length}><NodeChordPlot nodes={nodes} links={links} geometry={nodeGeometry} palette={palette} sort={sort} clockwise={clockwise} padAngle={padAngle} rotateLabels={rotateNodeLabels}/></SiaChart>;
  const center = [360, 182] as const;
  const outerRadius = 128;
  const innerRadius = 108;
  const weightedNodes = nodes.map((node) => ({ node, weight: node.value ?? links.reduce((sum, link) => sum + (link.source === node.id || link.target === node.id ? Math.max(0, link.value) : 0), 0) }));
  if (sort !== "none") weightedNodes.sort((left, right) => sort === "ascending" ? left.weight - right.weight : right.weight - left.weight);
  const sortedNodes = weightedNodes.map((item) => item.node);
  const weights = weightedNodes.map((item) => item.weight);
  const total = weights.reduce((sum, value) => sum + value, 0) || nodes.length;
  let angle = -Math.PI / 2;
  const direction = clockwise ? 1 : -1;
  const arcs = sortedNodes.map((node, index) => {
    const sweep = (Math.PI * 2 - padAngle * nodes.length) * (weights[index] || 1) / total;
    const arc = { node, start: angle, end: angle + direction * sweep, middle: angle + direction * sweep / 2, value: weights[index] || 1 };
    angle += direction * (sweep + padAngle);
    return arc;
  });
  const arcById = new Map(arcs.map((arc) => [arc.node.id, arc]));
  const maxLink = Math.max(1, ...links.map((link) => link.value));
  const point = (arc: (typeof arcs)[number], radius: number) => [center[0] + Math.cos(arc.middle) * radius, center[1] + Math.sin(arc.middle) * radius] as const;
  return <SiaChart {...props} ref={ref} palette={palette} toolbox={resolvedToolbox} empty={!nodes.length} ariaLabel={props.ariaLabel ?? "和弦图"}>
    {links.map((link, index) => {
      const source = arcById.get(link.source);
      const target = arcById.get(link.target);
      if (!source || !target) return null;
      const from = point(source, innerRadius);
      const to = point(target, innerRadius);
      const color = link.color ?? source.node.color ?? getColor(arcs.indexOf(source), undefined, palette);
      const sourceName = source.node.name;
      const targetName = target.node.name;
      const halfWidth = 2 + link.value / maxLink * 10;
      const sourceTangent = [-Math.sin(source.middle) * halfWidth, Math.cos(source.middle) * halfWidth] as const;
      const targetTangent = [-Math.sin(target.middle) * halfWidth, Math.cos(target.middle) * halfWidth] as const;
      const band = `M ${from[0] + sourceTangent[0]} ${from[1] + sourceTangent[1]} Q ${center[0]} ${center[1]} ${to[0] + targetTangent[0]} ${to[1] + targetTangent[1]} L ${to[0] - targetTangent[0]} ${to[1] - targetTangent[1]} Q ${center[0]} ${center[1]} ${from[0] - sourceTangent[0]} ${from[1] - sourceTangent[1]} Z`;
      return <ChartMark key={`${link.source}-${link.target}-${index}`} label={`${sourceName} 到 ${targetName}，${link.value}`} tooltip={<><strong>{sourceName} → {targetName}</strong><b>{formatChartNumber(link.value)}</b></>} tooltipPoint={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]} onPointerUp={(event) => onLinkClick?.({ name: `${sourceName} → ${targetName}`, value: link.value, data: link, nativeEvent: event })}>
        <path d={ribbon ? band : `M ${from[0]} ${from[1]} Q ${center[0]} ${center[1]} ${to[0]} ${to[1]}`} fill={ribbon ? color : "none"} stroke={color} strokeWidth={ribbon ? 1 : 2 + link.value / maxLink * 5} className="sia-chart__chord-link" />
      </ChartMark>;
    })}
    {arcs.map((arc, index) => {
      const color = getColor(index, arc.node.color, palette);
      const label = point(arc, outerRadius + 17);
      return <ChartMark key={arc.node.id} label={`${arc.node.name}，${formatChartNumber(arc.value)}`} tooltip={<TooltipValue name={arc.node.name} value={arc.value} />} tooltipPoint={point(arc, outerRadius)} onPointerUp={(event) => onNodeClick?.({ name: arc.node.name, value: arc.value, data: arc.node, nativeEvent: event })}>
        <path d={svgArcPath(center[0], center[1], outerRadius, arc.start, arc.end, innerRadius, clockwise)} fill={color} className="sia-chart__sector" />
        <text x={label[0]} y={label[1] + 4} textAnchor={label[0] > center[0] ? "start" : "end"} className="sia-chart__chord-label">{arc.node.name}</text>
      </ChartMark>;
    })}
  </SiaChart>;
});

/** 关系图中的节点数据及外观设置。 */
export interface GraphNode {
  /** 节点图片来源。 */
  imageSource?:string;
  /** 图片显示尺寸。 */
  imageSize?:readonly [number,number];
  /** 标签显示位置。 */
  labelPosition?:'inside'|'left'|'right'|'top'|'bottom';
  /** 是否允许拖拽。 */
  draggable?:boolean;
  /** 是否固定节点的 X 轴位置。 */
  fixX?:boolean;
  /** 是否固定节点的 Y 轴位置。 */
  fixY?:boolean;
  /** 标签文字颜色。 */
  labelColor?:string;
  /** 边框颜色。 */
  borderColor?:string;
  /** 边框线宽。 */
  borderWidth?:number;
  /** 图形半径或圆角配置。 */
  radius?:number;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?:string;
  /** 唯一标识，用于关联实例或插件。 */
  id: string;
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: number;
  /** 所属类目或分组。 */
  category?: string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 横向位置或 X 轴数据值。 */
  x?: number;
  /** 纵向位置或 Y 轴数据值。 */
  y?: number;
  /** 列固定位置，left 固定左侧，right 固定右侧。 */
  fixed?: boolean;
  /** 数据点或节点使用的图形符号。 */
  symbol?: "circle" | "square" | "diamond" | "star";
}

/** 关系图中的连线数据及外观设置。 */
export interface GraphLink {
  /** 显示箭头及是否指向触发器中心 */
  arrow?:boolean;
  /** 连线箭头尺寸。 */
  arrowSize?:readonly [number,number];
  /** 相对于默认位置的偏移。 */
  offset?:number;
  /** 曲线弯曲程度。 */
  curvature?:number;
  /** 触发来源，用于区分不同入口的操作。 */
  source: string;
  /** 关联的目标元素或获取目标元素的函数。 */
  target: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: number;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?: number;
  /** 是否使用虚线。 */
  dashed?: boolean;
}

/** 关系图的属性配置。 */
export interface GraphChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /**
   * 是否逐帧计算力导向布局。
   * @defaultValue false
   */
  progressiveForce?:boolean;
  /** 弦图布局参数。 */
  chordOptions?:Pick<ChordChartProps,'ribbon'|'nodeGeometry'|'rotateNodeLabels'>;
  /**
   * 地图或图表的平移、缩放配置。
   * @defaultValue false
   */
  roam?:boolean|'move';
  /** 力导向布局参数。 */
  forceOptions?:ForceLayoutOptions;
  /** 图中节点的数据集合。 */
  nodes: readonly GraphNode[];
  /** 节点之间的连线集合。 */
  links: readonly GraphLink[];
  /**
   * 布局方式。
   * @defaultValue "circular"
   */
  layout?: "force" | "circular";
  /**
   * 是否显示数据标签。
   * @defaultValue true
   */
  showLabels?: boolean;
  /**
   * 是否允许拖拽。
   * @defaultValue true
   */
  draggable?: boolean;
  /**
   * 是否允许通过图例切换系列显示。
   * @defaultValue true
   */
  legendInteractive?: boolean;
  /** 图例项目的选中状态。 */
  legendSelected?: Readonly<Record<string, boolean>>;
  /** 图例选中状态变化时调用。 */
  onLegendSelectionChange?: (selected: Record<string, boolean>) => void;
  /** 节点点击回调 */
  onNodeClick?: (info: ChartDataClickInfo<GraphNode>) => void;
}


/** 关系图组件。 */
export const GraphChart = forwardRef<SiaChartRef, GraphChartProps>(function GraphChart(
  { nodes, links, roam=false, chordOptions, forceOptions, progressiveForce=false, layout = "circular", showLabels = true, draggable = true, legendInteractive = true, legendSelected, onLegendSelectionChange, onNodeClick, palette, toolbox, ...props }, ref,
) {
  const categories = [...new Set(nodes.map((node) => node.category).filter((value): value is string => Boolean(value)))];
  const legend = useLegendSelection(categories, legendSelected, onLegendSelectionChange);
  const [magicType, resolvedToolbox] = useToolboxMagicType(toolbox, layout === "force" ? "力导向" : "关系");
  const [roamReset,setRoamReset]=useState(0);
  const chartToolbox = typeof resolvedToolbox === "object" ? {
    ...resolvedToolbox,
    onRestore: () => {
      legend.replace(Object.fromEntries(categories.map((name) => [name, true])));
      setRoamReset(value=>value+1);
      resolvedToolbox.onRestore?.();
    },
  } : resolvedToolbox;
  const activeNodes = useMemo(() => nodes.filter((node) => !node.category || legend.selected[node.category] !== false), [legend.selected, nodes]);
  const activeLinks = useMemo(() => {
    const activeIds = new Set(activeNodes.map((node) => node.id));
    return links.filter((link) => activeIds.has(link.source) && activeIds.has(link.target));
  }, [activeNodes, links]);
  const progressive=progressiveForce&&layout==='force'&&props.animation!==false&&!/chord|和弦/i.test(magicType);
  const calculatedPositions = useMemo(() => graphLayout(activeNodes, activeLinks, layout === "force"&&!progressive,forceOptions), [activeLinks, activeNodes, layout,forceOptions,progressive]);
  const [positions, setPositions] = useState(calculatedPositions);
  const [dragging, setDragging] = useState<number | null>(null);
  const heldNode=useRef<number|null>(null);
  const [forceRestart,setForceRestart]=useState(0);
  useEffect(() => {setPositions(calculatedPositions);setDragging(null);heldNode.current=null;}, [calculatedPositions,roamReset]);
  useEffect(()=>{
    if(!progressive||activeNodes.length>(forceOptions?.maxNodes??80))return;
    let frame=0,remaining=Math.max(0,forceOptions?.iterations??140),previous:number|undefined,carry=0;
    const tick=(time:number)=>{
      if(previous===undefined)previous=time;
      const budget=forceFrameBudget(carry,time-previous,remaining,forceOptions?.stepsPerFrame);previous=time;
      const steps=budget.steps;carry=budget.carry;remaining=budget.remaining;
      if(steps>0){
        const pinned=heldNode.current;
        const frameNodes=pinned===null?activeNodes:activeNodes.map((node,index)=>index===pinned?{...node,fixed:true}:node);
        setPositions(current=>advanceGraphLayout(frameNodes,activeLinks,current.length===activeNodes.length?current:calculatedPositions,{...forceOptions,iterations:steps}));
      }
      if(heldNode.current!==null)remaining=Math.max(remaining,forceOptions?.iterations??140);
      if(remaining>0)frame=requestAnimationFrame(tick);
    };
    if(remaining>0)frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[progressive,activeNodes,activeLinks,forceOptions,calculatedPositions,roamReset,forceRestart]);
  if (/chord|和弦/i.test(magicType)) return <ChordChart
    {...props}
    {...chordOptions}
    ref={ref}
    nodes={activeNodes}
    links={activeLinks.map((link) => ({ ...link, value: link.value ?? 1 }))}
    palette={palette}
    toolbox={chartToolbox}
    onNodeClick={(info) => {
      const datum = nodes.find((node) => node.id === info.data.id);
      if (datum) onNodeClick?.({ ...info, data: datum });
    }}
  />;
  const indexById = new Map(activeNodes.map((node, index) => [node.id, index]));
  const maxValue = Math.max(1, ...activeNodes.map((node) => node.value ?? 1));
  return <SiaChart {...props} ref={ref} palette={palette} toolbox={chartToolbox} empty={!nodes.length} ariaLabel={props.ariaLabel ?? "关系图"}>
    {categories.length ? <ChartLegend items={categories.map((name, index) => ({ name, color: getColor(index, undefined, palette), disabled: !legend.isSelected(name) }))} selected={legend.selected} onItemClick={legendInteractive ? legend.toggle : undefined} /> : null}
    <ChartRoamGroup enabled={Boolean(roam)} zoomEnabled={roam!=='move'} ariaLabel={roam==='move'?'关系图漫游画布：方向键平移，Home 还原':'关系图漫游画布：方向键平移，加减键缩放，Home 还原'} width={props.viewBoxSize?.[0]??720} height={props.viewBoxSize?.[1]??360} resetSignal={roamReset}>
    <g className="sia-chart__graph-links">
      {activeLinks.map((link, index) => {
        const sourceIndex = indexById.get(link.source);
        const targetIndex = indexById.get(link.target);
        if (sourceIndex == null || targetIndex == null) return null;
        const source = positions[sourceIndex]??calculatedPositions[sourceIndex];
        const target = positions[targetIndex]??calculatedPositions[targetIndex];
        if(!source||!target)return null;
        const targetNode=activeNodes[targetIndex]!;
        const targetRadius=targetNode.imageSource?(targetNode.imageSize?.[0]??60)/2:targetNode.radius??(11+Math.sqrt(Math.max(0,targetNode.value??1)/maxValue)*18);
        const reciprocal=link.arrow&&activeLinks.some(other=>other.source===link.target&&other.target===link.source);
        const geometry=graphLinkGeometry(source,target,{curvature:link.curvature,offset:link.offset??(reciprocal?4:0),arrow:link.arrow,arrowSize:link.arrowSize,targetRadius});
        return <ChartMark key={`${link.source}-${link.target}-${index}`} label={link.label??`${activeNodes[sourceIndex]!.name} → ${activeNodes[targetIndex]!.name}`} tooltip={<strong>{link.label??`${activeNodes[sourceIndex]!.name} → ${activeNodes[targetIndex]!.name}`}</strong>} tooltipPoint={[...geometry.center]}><path className="sia-chart__graph-link" d={geometry.path} fill="none" stroke={link.color??'var(--sia-chart-axis)'} strokeWidth={link.width ?? Math.max(1, Math.sqrt(link.value ?? 1))} strokeDasharray={link.dashed ? "6 4" : undefined} />{geometry.arrow?<polygon className="sia-chart__graph-arrow" points={geometry.arrow} fill={link.color??'var(--sia-chart-axis)'}/>:null}</ChartMark>;
      })}
    </g>
    {activeNodes.map((node, index) => {
      const position = positions[index] ?? calculatedPositions[index] ?? { x: 360, y: 180 } as ForcePoint;
      const categoryIndex = Math.max(0, categories.indexOf(node.category ?? ""));
      const color = getColor(categoryIndex || index, node.color, palette);
      const radius = node.radius??(11 + Math.sqrt(Math.max(0, node.value ?? 1) / maxValue) * 18);
      const halfWidth=node.imageSource?(node.imageSize?.[0]??60)/2:radius,halfHeight=node.imageSource?(node.imageSize?.[1]??60)/2:radius;
      const labelX=position.x+(node.labelPosition==='right'?halfWidth+5:node.labelPosition==='left'?-halfWidth-5:0);
      const labelY=position.y+4+(node.labelPosition==='top'?-halfHeight-10:node.labelPosition==='bottom'?halfHeight+10:0);
      return <ChartMark
        key={node.id}
        label={`${node.name}，${node.value ?? 0}`}
        tooltip={<TooltipValue name={node.name} series={node.category} value={node.value ?? 0} />}
        tooltipPoint={[position.x, position.y]}
        onPointerDown={(event) => {
          if (!(node.draggable??draggable) || node.fixed) return;
          event.stopPropagation();
          heldNode.current=index;
          setForceRestart(value=>value+1);
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(index);
        }}
        onPointerMove={(event) => {
          if (dragging !== index) return;
          const matrix = event.currentTarget.getScreenCTM();
          if (!matrix) return;
          const local = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
          const nextX = local.x,nextY=local.y;
          setPositions((current) => {
            const moved=current.map((point, pointIndex) => pointIndex === index ? { ...point, x: nextX, y: nextY,vx:0,vy:0 } : point);
            return progressive&&forceOptions?.model==='legacy'?reheatGraphLayout(moved,.8):moved;
          });
        }}
        onPointerUp={(event) => {
          if (dragging === index) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setDragging(null);
            heldNode.current=null;
            setForceRestart(value=>value+1);
          } else onNodeClick?.({ name: node.name, value: node.value ?? 0, seriesName: node.category, data: node, nativeEvent: event });
        }}
        onPointerCancel={()=>{setDragging(null);heldNode.current=null;setForceRestart(value=>value+1);}}
      >
        {node.imageSource ? <image className="sia-chart__graph-node" href={node.imageSource} x={position.x-halfWidth} y={position.y-halfHeight} width={halfWidth*2} height={halfHeight*2} preserveAspectRatio="none" /> : node.symbol === "star" ? <polygon data-symbol="star" points={Array.from({length:10},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/5,r=i%2?radius*.5:radius;return `${position.x+Math.cos(angle)*r},${position.y+Math.sin(angle)*r}`;}).join(" ")} fill={color} className="sia-chart__graph-node" style={{stroke:node.borderColor,strokeWidth:node.borderWidth}}/> : node.symbol === "square" ? <rect x={position.x - radius} y={position.y - radius} width={radius * 2} height={radius * 2} rx={4} fill={color} className="sia-chart__graph-node" style={{stroke:node.borderColor,strokeWidth:node.borderWidth}} /> : node.symbol === "diamond" ? <rect x={position.x - radius * .72} y={position.y - radius * .72} width={radius * 1.44} height={radius * 1.44} rx={3} transform={`rotate(45 ${position.x} ${position.y})`} fill={color} className="sia-chart__graph-node" style={{stroke:node.borderColor,strokeWidth:node.borderWidth}} /> : <circle cx={position.x} cy={position.y} r={radius} fill={color} className="sia-chart__graph-node" style={{stroke:node.borderColor,strokeWidth:node.borderWidth}} />}
        {showLabels ? <text x={labelX} y={labelY} textAnchor={node.labelPosition==='left'?'end':node.labelPosition==='right'?'start':'middle'} className="sia-chart__graph-label" style={node.labelColor?{fill:node.labelColor,fontWeight:400,textShadow:"none"}:undefined}>{(node.label??node.name).split('\n').map((line,i,lines)=><tspan key={i} x={labelX} dy={i===0?-(lines.length-1)*7:14}>{line}</tspan>)}</text> : null}
      </ChartMark>;
    })}
    </ChartRoamGroup>
  </SiaChart>;
});

/** 力导向关系图组件。 */
export const ForceGraphChart = forwardRef<SiaChartRef, Omit<GraphChartProps, "layout">>(function ForceGraphChart(props, ref) {
  return <GraphChart {...props} layout="force" ref={ref} />;
});

/** 力导向图组件。 */
export const ForceChart = ForceGraphChart;

/** GeoJSON 单多边形几何数据。 */
export interface GeoJsonPolygonGeometry {
  /** 类型标识，用于选择对应的表现形式。 */
  type: "Polygon";
  /** 坐标序列。 */
  coordinates: readonly (readonly (readonly [number, number])[])[];
}

/** GeoJSON 多多边形几何数据。 */
export interface GeoJsonMultiPolygonGeometry {
  /** 类型标识，用于选择对应的表现形式。 */
  type: "MultiPolygon";
  /** 坐标序列。 */
  coordinates: readonly (readonly (readonly (readonly [number, number])[])[])[];
}

/** 带业务属性的 GeoJSON 地理要素。 */
export interface GeoJsonFeature {
  /** 类型标识，用于选择对应的表现形式。 */
  type: "Feature";
  /** 附加属性，例如 GeoJSON 要素的业务字段。 */
  properties: Readonly<Record<string, unknown>> & {
  /** 名称或字段标识。 */
  name?: string };
  /** 图形几何形状及布局参数。 */
  geometry: GeoJsonPolygonGeometry | GeoJsonMultiPolygonGeometry;
}

/** GeoJSON 地理要素集合。 */
export interface GeoJsonFeatureCollection {
  /** 类型标识，用于选择对应的表现形式。 */
  type: "FeatureCollection";
  /** 工具箱中启用的功能项。 */
  features: readonly GeoJsonFeature[];
}

/** Map的单条数据。 */
export interface MapDatum extends MapRegionAppearance {
  /** 图例使用的符号集合。 */
  legendSymbols?: readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string}[];
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 是否处于选中状态。 */
  selected?: boolean;
}

/** 地图上标记点的坐标、内容和外观配置。 */
export interface MapMarkPoint {
  /** 入场动画配置。 */
  entrance?:boolean;
  /** 定位标记的形状。 */
  pinShape?:'curved'|'arc';
  /** SVG coordinates bypass geographic projection (and still follow the map group transform). */
  coordinateSpace?:'geographic'|'svg';
  /** 图片资源地址。 */
  imageSrc?:string;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?:ReactNode;
  /** 标签文字样式。 */
  labelStyle?:CSSProperties;
  /** 高亮时是否显示标签。 */
  showEmphasisLabel?:boolean;
  /** 缩放动画效果。 */
  scaleEffect?:{
  /** 显示或动画持续时间，单位以所在组件约定为准。 */
  duration:number;
  /** 缩放后的尺寸比例。 */
  scaleSize?:number};
  /** 数据到颜色、大小等视觉通道的映射配置。 */
  visualMap?:boolean;
  /** 数据点或节点使用的图形符号。 */
  symbol?:'circle'|'emptyCircle'|'pin';
  /** 数据系列名称。 */
  seriesName?:string;
  /** 组件根节点的内联样式。 */
  style?:CSSProperties;
  /** 高亮状态样式。 */
  emphasisStyle?:CSSProperties;
  /** 名称或字段标识。 */
  name: string;
  /** 图表坐标位置或坐标转换配置。 */
  coordinate: readonly [number, number];
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: number;
  /** 滚动或淡入效果 */
  effect?: boolean;
}

/** 地图上标记连线的端点、样式和动态效果配置。 */
export interface MapMarkLine {
  /** 图形逐步显示的动画配置。 */
  reveal?:{
  /** 首次显示动画的持续时间。 */
  initialDuration?:number;
  /** 更新动画的持续时间。 */
  updateDuration?:number};
  /** 线条样式。 */
  lineStyle?:CSSProperties;
  /** 阴影模糊半径。 */
  shadowBlur?:number;
  /** 连线端点样式。 */
  endpointStyle?:CSSProperties;
  /** 连线起点和终点使用的图形符号。 */
  endpointSymbols?:readonly ['none'|'circle','circle'|'arrow'];
  /** 数据到颜色、大小等视觉通道的映射配置。 */
  visualMap?:boolean;
  /** 曲线的绘制模式。 */
  curveMode?:'directional';
  /** 沿路径移动的动态效果配置。 */
  movingEffect?:{
  /** 周期动画的周期时长。 */
  period?:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 图形半径或圆角配置。 */
  radius?:number;
  /** 阴影模糊半径。 */
  shadowBlur?:number;
  /** 阴影颜色。 */
  shadowColor?:string;
  /** 轨迹残影的透明度。 */
  trailAlpha?:number};
  /** 数据系列名称。 */
  seriesName?:string;
  /** 是否使用虚线。 */
  dashed?:boolean;
  /** 连线两端的符号尺寸。 */
  endpointSizes?:readonly [number,number];
  /** 提示内容或提示框配置。 */
  tooltip?:ReactNode;
  /** 名称或字段标识。 */
  name?: string;
  /** 触发来源，用于区分不同入口的操作。 */
  source: readonly [number, number];
  /** 关联的目标元素或获取目标元素的函数。 */
  target: readonly [number, number];
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?: number;
  /** 连线曲率。 */
  curveness?: number;
  /** 滚动或淡入效果 */
  effect?: boolean;
}

/** 地图的属性配置。 */
export interface MapChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** Host map projection into overlay pixels. Re-render when the host viewport changes. */
  overlayProjection?:{
  /** 将数据或地理坐标投影为绘图坐标。 */
  project:(coordinate:readonly [number,number])=>readonly [number,number];
  /** 相对于默认位置的偏移。 */
  offset?:readonly [number,number]};
  /** 捆绑连线配置。 */
  bundledLines?:BundledMapLines;
  /**
   * 标记线动态效果使用的渲染器。
   * @defaultValue 'svg'
   */
  markLineEffectRenderer?:'svg'|'canvas';
  /** Batched point groups; points are geographic longitude/latitude pairs. */
  largeMarkPoints?:readonly LargeMapPointCanvasGroup[];
  /** 地图嵌入区域的样式。 */
  insetStyle?:CSSProperties;
  /** 地图嵌入区域的标签样式。 */
  insetLabelStyle?:CSSProperties;
  /**
   * 地图区域是否响应悬停。
   * @defaultValue true
   */
  regionHoverable?:boolean;
  /** 标记点提示框格式化函数。 */
  markPointTooltipFormatter?:(point:MapMarkPoint)=>ReactNode;
  /**
   * 是否将视觉映射值限制在配置范围内。
   * @defaultValue false
   */
  clampVisualValues?:boolean;
  /** 滚轮缩放的倍率配置。 */
  wheelZoomFactors?:readonly [number,number];
  /** Hide the map series while retaining title and value-range controls. */
  showMap?:boolean;
  /** 超出视觉映射范围时的颜色。 */
  outOfRangeColor?: string;
  /**
   * 地图漫游控制器配置。
   * @defaultValue false
   */
  roamController?: boolean;
  /** 视觉映射控件的布局配置。 */
  visualMapLayout?: {
  /** 拖动过程中是否实时通知值变化。 */
  realtime?:boolean;
  /** 是否使用 SVG 绘制交互手柄。 */
  svgHandles?:boolean;
  /** 横向位置或 X 轴数据值。 */
  x?:number;
  /** 纵向位置或 Y 轴数据值。 */
  y?:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height?:number;
  /** 组件的水平或垂直排列方向。 */
  orientation?:'horizontal'|'vertical';
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?:string;
  /** 范围两端显示的标签。 */
  endLabels?:readonly [string,string]};
  /** 标签文字样式。 */
  labelStyle?: CSSProperties;
  /** 高亮状态的标签样式。 */
  emphasisLabelStyle?: CSSProperties;
  /** 地图区域样式。 */
  regionStyle?: CSSProperties;
  /** 地图区域高亮样式。 */
  emphasisRegionStyle?: CSSProperties;
  /** Omit for .65–5; null removes limits; an object sets optional bounds. */
  scaleLimit?: {
  /** 允许的最小值。 */
  min?:number;
  /** 允许的最大值。 */
  max?:number}|null;
  /** 提示框内容的格式化函数。 */
  tooltipFormatter?:(name:string,datum:MapDatum|undefined)=>ReactNode;
  /**
   * 高亮时是否显示标签集合。
   * @defaultValue false
   */
  showEmphasisLabels?:boolean;
  /** 经度方向投影的比例系数。 */
  longitudeRatio?:number;
  /**
   * 地理区域嵌入配置。
   * @defaultValue []
   */
  geographicInsets?:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 图表坐标位置或坐标转换配置。 */
  coordinate:readonly [number,number];
  /** 多边形集合。 */
  polygons:readonly (readonly (readonly [number,number])[])[];
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label:readonly [number,number];
  /** 每单位经度对应的绘图单位数。 */
  unitsPerLongitude:number}[];
  /** 绘图区边界。 */
  plotBounds?:{
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
  /** 数值轴的数据范围。 */
  valueDomain?:readonly [number,number];
  /**
   * 是否显示视觉映射控件。
   * @defaultValue true
   */
  showVisualMap?:boolean;
  /** 数据系列名称。 */
  seriesName?:string;
  /** 地图标识或地图数据。 */
  map?: string;
  /** 用于绘制地图的 GeoJSON 数据。 */
  geoJson?: GeoJsonFeatureCollection;
  /** 用于渲染的数据集合。 */
  data: readonly MapDatum[];
  /**
   * 可选颜色或颜色序列。
   * @defaultValue ["#e6f4ff", "#1677ff"]
   */
  colors?: readonly string[];
  /**
   * 从地理要素属性中读取名称的字段名。
   * @defaultValue "name"
   */
  nameProperty?: string;
  /** 原始名称到显示名称的映射。 */
  nameMap?:Readonly<Record<string,string>>;
  /** 地图标签的自定义坐标。 */
  labelCoordinates?:Readonly<Record<string,readonly [number,number]>>;
  /** 标签相对于默认位置的偏移集合。 */
  labelOffsets?:Readonly<Record<string,readonly [number,number]>>;
  /** 需要单独放置的特殊地理区域。 */
  specialAreas?:Readonly<Record<string,MapSpecialArea>>;
  /** Normalize coordinates before calculating bounds and projecting; source GeoJSON is unchanged. */
  coordinateTransform?:(point:readonly [number,number])=>readonly [number,number];
  /** 参与高亮的数据值范围。 */
  emphasisValueRange?:readonly [number,number];
  /** 鼠标悬停地图区域时调用。 */
  onRegionHover?:(datum:MapDatum|undefined)=>void;
  /**
   * 是否显示数据标签。
   * @defaultValue true
   */
  showLabels?: boolean;
  /**
   * 地图或图表的平移、缩放配置。
   * @defaultValue false
   */
  roam?: boolean | "move" | "scale";
  /**
   * 图形的选中模式。
   * @defaultValue false
   */
  selectedMode?: false | "single" | "multiple";
  /** 是否处于选中状态。 */
  selected?: readonly string[];
  /** 初始化时选中的图形或状态。 */
  defaultSelected?: readonly string[];
  /** 编辑器选区变化时调用。 */
  onSelectionChange?: (names: string[]) => void;
  /**
   * 是否允许拖动视觉映射范围。
   * @defaultValue false
   */
  calculableVisualMap?: boolean;
  /** 受控的视觉映射数值范围。 */
  visualRange?: readonly [number, number];
  /** 初始视觉映射范围。 */
  defaultVisualRange?: readonly [number, number];
  /** 视觉映射范围变化时调用。 */
  onVisualRangeChange?: (range: [number, number]) => void;
  /**
   * 标记点配置集合。
   * @defaultValue []
   */
  markPoints?: readonly MapMarkPoint[];
  /**
   * 标记线配置集合。
   * @defaultValue []
   */
  markLines?: readonly MapMarkLine[];
  /** 点击地图区域时调用。 */
  onRegionClick?: (info: ChartDataClickInfo<MapDatum | GeoJsonFeature>) => void;
}

const chartMaps = new Map<string, GeoJsonFeatureCollection>();

/** 注册可供 MapChart 按名称使用的 GeoJSON 地图数据。 */
export function registerChartMap(name: string, geoJson: GeoJsonFeatureCollection) {
  chartMaps.set(name, geoJson);
}

/** 按名称读取已注册的地图数据。 */
export function getChartMap(name: string) {
  return chartMaps.get(name);
}

function collectGeoPoints(collection: GeoJsonFeatureCollection) {
  const points: Array<readonly [number, number]> = [];
  collection.features.forEach((feature) => {
    if (feature.geometry.type === "Polygon") feature.geometry.coordinates.forEach((ring) => ring.forEach((point) => points.push(point)));
    else feature.geometry.coordinates.forEach((polygon) => polygon.forEach((ring) => ring.forEach((point) => points.push(point))));
  });
  return points;
}

function colorBetween(start: string, end: string, ratio: number) {
  const read = (value: string) => {
    const normalized = value.replace("#", "");
    const expanded = normalized.length === 3 ? normalized.split("").map((item) => item + item).join("") : normalized;
    return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16));
  };
  const from = read(start);
  const to = read(end);
  return `rgb(${from.map((value, index) => Math.round(value + ((to[index] ?? value) - value) * Math.max(0, Math.min(1, ratio)))).join(" ")})`;
}

/** 地图组件。 */
export const MapChart = forwardRef<SiaChartRef, MapChartProps>(function MapChart(
  { overlayProjection,bundledLines,largeMarkPoints,markLineEffectRenderer='svg',insetStyle,insetLabelStyle,regionHoverable=true,markPointTooltipFormatter,emphasisValueRange,onRegionHover,coordinateTransform,specialAreas,labelCoordinates,labelOffsets,nameMap,wheelZoomFactors,clampVisualValues=false,showMap=true,visualMapLayout,labelStyle,emphasisLabelStyle,regionStyle,emphasisRegionStyle,outOfRangeColor,scaleLimit,roamController=false,map, geoJson, data, colors = ["#e6f4ff", "#1677ff"], nameProperty = "name", showLabels = true, showEmphasisLabels=false,tooltipFormatter, roam = false, selectedMode = false, selected, defaultSelected, onSelectionChange, calculableVisualMap = false, visualRange, defaultVisualRange, onVisualRangeChange, markPoints = [], markLines = [], onRegionClick, toolbox, plotBounds:sourcePlotBounds,longitudeRatio,geographicInsets=[],valueDomain,showVisualMap=true,seriesName, ...props }, ref,
) {
  const [internalSelected, setInternalSelected] = useState<string[]>(() => [...(defaultSelected ?? data.filter((item) => item.selected).map((item) => item.name))]);
  const selectedNames = selected ?? internalSelected;
  const [hoveredRegion,setHoveredRegion]=useState<string>();
  const [hoveredMarkPoint,setHoveredMarkPoint]=useState<number>();
  const [internalHoveredValueRange,setHoveredValueRange]=useState<readonly [number,number]>();
  const hoveredValueRange=emphasisValueRange??internalHoveredValueRange;
  const roamControl=useMapRoam(roam,scaleLimit,wheelZoomFactors);
  const {view}=roamControl;
  const collection = geoJson ?? (map ? chartMaps.get(map) : undefined);
  const mainFeatures=collection?.features.filter(feature=>!specialAreas?.[String(feature.properties[nameProperty]??feature.properties.name)]);
  const points = collection ? collectGeoPoints({...collection,features:mainFeatures?.length?mainFeatures:collection.features}) : [];
  const projectionPoints=coordinateTransform?points.map(coordinateTransform):points;
  const xs = projectionPoints.map((point) => point[0]);
  const ys = projectionPoints.map((point) => point[1]);
  const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const plotBounds=longitudeRatio&&points.length?fitMapBounds(bounds,sourcePlotBounds??{x:164,y:44,width:498,height:262},longitudeRatio):sourcePlotBounds;
  const values = data.map((item) => item.value);
  const minimum = valueDomain?.[0]??(values.length ? Math.min(...values) : 0);
  const maximum = valueDomain?.[1]??(values.length ? Math.max(...values) : 1);
  const [internalVisualRange, setInternalVisualRange] = useState<[number, number]>(() => [...(defaultVisualRange ?? [minimum, maximum])] as [number, number]);
  useEffect(() => {
    if (!visualRange && !defaultVisualRange) setInternalVisualRange([minimum, maximum]);
  }, [defaultVisualRange, maximum, minimum, visualRange]);
  const currentVisualRange = visualRange ?? internalVisualRange;
  const updateVisualRange = (next: [number, number]) => {
    if (!visualRange) setInternalVisualRange(next);
    onVisualRangeChange?.(next);
  };
  const toolboxOptions = toolbox === true ? {} : typeof toolbox === "object" ? toolbox : undefined;
  const chartToolbox = toolboxOptions ? {
    ...toolboxOptions,
    onRestore: () => {
      if (!selected) setInternalSelected([...(defaultSelected ?? data.filter((item) => item.selected).map((item) => item.name))]);
      if (!visualRange) setInternalVisualRange([...(defaultVisualRange ?? [minimum, maximum])] as [number, number]);
      roamControl.reset();
      toolboxOptions.onRestore?.();
    },
  } : toolbox;
  const project = (originalPoint: readonly [number, number]) => {
   if(overlayProjection)return projectMapOverlay(originalPoint,overlayProjection.project,overlayProjection.offset);
   const point=coordinateTransform?.(originalPoint)??originalPoint;
   return [
    linearScale(point[0], [bounds.minX, bounds.maxX], [plotBounds?.x??164,plotBounds?plotBounds.x+plotBounds.width:662]),
    linearScale(point[1], [bounds.minY, bounds.maxY], [plotBounds?plotBounds.y+plotBounds.height:306,plotBounds?.y??44]),
  ] as const;};

  return <SiaChart {...props} ref={ref} toolbox={chartToolbox} empty={!collection?.features.length&&!overlayProjection} ariaLabel={props.ariaLabel ?? "地图"}>
    <g ref={roamControl.host} {...roamControl.handlers} data-map-viewport tabIndex={roam?0:undefined} role={roam?'group':undefined} aria-label={roam?'地图漫游：拖动平移、滚轮缩放、Home 还原':undefined} style={{touchAction:roam?'none':undefined}}>
    {roam?<rect x={0} y={0} width={props.viewBoxSize?.[0]??720} height={props.viewBoxSize?.[1]??360} fill="transparent" className="sia-chart__map-roam-surface"/>:null}
    <g data-map-transform style={{display:showMap?undefined:'none'}} transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
    {collection?.features.map((feature, featureIndex) => {
      const originalName = String(feature.properties[nameProperty] ?? feature.properties.name ?? `区域 ${featureIndex + 1}`);
      const name = nameMap?.[originalName]??originalName;
      const datum = data.find((item) => item.name === name);
      const value = datum?.value ?? minimum;
      const visualValue=clampVisualValues?Math.max(minimum,Math.min(maximum,value)):value;
      const outside=!datum||visualValue<currentVisualRange[0]||visualValue>currentVisualRange[1];
      const color = outside&&outOfRangeColor ? outOfRangeColor : datum?.color ?? chartColorRamp(colors, (value - minimum) / Math.max(1, maximum - minimum));
      const specialArea=specialAreas?.[originalName];
      const featurePoints = feature.geometry.type === "Polygon"
        ? feature.geometry.coordinates.flat()
        : feature.geometry.coordinates.flat(2);
      const regionProject=specialArea?createSpecialAreaProjection(featurePoints,specialArea,project,longitudeRatio??.75):project;
      const regionPath=(rings:readonly (readonly (readonly [number,number])[])[])=>rings.map(ring=>ring.map((point,index)=>`${index?'L':'M'} ${regionProject(point)[0]} ${regionProject(point)[1]}`).join(' ')+' Z').join(' ');
      const path=feature.geometry.type==='Polygon'?regionPath(feature.geometry.coordinates):feature.geometry.coordinates.map(regionPath).join(' ');
      let centerX = 0;
      let centerY = 0;
      featurePoints.forEach((point) => {
        const projected = regionProject(point);
        centerX += projected[0];
        centerY += projected[1];
      });
      const center: [number, number] = [centerX / Math.max(1, featurePoints.length), centerY / Math.max(1, featurePoints.length)];
      const labelCoordinate=labelCoordinates?.[originalName]??labelCoordinates?.[name]??feature.properties.cp;
      if(Array.isArray(labelCoordinate)&&labelCoordinate.length===2&&labelCoordinate.every(value=>typeof value==='number')){
        const projected=regionProject(labelCoordinate as [number,number]);center[0]=projected[0];center[1]=projected[1];
      }
      const labelOffset=labelOffsets?.[originalName]??labelOffsets?.[name];
      if(labelOffset){center[0]+=labelOffset[0];center[1]+=labelOffset[1];}
      const isSelected = selectedNames.includes(name);
      const isEmphasized=hoveredRegion===name||isSelected||Boolean(datum&&hoveredValueRange&&value>=hoveredValueRange[0]&&value<=hoveredValueRange[1]);
      const appearance=resolveMapRegionAppearance({regionStyle,emphasisRegionStyle,labelStyle,emphasisLabelStyle,showLabels,showEmphasisLabels},datum,isEmphasized);
      const toggleRegion=()=>{
        if (selectedMode) {
          const next = selectedMode === "single" ? isSelected ? [] : [name] : isSelected ? selectedNames.filter((item) => item !== name) : [...selectedNames, name];
          if (!selected) setInternalSelected(next);
          onSelectionChange?.(next);
        }
      };
      return <ChartMark style={regionHoverable?undefined:{pointerEvents:'none'}} tabIndex={regionHoverable?undefined:-1} key={`${name}-${featureIndex}`} data-map-region={name} data-map-original-name={originalName} aria-selected={selectedMode?isSelected:undefined} label={`${name}，${datum?formatChartNumber(value):"无数据"}`} tooltip={tooltipFormatter?tooltipFormatter(name,datum):datum?<TooltipValue name={name} series={seriesName} value={value} />:<><strong>{name}</strong><span>{seriesName}：无数据</span></>} tooltipPoint={center} onPointerMove={()=>{setHoveredRegion(name);onRegionHover?.(datum);}} onPointerLeave={()=>{setHoveredRegion(undefined);onRegionHover?.(undefined);}} onFocus={()=>{setHoveredRegion(name);onRegionHover?.(datum);}} onBlur={()=>{setHoveredRegion(undefined);onRegionHover?.(undefined);}} onKeyDown={event=>{if(selectedMode&&(event.key==='Enter'||event.key===' ')){event.preventDefault();toggleRegion();}}} onPointerUp={(event) => {
        toggleRegion();
        onRegionClick?.({ name, value, data: datum ?? feature, nativeEvent: event });
      }}>
        <path d={path} fill={color} style={appearance.regionStyle} opacity={outOfRangeColor||value>=currentVisualRange[0]&&value<=currentVisualRange[1] ? 1 : .16} className={`sia-chart__map-region${isSelected ? " sia-chart__map-region--selected" : ""}`} fillRule="evenodd" />
        {appearance.showLabel ? <text x={center[0]} y={center[1] + 4} textAnchor="middle" style={appearance.labelStyle} className="sia-chart__map-label">{name}</text> : null}
        {datum?.legendSymbols?.map((symbol,index)=><circle key={symbol.name} data-map-legend-symbol={symbol.name} cx={center[0]+3+7*index} cy={center[1]-10} r={3} fill={symbol.color} pointerEvents="none"/>)}
      </ChartMark>;
    })}
    {geographicInsets.map(inset=>{
      const anchor=project(inset.coordinate),unit=project([inset.coordinate[0]+1,inset.coordinate[1]]);
      const scale=(unit[0]-anchor[0])/inset.unitsPerLongitude;
      return <g key={inset.name} data-map-inset={inset.name} role="img" aria-label={inset.name}>
        <path d={inset.polygons.map(polygon=>polygon.map((point,index)=>`${index?'L':'M'} ${anchor[0]+point[0]*scale} ${anchor[1]+point[1]*scale}`).join(' ')+' Z').join(' ')} fill="#ccc" style={insetStyle}/>
        <text x={anchor[0]+inset.label[0]*scale} y={anchor[1]+inset.label[1]*scale} textAnchor="middle" fontSize={10} style={insetLabelStyle}>{inset.name}</text>
      </g>;
    })}
    {bundledLines?<ChartBundledMapCanvas {...bundledLines} edges={bundledLines.edges.map(edge=>({source:project(edge.source),target:project(edge.target)}))} points={bundledLines.points?.map(project)} width={props.viewBoxSize?.[0]??720} height={props.viewBoxSize?.[1]??360}/>:null}
    {markLines.map((line, index) => {
      if(line.visualMap&&((line.value??minimum)<currentVisualRange[0]||(line.value??minimum)>currentVisualRange[1]))return null;
      const source = project(line.source);
      const target = project(line.target);
      const directional=mapLineControl(source,target,line.curveness??.2);
      const middleX = line.curveMode?directional[0]:(source[0] + target[0]) / 2;
      const middleY = line.curveMode?directional[1]:(source[1] + target[1]) / 2 - (line.curveness ?? .2) * Math.hypot(target[0] - source[0], target[1] - source[1]);
      const path = `M ${source[0]} ${source[1]} Q ${middleX} ${middleY} ${target[0]} ${target[1]}`;
      const color = line.color ?? (line.visualMap?chartColorRamp(colors,((line.value??minimum)-minimum)/Math.max(1,maximum-minimum)):chartColor(index, props.palette ?? DEFAULT_CHART_PALETTE));
      const angle=Math.atan2(target[1]-middleY,target[0]-middleX)*180/Math.PI;
      const content=<ChartMapLineReveal source={source} control={[middleX,middleY]} target={target} enabled={Boolean(line.reveal)} {...line.reveal}>{(visibleControl,visibleTarget)=>{const visiblePath=`M ${source[0]} ${source[1]} Q ${visibleControl[0]} ${visibleControl[1]} ${visibleTarget[0]} ${visibleTarget[1]}`,visibleAngle=Math.atan2(visibleTarget[1]-visibleControl[1],visibleTarget[0]-visibleControl[0])*180/Math.PI;return <><path d={visiblePath} style={{...line.lineStyle,filter:line.shadowBlur?`drop-shadow(0 0 ${line.shadowBlur}px ${color})`:line.lineStyle?.filter}} fill="none" stroke={color} strokeWidth={line.width ?? 1.5} strokeDasharray={line.dashed?'5 5':undefined}/>{line.endpointSizes?<>{line.endpointSymbols?.[0]!=='none'?<circle style={line.endpointStyle} data-map-line-start cx={source[0]} cy={source[1]} r={line.endpointSizes[0]} fill={color}/>:null}{line.endpointSymbols?.[1]==='circle'?<circle style={line.endpointStyle} data-map-line-end cx={visibleTarget[0]} cy={visibleTarget[1]} r={line.endpointSizes[1]} fill={color}/>:<path style={line.endpointStyle} data-map-line-end transform={`translate(${visibleTarget[0]} ${visibleTarget[1]}) rotate(${visibleAngle})`} d={`M0 0 L${-line.endpointSizes[1]*2} ${-line.endpointSizes[1]} L${-line.endpointSizes[1]*2} ${line.endpointSizes[1]} Z`} fill={color}/>}</>:null}{line.movingEffect?markLineEffectRenderer==='canvas'?null:<ChartMapLineEffect source={source} control={[middleX,middleY]} target={target} {...line.movingEffect}/>:line.effect ? <circle r={4} fill={color}><animateMotion dur="2s" repeatCount="indefinite" path={path}/></circle>:null}</>;}}</ChartMapLineReveal>;
      return line.tooltip?<ChartMark key={`${line.name??index}-${index}`} data-map-line={line.name} data-map-line-series={line.seriesName} className="sia-chart__map-mark-line" label={line.name??'地图标线'} tooltip={line.tooltip} tooltipPoint={[middleX,middleY]}>{content}</ChartMark>:<g key={`${line.name??index}-${index}`} className={`sia-chart__map-mark-line${line.effect?' sia-chart__map-effect':''}`}>{content}</g>;
    })}
    {markLineEffectRenderer==='canvas'?<ChartMapEffectCanvas width={props.viewBoxSize?.[0]??720} height={props.viewBoxSize?.[1]??360} effects={markLines.filter(line=>line.movingEffect&&(!line.visualMap||((line.value??minimum)>=currentVisualRange[0]&&(line.value??minimum)<=currentVisualRange[1]))).map(line=>{
      const source=project(line.source),target=project(line.target),control=line.curveMode?mapLineControl(source,target,line.curveness??.2):[(source[0]+target[0])/2,(source[1]+target[1])/2-(line.curveness??.2)*Math.hypot(target[0]-source[0],target[1]-source[1])] as const;
      return {source,target,control,...line.movingEffect};
    })}/>:null}
    {largeMarkPoints?<ChartLargeMapPointCanvas width={props.viewBoxSize?.[0]??720} height={props.viewBoxSize?.[1]??360} groups={largeMarkPoints.map(group=>({...group,points:group.points.map(project)}))}/>:null}
    {markPoints.map((point, index) => {
      const position = point.coordinateSpace==='svg' ? point.coordinate : project(point.coordinate);
      const markValue=point.value??minimum;
      if(point.visualMap&&(markValue<currentVisualRange[0]||markValue>currentVisualRange[1]))return null;
      const color = point.color ?? (point.visualMap?chartColorRamp(colors,(markValue-minimum)/Math.max(1,maximum-minimum)):chartColor(index, props.palette ?? DEFAULT_CHART_PALETTE));
      const size=point.size??7,emphasized=hoveredMarkPoint===index;
      const style={...point.style,...(emphasized?point.emphasisStyle:undefined)};
      return <ChartMark key={`${point.name}-${index}`} data-map-point={point.name} data-map-point-series={point.seriesName} label={`${point.name}，${point.value ?? ""}`} tooltip={markPointTooltipFormatter?markPointTooltipFormatter(point):<><strong>{point.seriesName}{point.seriesName?<br/>:null}{point.name}</strong>{point.value != null ? <b>{formatChartNumber(point.value)}</b> : null}</>} tooltipPoint={position} onPointerMove={()=>setHoveredMarkPoint(index)} onPointerLeave={()=>setHoveredMarkPoint(undefined)} onFocus={()=>setHoveredMarkPoint(index)} onBlur={()=>setHoveredMarkPoint(undefined)}>
        <ChartMapPointEntrance enabled={point.entrance??false} x={position[0]} y={position[1]}>
        {point.imageSrc?<image data-map-point-image href={point.imageSrc} x={position[0]-size} y={position[1]-size} width={size*2} height={size*2} preserveAspectRatio="none" style={style}/>:<>
        {point.effect ? <circle cx={position[0]} cy={position[1]} r={size} fill="none" stroke={color} className="sia-chart__map-ripple"><animate attributeName="r" values={`${size};${size*2.8}`} dur="1.5s" repeatCount="indefinite" /><animate attributeName="opacity" values=".9;0" dur="1.5s" repeatCount="indefinite" /></circle> : null}
        {point.scaleEffect?<circle className="sia-chart__map-point" data-map-scale-effect={point.scaleEffect.duration} cx={position[0]} cy={position[1]} r={size*(point.scaleEffect.scaleSize??2)*.1} fill="none" style={{stroke:color,strokeWidth:.1}}><animate attributeName="r" values={`${size*(point.scaleEffect.scaleSize??2)*.1};${size*(point.scaleEffect.scaleSize??2)}`} dur={`${point.scaleEffect.duration}ms`} repeatCount="indefinite" calcMode="linear"/><animate attributeName="stroke-width" values=".1;1" dur={`${point.scaleEffect.duration}ms`} repeatCount="indefinite" calcMode="linear"/></circle>:point.symbol==='pin'?<path className="sia-chart__map-point" transform={`translate(${position[0]} ${position[1]})`} d={point.pinShape==='arc'?`M${-Math.cos(Math.PI/5)*size} ${(Math.sin(Math.PI/5)-1.5)*size} A${size} ${size} 0 1 1 ${Math.cos(Math.PI/5)*size} ${(Math.sin(Math.PI/5)-1.5)*size} L0 0 Z`:`M0 0 C${-size/2} ${-size} ${-size} ${-size} ${-size} ${-size*1.5} A${size} ${size} 0 1 1 ${size} ${-size*1.5} C${size} ${-size} ${size/2} ${-size} 0 0 Z`} fill={color} style={style}/>:<circle cx={position[0]} cy={position[1]} r={size} fill={point.symbol==='emptyCircle'?'none':color} stroke={point.symbol==='emptyCircle'?color:undefined} style={style} className="sia-chart__map-point" />}
        </>}
        {point.label!=null?<text data-map-point-value x={position[0]} y={position[1]-(point.symbol==='pin'?size*1.5:0)} textAnchor="middle" dominantBaseline="central" style={{fill:'#fff',fontSize:12,pointerEvents:'none',...point.labelStyle}}>{point.label}</text>:null}
        {point.showEmphasisLabel&&emphasized?<text data-map-point-label x={position[0]} y={position[1]-size-6} textAnchor="middle" style={{fill:color,fontSize:12}}>{point.name}</text>:null}
        </ChartMapPointEntrance>
      </ChartMark>;
    })}
    </g></g>
    {showVisualMap?<ChartVisualMap min={minimum} max={maximum} colors={colors} x={18} y={260} width={104} label="数值" {...visualMapLayout} onHoverRange={setHoveredValueRange} indicatorValue={data.find(item=>item.name===hoveredRegion)?.value} calculable={calculableVisualMap} range={currentVisualRange} onRangeChange={updateVisualRange} />:null}
    {roamController?<ChartRoamController x={(props.viewBoxSize?.[0]??720)-90} y={5} onPan={roamControl.pan} onZoom={factor=>roamControl.zoom(factor,[(props.viewBoxSize?.[0]??720)/2,(props.viewBoxSize?.[1]??360)/2])}/>:null}
  </SiaChart>;
});

/** Gauge的单条数据。 */
export interface GaugeDatum {
  /** 组件或浮层的堆叠层级。 */
  zIndex?: number;
  /** 标签文字粗细。 */
  labelFontWeight?: string | number;
  /** 名称文字粗细。 */
  nameFontWeight?: string | number;
  /** 详细数值文字粗细。 */
  detailFontWeight?: string | number;
  /** 名称文字样式。 */
  nameFontStyle?: string;
  /** 详细数值的容器样式。 */
  detailBox?: {
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number;
  /** 背景颜色或填充配置。 */
  background?:string;
  /** 边框颜色。 */
  borderColor?:string;
  /** 边框线宽。 */
  borderWidth?:number};
  /** 轴线粗细。 */
  axisWidth?: number;
  /** 坐标轴或仪表盘的分段数量。 */
  splitNumber?: number;
  /** 刻度数量。 */
  tickCount?: number;
  /** 刻度线长度。 */
  tickLength?: number;
  /** 刻度线颜色。 */
  tickColor?: string;
  /** 是否显示刻度线。 */
  showTicks?: boolean;
  /** 分隔线长度。 */
  splitLength?: number;
  /** 分隔线颜色。 */
  splitColor?: string;
  /** 分隔线宽度。 */
  splitWidth?: number;
  /** 标签文字颜色。 */
  labelColor?: string;
  /** 标签字体大小。 */
  labelFontSize?: number;
  /** 标签文本格式化函数。 */
  labelFormatter?: (value:number)=>ReactNode;
  /** 名称相对于默认位置的偏移。 */
  nameOffset?: readonly [number,number];
  /** 详细数值的显示位置。 */
  detailPosition?: readonly [number,number];
  /** 是否显示名称。 */
  showName?: boolean;
  /** 是否显示详细数值。 */
  showDetail?: boolean;
  /** 名称文字大小。 */
  nameFontSize?: number;
  /** 详细数值文字大小。 */
  detailFontSize?: number;
  /** 名称文字颜色。 */
  nameColor?: string;
  /** 详细数值文字颜色。 */
  detailColor?: string;
  /** 指针颜色。 */
  pointerColor?: string;
  /** 发光效果配置。 */
  glow?: boolean;
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 允许的最小值。 */
  min?: number;
  /** 允许的最大值。 */
  max?: number;
  /** 绘制起始角度。 */
  startAngle?: number;
  /** 绘制结束角度。 */
  endAngle?: number;
  /** 中心位置。 */
  center?: readonly [number, number];
  /** 图形半径或圆角配置。 */
  radius?: number;
  /** 分段配置。 */
  segments?: readonly {
  /** 该段有效范围的结束值。 */
  until: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color: string }[];
  /** 指针宽度。 */
  pointerWidth?: number;
  /** 指针长度。 */
  pointerLength?: number;
  /** 数值显示单位。 */
  unit?: string;
}

/** 仪表盘的属性配置。 */
export interface GaugeChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** 提示框内容的格式化函数。 */
  tooltipFormatter?: (item:GaugeDatum)=>ReactNode;
  /**
   * 图形外观配置。
   * @defaultValue "sia"
   */
  appearance?: "sia" | "macarons";
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /** 用于渲染的数据集合。 */
  data: readonly GaugeDatum[];
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
   * 绘制起始角度。
   * @defaultValue 210
   */
  startAngle?: number;
  /**
   * 绘制结束角度。
   * @defaultValue -30
   */
  endAngle?: number;
  /** 分段配置。 */
  segments?: readonly {
  /** 该段有效范围的结束值。 */
  until: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color: string }[];
  /**
   * 坐标轴或仪表盘的分段数量。
   * @defaultValue 10
   */
  splitNumber?: number;
  /**
   * 是否显示轴标签。
   * @defaultValue true
   */
  showAxisLabels?: boolean;
  /**
   * 是否显示进度部分。
   * @defaultValue true
   */
  showProgress?: boolean;
  /**
   * 详细数值相对于默认位置的偏移。
   * @defaultValue 84
   */
  detailOffset?: number;
  /** 将数值格式化为显示文本的函数。 */
  valueFormatter?: (value: number) => ReactNode;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<GaugeDatum>) => void;
}

/** 仪表盘组件。 */
export const GaugeChart = forwardRef<SiaChartRef, GaugeChartProps>(function GaugeChart(
  { tooltipFormatter,data, min = 0, max = 100, startAngle = 210, endAngle = -30, segments, splitNumber = 10, showAxisLabels = true, showProgress = true, detailOffset = 84, valueFormatter, onDataClick, palette, appearance="sia", animationProgress, ...props }, ref,
) {
  const count = Math.max(1, data.length);
  const legacy=appearance==="macarons";
  return <SiaChart {...props} className={`${props.className??""}${legacy?" sia-chart--macarons":""}`} ref={ref} palette={palette} empty={!data.length} ariaLabel={props.ariaLabel ?? "仪表盘"}>
    {[...data].sort((a,b)=>(a.zIndex??0)-(b.zIndex??0)).map((item, index) => {
      const centerX = item.center?.[0] ?? (count === 1 ? 360 : 150 + index * 420 / Math.max(1, count - 1));
      const centerY = item.center?.[1] ?? 194;
      const radius = item.radius ?? (count === 1 ? 122 : Math.min(96, 270 / count));
      const itemMin = item.min ?? min;
      const itemMax = item.max ?? max;
      const start = (item.startAngle ?? startAngle) / 180 * Math.PI;
      const end = (item.endAngle ?? endAngle) / 180 * Math.PI;
      const sweep = end - start;
      const ratio = Math.max(0, Math.min(1, (item.value - itemMin) / Math.max(1, itemMax - itemMin)));
      const valueAngle = start + sweep * ratio;
      const pointerLength = item.pointerLength ?? .72;
      const pointer = [centerX + Math.cos(valueAngle) * radius * pointerLength, centerY + Math.sin(valueAngle) * radius * pointerLength] as const;
      const pointerStart = [centerX + Math.cos(start) * radius * pointerLength, centerY + Math.sin(start) * radius * pointerLength] as const;
      const color = getColor(index, item.color, palette);
      const normalizedSegments = item.segments ?? segments ?? [{ until: 1, color: "var(--sia-chart-track)" }];
      let previous = 0;
      if(legacy){
        const axisWidth=item.axisWidth??30;
        const colorAt=(t:number)=>normalizedSegments.find(segment=>t<=segment.until)?.color??normalizedSegments.at(-1)!.color;
        const resolveColor=(given:string|undefined,t:number,fallback:string)=>given==="auto"?colorAt(t):given??fallback;
        const major=Math.max(1,item.splitNumber??splitNumber),minor=Math.max(1,item.tickCount??5);
        const at=(angle:number,r:number)=>[centerX+Math.cos(angle)*r,centerY+Math.sin(angle)*r] as const;
        const titlePosition=item.nameOffset??[0,-radius*.4],detailPosition=item.detailPosition??[0,radius*.4];
        return <ChartMark key={`${item.name}-${index}`} label={`${item.name}，${item.value}`} tooltip={tooltipFormatter?.(item)??<TooltipValue name={item.name} value={item.value}/>} tooltipPoint={[centerX,centerY]} onPointerUp={event=>onDataClick?.({name:item.name,value:item.value,data:item,nativeEvent:event})}>
          <g style={item.glow?{filter:"drop-shadow(0 0 4px #fff)"}:undefined}>
          {normalizedSegments.map((segment,i)=>{const d=svgArcPath(centerX,centerY,radius,start+sweep*previous,start+sweep*segment.until,Math.max(0,radius-axisWidth));previous=segment.until;return <path key={i} d={d} fill={segment.color}/>;})}
          {item.showTicks!==false?Array.from({length:major*minor+1},(_,tick)=>{const t=tick/(major*minor),angle=start+sweep*t,a=at(angle,radius),b=at(angle,radius-(item.tickLength??8));return <line key={tick} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={resolveColor(item.tickColor,t,"#eee")} strokeWidth={1}/>;}):null}
          {Array.from({length:major+1},(_,tick)=>{const t=tick/major,angle=start+sweep*t,a=at(angle,radius),b=at(angle,radius-(item.splitLength??30)),p=at(angle,radius-(item.splitLength??30)-5),value=Number((itemMin+(itemMax-itemMin)*t).toFixed(6));return <g key={tick}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={resolveColor(item.splitColor,t,"#eee")} strokeWidth={item.splitWidth??2}/>{showAxisLabels?<text x={p[0]} y={p[1]+4} textAnchor={Math.cos(angle)<-.34?"start":Math.cos(angle)>.34?"end":"middle"} fill={resolveColor(item.labelColor,t,"#333")} fontSize={item.labelFontSize??12} fontWeight={item.labelFontWeight}>{item.labelFormatter?.(value)??formatChartNumber(value)}</text>:null}</g>;})}
          <ChartPointMotion points={[[0,start],[0,valueAngle]]} enabled={props.animation!==false} duration={props.animationDuration??2000} progress={animationProgress}>{points=>{const angle=points[1]?.[1]??valueAngle,pointerPoints=gaugePointerPoints([centerX,centerY],angle,radius*pointerLength,item.pointerWidth??8);return <polygon points={pointerPoints.map(point=>point.join(",")).join(" ")} fill={resolveColor(item.pointerColor,ratio,colorAt(ratio))}/>;}}</ChartPointMotion>
          {item.showName!==false?<text x={centerX+titlePosition[0]} y={centerY+titlePosition[1]} textAnchor="middle" dominantBaseline="middle" fontSize={item.nameFontSize??15} fontWeight={item.nameFontWeight} fontStyle={item.nameFontStyle} fill={item.nameColor??"#333"}>{item.name}</text>:null}
          {item.showDetail!==false?<><rect x={centerX+detailPosition[0]-(item.detailBox?.width??100)/2} y={centerY+detailPosition[1]} width={item.detailBox?.width??100} height={item.detailBox?.height??40} fill={item.detailBox?.background??"transparent"} stroke={item.detailBox?.borderColor??"transparent"} strokeWidth={item.detailBox?.borderWidth??0}/><text x={centerX+detailPosition[0]} y={centerY+detailPosition[1]+(item.detailBox?.height??40)/2} dominantBaseline="central" textAnchor="middle" fontSize={item.detailFontSize??30} fontWeight={item.detailFontWeight} fill={resolveColor(item.detailColor,ratio,colorAt(ratio))}>{valueFormatter?valueFormatter(item.value):`${formatChartNumber(item.value)}${item.unit??""}`}</text></>:null}
          </g>
        </ChartMark>;
      }
      return <ChartMark key={`${item.name}-${index}`} label={`${item.name}，${formatChartNumber(item.value)}`} tooltip={tooltipFormatter?.(item)??<TooltipValue name={item.name} value={item.value} formatter={valueFormatter} />} tooltipPoint={[centerX, centerY]} onPointerUp={(event) => onDataClick?.({ name: item.name, value: item.value, data: item, nativeEvent: event })}>
        {normalizedSegments.map((segment, segmentIndex) => {
          const path = svgArcPath(centerX, centerY, radius, start + sweep * previous, start + sweep * Math.max(previous, Math.min(1, segment.until)), radius - 15);
          previous = Math.max(previous, Math.min(1, segment.until));
          return <path key={segmentIndex} d={path} fill={segment.color} />;
        })}
        {showProgress ? <path d={svgArcPath(centerX, centerY, radius, start, valueAngle, radius - 15)} fill={color} className="sia-chart__gauge-progress" /> : null}
        {Array.from({ length: splitNumber + 1 }, (_, tick) => {
          const tickAngle = start + sweep * tick / Math.max(1, splitNumber);
          const inner = [centerX + Math.cos(tickAngle) * (radius - 25), centerY + Math.sin(tickAngle) * (radius - 25)];
          const outer = [centerX + Math.cos(tickAngle) * (radius - 17), centerY + Math.sin(tickAngle) * (radius - 17)];
          const label = [centerX + Math.cos(tickAngle) * (radius - 39), centerY + Math.sin(tickAngle) * (radius - 39)];
          const tickValue = itemMin + (itemMax - itemMin) * tick / Math.max(1, splitNumber);
          return <g key={tick}><line x1={inner[0]} y1={inner[1]} x2={outer[0]} y2={outer[1]} className="sia-chart__gauge-tick" />{showAxisLabels ? <text x={label[0]} y={label[1] + 3} textAnchor="middle" className="sia-chart__gauge-axis-label">{formatChartNumber(tickValue)}</text> : null}</g>;
        })}
        <line x1={centerX} y1={centerY} x2={pointer[0]} y2={pointer[1]} stroke={color} strokeWidth={item.pointerWidth ?? 5} strokeLinecap="round" className="sia-chart__gauge-pointer"><animate attributeName="x2" from={pointerStart[0]} to={pointer[0]} dur="700ms" fill="freeze" /><animate attributeName="y2" from={pointerStart[1]} to={pointer[1]} dur="700ms" fill="freeze" /></line>
        <circle cx={centerX} cy={centerY} r={8} fill={color} />
        <text x={centerX} y={centerY + 54} textAnchor="middle" className="sia-chart__gauge-name">{item.name}</text>
        <text x={centerX} y={centerY + detailOffset} textAnchor="middle" className="sia-chart__gauge-value">{valueFormatter ? valueFormatter(item.value) : `${formatChartNumber(item.value)}${item.unit ?? ""}`}</text>
      </ChartMark>;
    })}
  </SiaChart>;
});

/** Funnel的单条数据。 */
export interface FunnelDatum extends PieDatum {}

/** Funnel的数据系列。 */
export interface FunnelSeries {
  /** 提示框内容的格式化函数。 */
  tooltipFormatter?: (item:FunnelDatum)=>ReactNode;
  /** 高亮状态的标签位置。 */
  emphasisLabelPosition?: "inside" | "left" | "right";
  /** 高亮标签格式化函数。 */
  emphasisLabelFormatter?: (item:FunnelDatum)=>ReactNode;
  /** 允许的最小值。 */
  min?: number;
  /** 允许的最大值。 */
  max?: number;
  /** 允许的最小尺寸。 */
  minSize?: number;
  /** 允许的最大尺寸。 */
  maxSize?: number;
  /** 标签显示位置。 */
  labelPosition?: "inside" | "left" | "right";
  /** 标签文本格式化函数。 */
  labelFormatter?: (item: FunnelDatum) => ReactNode;
  /** 是否显示标签引导线。 */
  showLabelLines?: boolean;
  /** 边框颜色。 */
  borderColor?: string;
  /** 边框线宽。 */
  borderWidth?: number;
  /** 饼图中心位置。 */
  pieCenter?: [number,number];
  /** 名称或字段标识。 */
  name?: string;
  /** 用于渲染的数据集合。 */
  data: readonly FunnelDatum[];
  /** 距左侧的位置或间距。 */
  left?: number;
  /** 距顶部的位置或间距。 */
  top?: number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?: number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height?: number;
  /** 数据或图形排序规则。 */
  sort?: "descending" | "ascending" | "none";
  /** 预设或自定义间距 */
  gap?: number;
  /** 交叉轴对齐 */
  align?: "center" | "left" | "right";
  /** 组件的水平或垂直排列方向。 */
  orientation?: "vertical" | "horizontal";
}

/** 漏斗图的属性配置。 */
export interface FunnelChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /**
   * 图形外观配置。
   * @defaultValue "sia"
   */
  appearance?: "sia" | "macarons";
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /** 图例的排列顺序。 */
  legendOrder?: readonly string[];
  /** 图例布局配置。 */
  legendLayout?: {
  /** 横向位置或 X 轴数据值。 */
  x?:number;
  /** 纵向位置或 Y 轴数据值。 */
  y?:number;
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "vertical"
   */
  orientation?:"horizontal"|"vertical"};
  /** 数据被交互修改后调用。 */
  onDataChange?: (series: readonly FunnelSeries[]) => void;
  /**
   用于渲染的数据集合。
   * @defaultValue EMPTY_PIE_DATA
   */
  data?: readonly FunnelDatum[];
  /** 图表数据系列。 */
  series?: readonly FunnelSeries[];
  /**
   * 数据或图形排序规则。
   * @defaultValue "descending"
   */
  sort?: "descending" | "ascending" | "none";
  /**
   * 预设或自定义间距
   * @defaultValue 4
   */
  gap?: number;
  /**
   * 交叉轴对齐
   * @defaultValue "center"
   */
  align?: "center" | "left" | "right";
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "vertical"
   */
  orientation?: "vertical" | "horizontal";
  /**
   * 是否显示图例。
   * @defaultValue true
   */
  showLegend?: boolean;
  /**
   * 是否允许通过图例切换系列显示。
   * @defaultValue true
   */
  legendInteractive?: boolean;
  /** 图例项目的选中状态。 */
  legendSelected?: Readonly<Record<string, boolean>>;
  /** 图例选中状态变化时调用。 */
  onLegendSelectionChange?: (selected: Record<string, boolean>) => void;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<FunnelDatum>) => void;
}

/** 漏斗图组件。 */
export const FunnelChart = forwardRef<SiaChartRef, FunnelChartProps>(function FunnelChart(
  { data = EMPTY_PIE_DATA, series, sort = "descending", gap = 4, align = "center", orientation = "vertical", showLegend = true, legendInteractive = true, legendSelected, onLegendSelectionChange, onDataClick, palette, toolbox, appearance="sia", animationProgress, legendOrder, legendLayout, onDataChange, ...props }, ref,
) {
  const legacy=appearance==="macarons";
  const [activeFunnel,setActiveFunnel]=useState<string|null>(null);
  const initialFunnels=useMemo(()=>series?.length?series:[{data,sort,gap,align,orientation}],[series,data,sort,gap,align,orientation]);
  const [sourceFunnels,setSourceFunnels]=useState<readonly FunnelSeries[]>(initialFunnels);
  useEffect(()=>setSourceFunnels(initialFunnels),[initialFunnels]);

  const allData = sourceFunnels.flatMap((funnel) => funnel.data);
  const legendData = [...new Map(allData.map((item) => [item.name, item])).values()];
  const legend = useLegendSelection(legendData.map((item) => item.name), legendSelected, onLegendSelectionChange);
  if(legendOrder)legendData.sort((a,b)=>legendOrder.indexOf(a.name)-legendOrder.indexOf(b.name));
  const [magicType, resolvedToolbox] = useToolboxMagicType(toolbox, "漏斗");
  const chartToolbox = typeof resolvedToolbox === "object" ? {
    ...resolvedToolbox,
    dataView:<ChartDataEditor series={sourceFunnels.map((item,index)=>({name:item.name??String(index+1),data:item.data.map(d=>d.value)}))} onApply={values=>{const next=sourceFunnels.map((item,index)=>({...item,data:item.data.map((d,i)=>({...d,value:values[index]![i]!}))}));setSourceFunnels(next);onDataChange?.(next);}} />,
    onRestore: () => {
      setSourceFunnels(initialFunnels);
      legend.replace(Object.fromEntries(legendData.map((item) => [item.name, true])));
      resolvedToolbox.onRestore?.();
    },
  } : resolvedToolbox;
  const funnels = sourceFunnels.map((funnel) => ({ ...funnel, data: funnel.data.filter((item) => legend.isSelected(item.name)) }));
  if (/pie|饼/i.test(magicType)) return <PieChart
    {...props}
    ref={ref}
    data={series?.length ? undefined : data}
    series={sourceFunnels.map((item) => ({ name: item.name, data: item.data,center:item.pieCenter,outerRadius:50,innerRadius:0 }))}
    innerRadius={0}
    showLegend={showLegend}
    legendInteractive={legendInteractive}
    legendSelected={legend.selected}
    onLegendSelectionChange={legend.replace}
    onDataClick={onDataClick}
    palette={palette}
    toolbox={chartToolbox}
  />;
  return <SiaChart {...props} className={`${props.className??""}${legacy?" sia-chart--macarons":""}`} ref={ref} palette={palette} toolbox={chartToolbox} empty={!sourceFunnels.some((item) => item.data.length)} ariaLabel={props.ariaLabel ?? "漏斗图"}>
    {showLegend ? <ChartLegend x={legendLayout?.x??360} y={legendLayout?.y??20} orientation={legendLayout?.orientation} align={legendLayout?.orientation==="vertical"?"start":undefined} itemGap={legacy?10:18} items={legendData.map((item, index) => ({ name: item.name, color: getColor(index, item.color, palette), disabled: !legend.isSelected(item.name) }))} selected={legend.selected} onItemClick={legendInteractive ? legend.toggle : undefined} /> : null}
    {funnels.flatMap((funnel, funnelIndex) => {
      if(legacy){
        const shapes=layoutFunnelValues(funnel.data.map(d=>d.value),{left:funnel.left??80,top:funnel.top??60,width:funnel.width??503,height:funnel.height??259,gap:funnel.gap??0,min:funnel.min,max:funnel.max,minSize:funnel.minSize,maxSize:funnel.maxSize,sort:funnel.sort,align:funnel.align});
        return shapes.map(shape=>{
          const item=funnel.data[shape.index]!;
          const color=getColor(legendData.findIndex(d=>d.name===item.name),item.color,palette);
          const markKey=`${funnelIndex}-${item.name}`;
          const emphasized=activeFunnel===markKey;
          const position=(emphasized?funnel.emphasisLabelPosition:undefined)??funnel.labelPosition??"right";
          const labelX=position==="inside"?shape.center[0]:position==="left"?(shape.points[0]![0]+shape.points[3]![0])/2-20:(shape.points[1]![0]+shape.points[2]![0])/2+20;
          return <ChartMark onPointerMove={()=>setActiveFunnel(markKey)} onPointerLeave={()=>setActiveFunnel(null)} onFocus={()=>setActiveFunnel(markKey)} onBlur={()=>setActiveFunnel(null)} key={markKey} label={`${funnel.name??""}，${item.name}，${item.value}`} tooltip={funnel.tooltipFormatter?.(item)??<TooltipValue name={item.name} series={funnel.name} value={item.value}/>} tooltipPoint={shape.center} onPointerUp={event=>onDataClick?.({name:item.name,value:item.value,seriesName:funnel.name,data:item,nativeEvent:event})}>
            <ChartPointMotion points={shape.points} enabled={props.animation!==false} duration={props.animationDuration??2000} progress={animationProgress}>{points=><polygon points={points.map(p=>p.join(",")).join(" ")} fill={color} stroke={funnel.borderColor??"#fff"} strokeWidth={funnel.borderWidth??1}/>}</ChartPointMotion>
            {position!=="inside"&&funnel.showLabelLines!==false?<line x1={position==="left"?(shape.points[0]![0]+shape.points[3]![0])/2:(shape.points[1]![0]+shape.points[2]![0])/2} y1={shape.center[1]} x2={labelX} y2={shape.center[1]} stroke={color}/>:null}
            <text x={labelX} y={shape.center[1]+4} textAnchor={position==="inside"?"middle":position==="left"?"end":"start"} fontSize={12} fill={position==="inside"?"#fff":color}>{(emphasized?funnel.emphasisLabelFormatter?.(item):undefined)??funnel.labelFormatter?.(item)??item.name}</text>
          </ChartMark>;
        });
      }
      const funnelSort = funnel.sort ?? sort;
      const sorted = funnelSort === "none" ? [...funnel.data] : [...funnel.data].sort((left, right) => funnelSort === "ascending" ? left.value - right.value : right.value - left.value);
      const maximum = Math.max(1, ...sorted.map((item) => item.value));
      const funnelTop = funnel.top ?? 42;
      const funnelLeft = funnel.left ?? (funnels.length === 1 ? 76 : 28 + funnelIndex * 664 / funnels.length);
      const funnelWidth = funnel.width ?? (funnels.length === 1 ? 568 : 624 / funnels.length);
      const funnelHeight = funnel.height ?? 270;
      const funnelGap = funnel.gap ?? gap;
      const funnelAlign = funnel.align ?? align;
      const funnelOrientation = funnel.orientation ?? orientation;
      const sectionSize = ((funnelOrientation === "vertical" ? funnelHeight : funnelWidth) - funnelGap * Math.max(0, sorted.length - 1)) / Math.max(1, sorted.length);
      const sizeAt = (value: number) => (funnelOrientation === "vertical" ? funnelWidth : funnelHeight) * (.18 + .82 * Math.max(0, value) / maximum);
      const offsetAt = (size: number) => funnelAlign === "left" ? 0 : funnelAlign === "right" ? (funnelOrientation === "vertical" ? funnelWidth : funnelHeight) - size : ((funnelOrientation === "vertical" ? funnelWidth : funnelHeight) - size) / 2;
      return sorted.map((item, index) => {
        const currentSize = sizeAt(item.value);
        const nextSize = sizeAt(sorted[index + 1]?.value ?? Math.max(0, item.value * .68));
        const cursor = index * (sectionSize + funnelGap);
        const currentOffset = offsetAt(currentSize);
        const nextOffset = offsetAt(nextSize);
        const points = funnelOrientation === "vertical"
          ? `${funnelLeft + currentOffset},${funnelTop + cursor} ${funnelLeft + currentOffset + currentSize},${funnelTop + cursor} ${funnelLeft + nextOffset + nextSize},${funnelTop + cursor + sectionSize} ${funnelLeft + nextOffset},${funnelTop + cursor + sectionSize}`
          : `${funnelLeft + cursor},${funnelTop + currentOffset} ${funnelLeft + cursor + sectionSize},${funnelTop + nextOffset} ${funnelLeft + cursor + sectionSize},${funnelTop + nextOffset + nextSize} ${funnelLeft + cursor},${funnelTop + currentOffset + currentSize}`;
        const color = getColor(index + funnelIndex, item.color, palette);
        const labelX = funnelOrientation === "vertical" ? funnelLeft + currentOffset + currentSize / 2 : funnelLeft + cursor + sectionSize / 2;
        const labelY = funnelOrientation === "vertical" ? funnelTop + cursor + sectionSize / 2 : funnelTop + currentOffset + currentSize / 2;
        return <ChartMark key={`${funnel.name ?? funnelIndex}-${item.name}-${index}`} label={`${item.name}，${formatChartNumber(item.value)}`} tooltip={<TooltipValue name={item.name} series={funnel.name} value={item.value} />} tooltipPoint={[labelX, labelY]} onPointerUp={(event) => onDataClick?.({ name: item.name, value: item.value, seriesName: funnel.name, data: item, nativeEvent: event })}>
          <polygon points={points} fill={color} className="sia-chart__funnel" />
          <text x={labelX} y={labelY + 5} textAnchor="middle" className="sia-chart__funnel-label">{item.name}　{formatChartNumber(item.value)}</text>
        </ChartMark>;
      });
    })}
  </SiaChart>;
});

/** 热力图数据点，包含坐标及热度值。 */
export interface HeatmapPoint {
  /** 横向位置或 X 轴数据值。 */
  x: number;
  /** 纵向位置或 Y 轴数据值。 */
  y: number;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 名称或字段标识。 */
  name?: string;
}

/** 热力图的属性配置。 */
export interface HeatmapChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** Native pixel-coordinate density mode (no automatic coordinate normalization). */
  raster?: HeatRasterOptions & {
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number;
  /** 背景图片配置。 */
  backgroundImage?:string};
  /**
   * X 轴标签集合。
   * @defaultValue []
   */
  xLabels?: readonly string[];
  /**
   * Y 轴标签集合。
   * @defaultValue []
   */
  yLabels?: readonly string[];
  /**
   用于渲染的数据集合。
   * @defaultValue []
   */
  data?: readonly (readonly number[])[];
  /**
   * 数据点集合。
   * @defaultValue []
   */
  points?: readonly HeatmapPoint[];
  /**
   * 可选颜色或颜色序列。
   * @defaultValue ["#e6f4ff", "#1677ff"]
   */
  colors?: readonly [string, string];
  /**
   * 是否显示数据值。
   * @defaultValue false
   */
  showValues?: boolean;
  /**
   * 数据点半径。
   * @defaultValue 30
   */
  pointRadius?: number;
  /**
   * 模糊半径。
   * @defaultValue 16
   */
  blur?: number;
  /**
   * 最小透明度。
   * @defaultValue .12
   */
  minAlpha?: number;
  /**
   * 最大透明度。
   * @defaultValue .82
   */
  maxAlpha?: number;
  /** 将数值格式化为显示文本的函数。 */
  valueFormatter?: (value: number) => ReactNode;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<number | HeatmapPoint>) => void;
}

/** 热力图组件。 */
export const HeatmapChart = forwardRef<SiaChartRef, HeatmapChartProps>(function HeatmapChart(
  { raster,xLabels = [], yLabels = [], data = [], points = [], colors = ["#e6f4ff", "#1677ff"], showValues = false, pointRadius = 30, blur = 16, minAlpha = .12, maxAlpha = .82, valueFormatter, onDataClick, ...props }, ref,
) {
  const pointMode = points.length > 0;
  const values = pointMode ? points.map((point) => point.value) : data.flatMap((row) => [...row]);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 1;
  const cellWidth = PLOT.width / Math.max(1, xLabels.length);
  const cellHeight = PLOT.height / Math.max(1, yLabels.length);
  const pointXDomain = niceChartDomain(points.map((point) => point.x), false);
  const pointYDomain = niceChartDomain(points.map((point) => point.y), false);
  const filterId = `sia-heat-${useId().replaceAll(":", "")}`;
  if(raster)return <SiaChart {...props} ref={ref} empty={!points.length} ariaLabel={props.ariaLabel??'像素热力图'}>{raster.backgroundImage?<image href={raster.backgroundImage} x={0} y={0} width={raster.width} height={raster.height} preserveAspectRatio="none" pointerEvents="none"/>:null}<HeatmapRaster width={raster.width} height={raster.height} points={points} options={raster}/></SiaChart>;
  return <SiaChart {...props} ref={ref} empty={pointMode ? !points.length : !xLabels.length || !yLabels.length} ariaLabel={props.ariaLabel ?? "热力图"}>
    {pointMode ? <defs><filter id={filterId} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={blur} /></filter></defs> : null}
    <ChartVisualMap min={minimum} max={maximum} colors={colors} x={PLOT.x + PLOT.width - 120} y={325} width={120} />
    {pointMode ? <>
      <rect x={PLOT.x} y={PLOT.y} width={PLOT.width} height={PLOT.height} rx={4} fill="var(--sia-chart-track)" />
      <g filter={`url(#${filterId})`} className="sia-chart__heat-density">{points.map((point, index) => {
        const ratio = (point.value - minimum) / Math.max(1, maximum - minimum);
        return <circle key={index} cx={linearScale(point.x, [pointXDomain[0], pointXDomain[1]], [PLOT.x, PLOT.x + PLOT.width])} cy={linearScale(point.y, [pointYDomain[0], pointYDomain[1]], [PLOT_BOTTOM, PLOT.y])} r={pointRadius} fill={colorBetween(colors[0], colors[1], ratio)} opacity={minAlpha + (maxAlpha - minAlpha) * ratio} />;
      })}</g>
      {points.map((point, index) => {
        const x = linearScale(point.x, [pointXDomain[0], pointXDomain[1]], [PLOT.x, PLOT.x + PLOT.width]);
        const y = linearScale(point.y, [pointYDomain[0], pointYDomain[1]], [PLOT_BOTTOM, PLOT.y]);
        const name = point.name ?? `热点 ${index + 1}`;
        return <ChartMark key={`hit-${index}`} label={`${name}，${point.value}`} tooltip={<TooltipValue name={name} value={point.value} formatter={valueFormatter} />} tooltipPoint={[x, y]} onPointerUp={(event) => onDataClick?.({ name, value: point.value, data: point, nativeEvent: event })}><circle cx={x} cy={y} r={Math.max(8, pointRadius * .55)} fill="transparent" /></ChartMark>;
      })}
    </> : <>
    {xLabels.map((label, index) => <text key={`${label}-${index}`} x={PLOT.x + (index + 0.5) * cellWidth} y={PLOT_BOTTOM + 20} textAnchor="middle" className="sia-chart__axis-label">{label}</text>)}
    {yLabels.map((label, index) => <text key={`${label}-${index}`} x={PLOT.x - 10} y={PLOT.y + (index + 0.5) * cellHeight + 4} textAnchor="end" className="sia-chart__axis-label">{label}</text>)}
    {yLabels.flatMap((yLabel, yIndex) => xLabels.map((xLabel, xIndex) => {
      const value = data[yIndex]?.[xIndex] ?? 0;
      const ratio = (value - minimum) / Math.max(1, maximum - minimum);
      const x = PLOT.x + xIndex * cellWidth;
      const y = PLOT.y + yIndex * cellHeight;
      return <ChartMark key={`${xLabel}-${yLabel}`} label={`${yLabel}，${xLabel}，${formatChartNumber(value)}`} tooltip={<TooltipValue name={`${yLabel} / ${xLabel}`} value={value} formatter={valueFormatter} />} tooltipPoint={[x + cellWidth / 2, y + cellHeight / 2]} onPointerUp={(event) => onDataClick?.({ name: `${yLabel} / ${xLabel}`, value, data: value, nativeEvent: event })}>
        <rect x={x + 1} y={y + 1} width={Math.max(0, cellWidth - 2)} height={Math.max(0, cellHeight - 2)} rx={3} fill={colorBetween(colors[0], colors[1], ratio)} className="sia-chart__heat-cell" />
        {showValues ? <text x={x + cellWidth / 2} y={y + cellHeight / 2 + 4} textAnchor="middle" className="sia-chart__heat-label">{formatChartNumber(value)}</text> : null}
      </ChartMark>;
    }))}</>}
  </SiaChart>;
});

/** ThemeRiver的数据系列。 */
export interface ThemeRiverSeries extends ChartSeries {}

/** 主题河流图的属性配置。 */
export interface ThemeRiverChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** 类目或数据分组集合。 */
  categories: readonly string[];
  /** 图表数据系列。 */
  series: readonly ThemeRiverSeries[];
  /**
   * 是否允许通过图例切换系列显示。
   * @defaultValue true
   */
  legendInteractive?: boolean;
  /** 图例项目的选中状态。 */
  legendSelected?: Readonly<Record<string, boolean>>;
  /** 图例选中状态变化时调用。 */
  onLegendSelectionChange?: (selected: Record<string, boolean>) => void;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<number>) => void;
}

/** 主题河流图组件。 */
export const ThemeRiverChart = forwardRef<SiaChartRef, ThemeRiverChartProps>(function ThemeRiverChart(
  { categories, series, legendInteractive = true, legendSelected, onLegendSelectionChange, onDataClick, palette, ...props }, ref,
) {
  const legend = useLegendSelection(series.map((item) => item.name), legendSelected, onLegendSelectionChange);
  const activeSeries = series.filter((item) => legend.isSelected(item.name));
  const totals = categories.map((_, index) => activeSeries.reduce((sum, item) => sum + Math.max(0, item.data[index] ?? 0), 0));
  const maximum = Math.max(1, ...totals);
  const xAt = (index: number) => PLOT.x + index / Math.max(1, categories.length - 1) * PLOT.width;
  const scale = PLOT.height * 0.78 / maximum;
  const bottoms = totals.map((total) => 184 + total * scale / 2);
  return <SiaChart {...props} ref={ref} palette={palette} empty={!categories.length || !series.length} ariaLabel={props.ariaLabel ?? "主题河流图"}>
    <ChartLegend items={series.map((item, index) => ({ name: item.name, color: getColor(index, item.color, palette), disabled: !legend.isSelected(item.name) }))} selected={legend.selected} onItemClick={legendInteractive ? legend.toggle : undefined} y={330} />
    <line x1={PLOT.x} y1={PLOT_BOTTOM} x2={PLOT.x + PLOT.width} y2={PLOT_BOTTOM} className="sia-chart__axis-line" />
    {categories.map((name, index) => <text key={`${name}-${index}`} x={xAt(index)} y={PLOT_BOTTOM + 19} textAnchor="middle" className="sia-chart__axis-label">{name}</text>)}
    {activeSeries.map((item) => {
      const seriesIndex = series.indexOf(item);
      const lower = categories.map((_, index) => [xAt(index), bottoms[index]!] as const);
      const upper = categories.map((_, index) => {
        const value = Math.max(0, item.data[index] ?? 0);
        bottoms[index] -= value * scale;
        return [xAt(index), bottoms[index]!] as const;
      });
      const path = `${smoothSvgPath(upper)} ${smoothSvgPath([...lower].reverse()).replace(/^M/, "L")} Z`;
      const color = getColor(seriesIndex, item.color, palette);
      return <g key={`${item.name}-${seriesIndex}`}>
        <path d={path} fill={color} className="sia-chart__river" />
        {upper.map((point, index) => {
          const value = item.data[index] ?? 0;
          const name = categories[index] ?? `${index + 1}`;
          return <ChartMark key={`${name}-${index}`} label={`${item.name}，${name}，${value}`} tooltip={<TooltipValue name={name} series={item.name} value={value} />} tooltipPoint={[point[0], (point[1] + lower[index]![1]) / 2]} onPointerUp={(event) => onDataClick?.({ name, value, seriesName: item.name, data: value, nativeEvent: event })}>
            <circle cx={point[0]} cy={(point[1] + lower[index]![1]) / 2} r={8} fill="transparent" />
          </ChartMark>;
        })}
      </g>;
    })}
  </SiaChart>;
});

/** 事件随时间变化的一个阶段。 */
export interface EventRiverEvolution {
  /** 关联的时间值。 */
  time: string | number | Date;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 简短的补充说明。 */
  detail?: ReactNode;
}

/** 事件河流图中的事件及其演变序列。 */
export interface EventRiverEvent {
  /** 名称或字段标识。 */
  name: string;
  /** 唯一标识，用于关联实例或插件。 */
  id?: string;
  /** 布局或数据计算使用的权重。 */
  weight?: number;
  /** 事件随时间演变的数据序列。 */
  evolution: readonly EventRiverEvolution[];
}

/** EventRiver的数据系列。 */
export interface EventRiverSeries {
  /** 名称或字段标识。 */
  name: string;
  /** 布局或数据计算使用的权重。 */
  weight?:number;
  /** 用于渲染的数据集合。 */
  data: readonly EventRiverEvent[];
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
}

/** 事件河流图的属性配置。 */
export interface EventRiverChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** 图表数据系列。 */
  series: readonly EventRiverSeries[];
  /**
   * 是否显示数据标签。
   * @defaultValue true
   */
  showLabels?: boolean;
  /**
   * 是否允许拖拽。
   * @defaultValue true
   */
  draggable?: boolean;
  /**
   * 图形外观配置。
   * @defaultValue 'sia'
   */
  appearance?: 'sia'|'macarons';
  /**
   * 绘图区或图形绘制配置。
   * @defaultValue PLOT
   */
  plot?: {
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /** Time-axis fractional padding before and after the observed data. */
  boundaryGap?: readonly [number,number];
  /**
   * 是否允许通过图例切换系列显示。
   * @defaultValue true
   */
  legendInteractive?: boolean;
  /** 图例项目的选中状态。 */
  legendSelected?: Readonly<Record<string, boolean>>;
  /** 图例选中状态变化时调用。 */
  onLegendSelectionChange?: (selected: Record<string, boolean>) => void;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<EventRiverEvent>) => void;
}

function eventTime(value: string | number | Date) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  // The reference treats date-only strings as local calendar dates, not UTC ISO instants.
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)?value.replace(/-/g,'/'):value);
}

/** 事件河流图组件。 */
export const EventRiverChart = forwardRef<SiaChartRef, EventRiverChartProps>(function EventRiverChart(
  { series, showLabels=true, draggable=true, appearance='sia', plot=PLOT, animationProgress, boundaryGap = [.05,.1], legendInteractive = true, legendSelected, onLegendSelectionChange, onDataClick, palette, ...props }, ref,
) {
  const [restoreVersion,setRestoreVersion]=useState(0);
  const area=plot;
  palette=palette??(appearance==='macarons'?['#2ec7c9','#b6a2de']:undefined);
  const legend = useLegendSelection(series.map((item) => item.name), legendSelected, onLegendSelectionChange);
  const events = series.flatMap((item, seriesIndex) => legend.isSelected(item.name) ? item.data.map((event) => ({ event, series: item, seriesIndex })) : []);
  const times = events.flatMap((item) => item.event.evolution.map((point) => eventTime(point.time))).filter(Number.isFinite);
  const timeDomain: [number, number] = times.length ? [Math.min(...times), Math.max(...times)] : [0, 1];
  const span = timeDomain[1]-timeDomain[0] || 86400000;
  timeDomain[0]-=span*boundaryGap[0];timeDomain[1]+=span*boundaryGap[1];
  const selectedSeries=series.map((item,seriesIndex)=>({item,seriesIndex})).filter(({item})=>legend.isSelected(item.name));
  const packed=layoutEventRiver(selectedSeries.map(({item})=>({weight:item.weight,data:item.data.map(event=>({weight:event.weight,evolution:[...event.evolution].filter(point=>Number.isFinite(eventTime(point.time))).sort((a,b)=>eventTime(a.time)-eventTime(b.time)).map(point=>({x:linearScale(eventTime(point.time),timeDomain,[area.x,area.x+area.width]),value:point.value}))}))})),Math.max(1,Math.round(area.width/40)),area);
  const timeTicks = calendarReferenceTicks(timeDomain);
  return <SiaChart {...props} className={`${props.className??''}${appearance==='macarons'?' sia-chart--macarons sia-chart--event-river-reference':''}`} toolbox={props.toolbox?{...(props.toolbox===true?{}:props.toolbox),onRestore:()=>{setRestoreVersion(value=>value+1);legend.replace(Object.fromEntries(series.map(item=>[item.name,legendSelected?.[item.name]!==false])));if(typeof props.toolbox==='object')props.toolbox.onRestore?.();}}:false} ref={ref} palette={palette} empty={!events.length || !times.length} ariaLabel={props.ariaLabel ?? "事件河流图"}>
    <ChartLegend items={series.map((item, index) => ({ name: item.name, color: getColor(index, item.color, palette), disabled: !legend.isSelected(item.name) }))} selected={legend.selected} onItemClick={legendInteractive ? legend.toggle : undefined} />
    <ChartAxis orientation="bottom" x={area.x} y={area.y+area.height} length={area.width} positions={timeTicks.map(tick=>(tick.value-timeDomain[0])/(timeDomain[1]-timeDomain[0]||1))} labels={timeTicks.map(tick=>tick.label)} gridLength={area.height} />
    {packed.map(geometry => {
      const {item:eventSeries,seriesIndex}=selectedSeries[geometry.seriesIndex]!;
      const eventIndex=geometry.eventIndex,event=eventSeries.data[eventIndex]!;
      const centerY = geometry.y;
      const color = getColor(seriesIndex, eventSeries.color, palette);
      const emphasisColor=/^#[\da-f]{6}$/i.test(color)?`rgb(${[1,3,5].map(index=>{const value=parseInt(color.slice(index,index+2),16);return Math.floor(value+(255-value)*.2);}).join(',')})`:color;
      const evolution = [...event.evolution].sort((left, right) => eventTime(left.time) - eventTime(right.time));
      const upper=geometry.points.map(point=>[point.x,centerY-point.thickness/2] as const);
      const path = eventRiverOutline(geometry.points,centerY,geometry.tailX);
      return <EventRiverBubble data-event-id={event.id} data-event-series={eventSeries.name} draggable={draggable} resetKey={`${restoreVersion}:${path}`} key={event.id?`${eventSeries.name}-${event.id}`:`${eventSeries.name}-${event.name}-${eventIndex}`} label={`${eventSeries.name}，${event.name}，${event.weight ?? ""}`} tooltip={<><strong>{event.name}</strong><span>{eventSeries.name}</span>{evolution.map((point, index) => <span key={index}>{new Date(eventTime(point.time)).toLocaleDateString()}：{point.value}{point.detail}</span>)}</>} tooltipPoint={[upper[0]?.[0] ?? PLOT.x, centerY]} onPointerUp={(nativeEvent) => onDataClick?.({ name: event.name, value: event.weight ?? Math.max(...evolution.map((point) => point.value)), seriesName: eventSeries.name, data: event, nativeEvent })}>
        <EventRiverMotion key={restoreVersion} geometry={geometry} enabled={props.animation!==false} duration={props.animationDuration??2000} progress={animationProgress}>{frame=>{
          const start=frame.points[0]?.x??area.x,half=Math.max(0,...frame.points.map(point=>point.thickness))/2;
          const x=appearance==='macarons'?Math.round(start)+(frame.tailX-start)/2:(start+frame.tailX)/2;
          const y=appearance==='macarons'?Math.round(frame.y-half)+half:frame.y;
          return <g data-event-scale={frame.scale} transform={`translate(${x} ${y}) scale(${frame.scale}) translate(${-x} ${-y})`}>
          <path style={{'--sia-event-emphasis':emphasisColor} as CSSProperties} d={eventRiverOutline(frame.points,frame.y,frame.tailX,appearance==='macarons')} fill={color} data-event-center={frame.y} data-event-importance={geometry.importance} data-event-tail={frame.tailX} className="sia-chart__event-river" />
          {showLabels&&evolution.length ? <text x={appearance==='macarons'?x:(frame.points[0]?.x??area.x)+6} textAnchor={appearance==='macarons'?'middle':undefined} y={frame.y + 4} className="sia-chart__event-label">{event.name}</text> : null}
        </g>;}}</EventRiverMotion>
      </EventRiverBubble>;
    })}
  </SiaChart>;
});

/** 韦恩图中的集合定义。 */
export interface VennSet {
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
}

/** 韦恩图集合交集的值及展示配置。 */
export interface VennIntersection {
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 名称或字段标识。 */
  name?: string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
}

/** 韦恩图的属性配置。 */
export interface VennChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /**
   * 图形外观配置。
   * @defaultValue "sia"
   */
  appearance?: "sia" | "macarons";
  /** 高亮状态的颜色。 */
  emphasisColor?: string;
  /** 高亮状态的边框颜色。 */
  emphasisBorderColor?: string;
  /** 高亮状态的边框宽度。 */
  emphasisBorderWidth?: number;
  /** 集合定义。 */
  sets: readonly [VennSet, VennSet];
  /** 集合交集数据。 */
  intersection: VennIntersection;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<VennSet | VennIntersection>) => void;
}

function circleIntersectionArea(radiusA: number, radiusB: number, distance: number) {
  if (distance >= radiusA + radiusB) return 0;
  if (distance <= Math.abs(radiusA - radiusB)) return Math.PI * Math.min(radiusA, radiusB) ** 2;
  const alpha = Math.acos((distance ** 2 + radiusA ** 2 - radiusB ** 2) / (2 * distance * radiusA));
  const beta = Math.acos((distance ** 2 + radiusB ** 2 - radiusA ** 2) / (2 * distance * radiusB));
  return radiusA ** 2 * alpha + radiusB ** 2 * beta - 0.5 * Math.sqrt((-distance + radiusA + radiusB) * (distance + radiusA - radiusB) * (distance - radiusA + radiusB) * (distance + radiusA + radiusB));
}

function vennDistance(radiusA: number, radiusB: number, overlap: number) {
  const maximum = Math.PI * Math.min(radiusA, radiusB) ** 2;
  if (overlap <= 0) return radiusA + radiusB;
  if (overlap >= maximum) return Math.abs(radiusA - radiusB);
  let low = Math.abs(radiusA - radiusB);
  let high = radiusA + radiusB;
  for (let index = 0; index < 44; index += 1) {
    const middle = (low + high) / 2;
    if (circleIntersectionArea(radiusA, radiusB, middle) > overlap) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** 韦恩图组件。 */
export const VennChart = forwardRef<SiaChartRef, VennChartProps>(function VennChart(
  { sets:initialSets, intersection:initialIntersection, appearance="sia",emphasisColor,emphasisBorderColor,emphasisBorderWidth,onDataClick, palette,toolbox, ...props }, ref,
) {
  const [sets,setSets]=useState(initialSets),[intersection,setIntersection]=useState(initialIntersection),[active,setActive]=useState<number>();
  useEffect(()=>{setSets(initialSets);setIntersection(initialIntersection);},[initialSets,initialIntersection]);
  const legacy=appearance==='macarons',width=props.viewBoxSize?.[0]??720,height=props.viewBoxSize?.[1]??360;
  const first = Math.max(0, sets[0].value);
  const second = Math.max(0, sets[1].value);
  const overlap = Math.min(Math.max(0, intersection.value), first, second);
  const unitA = Math.sqrt(first / Math.PI);
  const unitB = Math.sqrt(second / Math.PI);
  const scale = (legacy?height/3:126) / (Math.max(unitA, unitB)||1);
  const radiusA = unitA * scale;
  const radiusB = unitB * scale;
  const distance = vennDistance(unitA, unitB, overlap) * scale;
  const totalWidth = radiusA + distance + radiusB;
  const centerA = [legacy?width/2-radiusA:360 - totalWidth / 2 + radiusA, legacy?height/2:183] as const;
  const centerB = [centerA[0] + distance, centerA[1]] as const;
  const colorA = getColor(0, sets[0].color, palette);
  const colorB = getColor(1, sets[1].color, palette);
  const chartToolbox=typeof toolbox==='object'?{...toolbox,dataView:toolbox.dataView??<ChartDataEditor series={[{name:sets[0].name,data:[first]},{name:sets[1].name,data:[second]},{name:intersection.name??'公共',data:[overlap]}]} onApply={values=>{setSets([{...sets[0],value:values[0]![0]!},{...sets[1],value:values[1]![0]!}]);setIntersection({...intersection,value:values[2]![0]!});}}/>,onRestore:()=>{setSets(initialSets);setIntersection(initialIntersection);setActive(undefined);toolbox.onRestore?.();}}:toolbox;
  const markStyle=(index:number,color:string)=>({fill:active===index?(emphasisColor??color):color,stroke:active===index?emphasisBorderColor:undefined,strokeWidth:active===index?emphasisBorderWidth:undefined,opacity:legacy?1:undefined});
  const lens=vennLensPath(centerA[0],centerA[1],radiusA,radiusB,distance);
  return <SiaChart {...props} toolbox={chartToolbox} className={`${props.className??''}${legacy?' sia-chart--macarons':''}`} ref={ref} palette={palette} empty={first <= 0 && second <= 0} ariaLabel={props.ariaLabel ?? "韦恩图"}>
    <ChartMark onPointerMove={()=>setActive(0)} onPointerLeave={()=>setActive(undefined)} onFocus={()=>setActive(0)} onBlur={()=>setActive(undefined)} label={`${sets[0].name}，${first}`} tooltip={<TooltipValue name={sets[0].name} value={first} />} tooltipPoint={centerA} onPointerUp={(event) => onDataClick?.({ name: sets[0].name, value: first, data: sets[0], nativeEvent: event })}>
      <circle cx={centerA[0]} cy={centerA[1]} r={radiusA} fill={colorA} style={markStyle(0,colorA)} className="sia-chart__venn-circle" />
    </ChartMark>
    <ChartMark onPointerMove={()=>setActive(1)} onPointerLeave={()=>setActive(undefined)} onFocus={()=>setActive(1)} onBlur={()=>setActive(undefined)} label={`${sets[1].name}，${second}`} tooltip={<TooltipValue name={sets[1].name} value={second} />} tooltipPoint={centerB} onPointerUp={(event) => onDataClick?.({ name: sets[1].name, value: second, data: sets[1], nativeEvent: event })}>
      <circle cx={centerB[0]} cy={centerB[1]} r={radiusB} fill={colorB} style={markStyle(1,colorB)} className="sia-chart__venn-circle" />
    </ChartMark>
{!legacy?<>    <text x={centerA[0] - Math.min(radiusA * 0.34, distance * 0.24)} y={178} textAnchor="middle" className="sia-chart__venn-label"><tspan x={centerA[0] - Math.min(radiusA * 0.34, distance * 0.24)}>{sets[0].name}</tspan><tspan x={centerA[0] - Math.min(radiusA * 0.34, distance * 0.24)} dy={22}>{first}</tspan></text>
    <text x={centerB[0] + Math.min(radiusB * 0.34, distance * 0.24)} y={178} textAnchor="middle" className="sia-chart__venn-label"><tspan x={centerB[0] + Math.min(radiusB * 0.34, distance * 0.24)}>{sets[1].name}</tspan><tspan x={centerB[0] + Math.min(radiusB * 0.34, distance * 0.24)} dy={22}>{second}</tspan></text></>:<>{[centerA,centerB].map((center,i)=><text key={i} x={center[0]} y={center[1]-(i===0?radiusA:radiusB)-16} textAnchor="middle" style={{fill:i===0?colorA:colorB,fontFamily:"Arial, Verdana, sans-serif",fontSize:16,fontStyle:"italic",fontWeight:"bolder"}}>{sets[i]!.name}</text>)}</>}
    {overlap>0&&lens&&(!legacy||overlap<Math.min(first,second))?<ChartMark onPointerMove={()=>setActive(2)} onPointerLeave={()=>setActive(undefined)} onFocus={()=>setActive(2)} onBlur={()=>setActive(undefined)} label={`${intersection.name??'交集'}，${overlap}`} tooltip={<TooltipValue name={intersection.name??'交集'} value={overlap}/>} tooltipPoint={[(centerA[0]+radiusA+centerB[0]-radiusB)/2,centerA[1]]} onPointerUp={event=>onDataClick?.({name:intersection.name??'交集',value:overlap,data:intersection,nativeEvent:event})}>
      <path d={lens} className="sia-chart__venn-overlap" style={markStyle(2,intersection.color??getColor(2,undefined,palette))}/>
    </ChartMark>:null}
  </SiaChart>;
});

/** 矩形树图数据项的填充、边框和标签样式。 */
export interface TreemapItemStyle {
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 边框颜色。 */
  borderColor?: string;
  /** 边框线宽。 */
  borderWidth?: number;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: {
  /** 是否显示该功能。 */
  show?:boolean;
  /** 将原始值转换为展示文本的函数。 */
  formatter?:string;
  /** 横向位置或 X 轴数据值。 */
  x?:number;
  /** 纵向位置或 Y 轴数据值。 */
  y?:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 文字大小，单位为像素。 */
  fontSize?:number;
  /** 字体族名称。 */
  fontFamily?:string;
  /** 字体样式，例如 normal 或 italic。 */
  fontStyle?:"normal"|"italic";
  /** 文字粗细，可使用数字或 CSS 字重名称。 */
  fontWeight?:string|number};
}

/** 矩形树图的单条数据。 */
export interface TreemapDatum {
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: readonly TreemapDatum[];
  /** 组件根节点的内联样式。 */
  style?: TreemapItemStyle;
  /** 高亮状态配置。 */
  emphasis?: TreemapItemStyle;
}

/** 矩形树图的属性配置。 */
export interface TreemapChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** 用于渲染的数据集合。 */
  data: readonly TreemapDatum[];
  /**
   * 预设或自定义间距
   * @defaultValue 4
   */
  gap?: number;
  /**
   * 允许展示的最大层级深度。
   * @defaultValue 2
   */
  maxDepth?: number;
  /**
   * 是否支持点击节点下钻。
   * @defaultValue false
   */
  drilldown?: boolean;
  /**
   * 是否显示下钻路径面包屑。
   * @defaultValue true
   */
  showBreadcrumb?: boolean;
  /** 布局边界。 */
  bounds?: TreemapLayoutBox;
  /** 数据项样式。 */
  itemStyle?: TreemapItemStyle;
  /** 高亮状态配置。 */
  emphasis?: TreemapItemStyle;
  /**
   * 图形圆角半径。
   * @defaultValue 5
   */
  cornerRadius?: number;
  /**
   * 是否显示子节点边界。
   * @defaultValue false
   */
  showChildBoundaries?: boolean;
  /**
   * 面包屑显示位置。
   * @defaultValue "top"
   */
  breadcrumbPosition?: "top" | "bottom";
  /**
   * 面包屑根节点名称。
   * @defaultValue "全部"
   */
  breadcrumbRootName?: string;
  /** 将数值格式化为显示文本的函数。 */
  valueFormatter?: (value: number) => ReactNode;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<TreemapDatum>) => void;
}

interface TreemapRect { node: TreemapDatum; x: number; y: number; width: number; height: number; depth: number; value: number; colorIndex: number }

function treemapValue(node: TreemapDatum): number {
  if (node.value != null) return Math.max(0, node.value);
  return node.children?.reduce((sum, child) => sum + treemapValue(child), 0) ?? 0;
}

function layoutTreemap(nodes: readonly TreemapDatum[], x: number, y: number, width: number, height: number, gap: number, maxDepth: number, depth = 0, seed = 0): TreemapRect[] {
  const result: TreemapRect[] = [];
  layoutTreemapValues(nodes.map(treemapValue),{x,y,width,height}).forEach((cell) => {
    const node=nodes[cell.index]!;
    const rectangle = { node, x: cell.x + gap / 2, y: cell.y + gap / 2, width: Math.max(0, cell.width - gap), height: Math.max(0, cell.height - gap), depth, value: cell.value, colorIndex: seed + cell.index };
    result.push(rectangle);
    if (node.children?.length && depth < maxDepth && rectangle.width > 80 && rectangle.height > 56) {
      result.push(...layoutTreemap(node.children, rectangle.x + 4, rectangle.y + 25, rectangle.width - 8, rectangle.height - 29, gap, maxDepth, depth + 1, seed + cell.index + 1));
    }
  });
  return result;
}

/** 矩形树图组件。 */
export const TreemapChart = forwardRef<SiaChartRef, TreemapChartProps>(function TreemapChart(
  { data, gap = 4, maxDepth = 2, drilldown = false, showBreadcrumb = true, bounds, itemStyle, emphasis, cornerRadius=5, showChildBoundaries=false, breadcrumbPosition="top", breadcrumbRootName="全部", valueFormatter, onDataClick, palette, toolbox, ...props }, ref,
) {
  const [path, setPath] = useState<string[]>([]);
  const [sourceData,setSourceData]=useState(data);
  const [active,setActive]=useState<number>();
  useEffect(()=>{setSourceData(data);setPath([]);},[data]);
  const currentData = path.reduce<readonly TreemapDatum[]>((nodes, name) => nodes.find((node) => node.name === name)?.children ?? nodes, sourceData);
  const top = drilldown && showBreadcrumb ? 52 : 28;
  const rectangles = useMemo(() => layoutTreemap(currentData, bounds?.x??24, bounds?.y??top, bounds?.width??672, bounds?.height??336-top, gap, maxDepth), [currentData, gap, maxDepth, top,bounds]);
  const chartToolbox=typeof toolbox==="object"?{...toolbox,dataView:toolbox.dataView??<ChartDataEditor readOnly={toolbox.dataViewReadOnly} series={currentData.map(node=>({name:node.name,data:[treemapValue(node)]}))} onApply={values=>{
    const update=(nodes:readonly TreemapDatum[],depth:number):TreemapDatum[]=>nodes.map((node,i)=>depth===path.length?{...node,value:values[i]![0]}:node.name===path[depth]?{...node,children:update(node.children??[],depth+1)}:node);
    setSourceData(update(sourceData,0));
  }}/>,onRestore:()=>{setSourceData(data);setPath([]);setActive(undefined);toolbox.onRestore?.();}}:toolbox;
  return <SiaChart key={path.join('/')} {...props} toolbox={chartToolbox} ref={ref} palette={palette} empty={!rectangles.length} ariaLabel={props.ariaLabel ?? "矩形树图"}>
    {drilldown && showBreadcrumb ? <g className="sia-chart__treemap-breadcrumb">
      {[breadcrumbRootName, ...path].map((name, index) => <g key={`${name}-${index}`} transform={`translate(${(bounds?.x??24) + index * 96} ${breadcrumbPosition==="bottom"?(bounds?.y??28)+(bounds?.height??308)+4:28})`} role="button" tabIndex={0} onPointerUp={() => setPath(path.slice(0, index))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") {event.preventDefault();setPath(path.slice(0, index));} }}><rect width={86} height={24} rx={5} style={breadcrumbPosition==="bottom"?{fill:"transparent",stroke:"none"}:undefined}/><text x={breadcrumbPosition==="bottom"?0:43} y={16} textAnchor={breadcrumbPosition==="bottom"?"start":"middle"}>{name}{index<path.length?" >":""}</text></g>)}
    </g> : null}
    {rectangles.map((rectangle, index) => {
      const normal={...itemStyle,...rectangle.node.style,label:{...itemStyle?.label,...rectangle.node.style?.label}};
      const hover={...emphasis,...rectangle.node.emphasis,label:{...normal.label,...emphasis?.label,...rectangle.node.emphasis?.label}};
      const style=active===index?{...normal,...hover}:normal;
      const color = style.color??rectangle.node.color ?? getColor(rectangle.colorIndex, undefined, palette);
      const showLabel = rectangle.width > 45 && rectangle.height > 24;
      const enter=()=>{if(drilldown&&rectangle.node.children?.length){setPath(current=>[...current,rectangle.node.name]);setActive(undefined);}};
      return <ChartMark key={`${path.join('/')}/${rectangle.node.name}-${index}`} onPointerMove={()=>setActive(index)} onPointerLeave={()=>setActive(undefined)} onFocus={()=>setActive(index)} onBlur={()=>setActive(undefined)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();enter();}}} label={`${rectangle.node.name}，${formatChartNumber(rectangle.value)}`} tooltip={<TooltipValue name={rectangle.node.name} value={rectangle.value} formatter={valueFormatter} />} tooltipPoint={[rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2]} onPointerUp={(event) => { enter(); onDataClick?.({ name: rectangle.node.name, value: rectangle.value, data: rectangle.node, nativeEvent: event }); }}>
        <rect x={rectangle.x} y={rectangle.y} width={rectangle.width} height={rectangle.height} rx={cornerRadius} fill={color} style={{stroke:style.borderColor,strokeWidth:style.borderWidth}} className={`sia-chart__treemap-node sia-chart__treemap-node--depth-${rectangle.depth}`} />
        {showChildBoundaries&&rectangle.node.children?.length?<g pointerEvents="none">{layoutTreemap(rectangle.node.children,rectangle.x,rectangle.y,rectangle.width,rectangle.height,0,0).map(child=><rect key={child.node.name} x={child.x} y={child.y} width={child.width} height={child.height} fill="none" stroke={style.borderColor??"#ccc"} strokeWidth={1}/>)}</g>:null}
        {showLabel&&style.label?.show!==false ? <text x={rectangle.x + (style.label?.x??9)} y={rectangle.y + (style.label?.y??18)} className="sia-chart__treemap-label" style={{fill:style.label?.color,fontSize:style.label?.fontSize,fontFamily:style.label?.fontFamily,fontWeight:style.label?.fontWeight,fontStyle:style.label?.fontStyle}}><tspan>{(style.label?.formatter??"{b}").replaceAll("{b}",rectangle.node.name).replaceAll("{c}",String(rectangle.value))}</tspan>{!itemStyle?.label?.formatter&&rectangle.height > 44 ? <tspan x={rectangle.x + 9} dy={17}>{valueFormatter ? valueFormatter(rectangle.value) : formatChartNumber(rectangle.value)}</tspan> : null}</text> : null}
      </ChartMark>;
    })}
  </SiaChart>;
});

/** 树的单条数据。 */
export interface TreeDatum {
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: readonly TreeDatum[];
  /** 是否收起；传入后由外部控制。 */
  collapsed?: boolean;
  /** 数据点或节点使用的图形符号。 */
  symbol?: "circle" | "square" | "diamond" | `image://${string}`;
  /** 数据项样式。 */
  itemStyle?: TreeItemStyle;
  /** 高亮状态配置。 */
  emphasis?: TreeItemStyle;
  /** 数据符号尺寸。 */
  symbolSize?: number | readonly [number,number];
}

/** 树图的属性配置。 */
export interface TreeChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /** 数据项样式。 */
  itemStyle?: TreeItemStyle;
  /** 高亮状态配置。 */
  emphasis?: TreeItemStyle;
  /** 用于渲染的数据集合。 */
  data: TreeDatum;
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /**
   * 是否使用径向布局。
   * @defaultValue false
   */
  radial?: boolean;
  /**
   * 节点尺寸。
   * @defaultValue 8
   */
  nodeSize?: number;
  /** 根节点的布局位置。 */
  rootPosition?: readonly [number,number];
  /** 相邻节点的间距。 */
  nodePadding?: number;
  /** 相邻层级的间距。 */
  layerPadding?: number;
  /**
   * 是否显示数据标签。
   * @defaultValue true
   */
  showLabels?: boolean;
  /**
   * 高亮时是否显示节点标签。
   * @defaultValue true
   */
  emphasisShowLabels?: boolean;
  /** 节点颜色。 */
  nodeColor?: string;
  /** 边的颜色。 */
  edgeColor?: string;
  /** 边的线宽。 */
  edgeWidth?: number;
  /** 边的阴影配置。 */
  edgeShadow?: {
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string;
  /** 模糊半径。 */
  blur:number;
  /** 水平方向的偏移量。 */
  offsetX:number;
  /** 垂直方向的偏移量。 */
  offsetY:number};
  /**
   * 地图或图表的平移、缩放配置。
   * @defaultValue false
   */
  roam?: boolean;
  /**
   * 是否启用鼠标悬停反馈。
   * @defaultValue true
   */
  hoverable?: boolean;
  /** 标签字体大小。 */
  labelFontSize?: number;
  /** 标签文字颜色。 */
  labelColor?: string;
  /**
   * 节点连线样式。
   * @defaultValue "curve"
   */
  linkStyle?: "curve" | "broken" | "straight";
  /**
   * 允许收起内容区域
   * @defaultValue false
   */
  collapsible?: boolean;
  /** 节点或交互状态切换时调用。 */
  onToggle?: (node: TreeDatum, collapsed: boolean) => void;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<TreeDatum>) => void;
}

interface TreeLayoutNode { node: TreeDatum; depth: number; order: number; parent?: number }

function flattenTree(root: TreeDatum, collapsed: ReadonlySet<string>) {
  const nodes: TreeLayoutNode[] = [];
  let leafOrder = 0;
  function visit(node: TreeDatum, depth: number, parent?: number): number {
    const index = nodes.length;
    nodes.push({ node, depth, order: 0, parent });
    const childOrders = collapsed.has(node.name) ? [] : node.children?.map((child) => visit(child, depth + 1, index)) ?? [];
    const order = childOrders.length ? childOrders.reduce((sum, value) => sum + value, 0) / childOrders.length : leafOrder++;
    nodes[index]!.order = order;
    return order;
  }
  visit(root, 0);
  return { nodes, leafCount: Math.max(1, leafOrder), maxDepth: Math.max(0, ...nodes.map((item) => item.depth)) };
}

/** 树图组件。 */
export const TreeChart = forwardRef<SiaChartRef, TreeChartProps>(function TreeChart(
  { data, itemStyle,emphasis,orientation = "horizontal", radial = false, nodeSize = 8, rootPosition,nodePadding,layerPadding,showLabels=true,emphasisShowLabels=true,nodeColor,edgeColor,edgeWidth,edgeShadow,roam=false,hoverable=true,labelFontSize,labelColor,linkStyle = "curve", collapsible = false, onToggle, onDataClick, palette, toolbox, ...props }, ref,
) {
  const [sourceData,setSourceData]=useState(data);
  const [roamReset,setRoamReset]=useState(0);
  const [active,setActive]=useState<number>();
  useEffect(()=>{setSourceData(data);setActive(undefined);},[data]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const result = new Set<string>();
    const visit = (node: TreeDatum) => { if (node.collapsed) result.add(node.name); node.children?.forEach(visit); };
    visit(data);
    return result;
  });
  const layout = useMemo(() => flattenTree(sourceData, collapsed), [collapsed, sourceData]);
  const fixedLayout=useMemo(()=>{
    const visible=(node:TreeDatum):TreeDatum=>({...node,children:collapsed.has(node.name)?[]:node.children?.map(visible)});
    return rootPosition?layoutTreeNodes(visible(sourceData),{nodeSize,nodePadding,layerPadding,rootPosition,orientation}):undefined;
  },[sourceData,collapsed,rootPosition,nodeSize,nodePadding,layerPadding,orientation]);
  const positions = layout.nodes.map((item) => {
    if (radial) {
      const angle = -Math.PI / 2 + item.order / Math.max(1, layout.leafCount) * Math.PI * 2;
      const radius = 25 + item.depth / Math.max(1, layout.maxDepth) * 126;
      return [360 + Math.cos(angle) * radius, 185 + Math.sin(angle) * radius] as const;
    }
    const cross = 50 + item.order / Math.max(1, layout.leafCount - 1) * 260;
    const main = 76 + item.depth / Math.max(1, layout.maxDepth) * 560;
    return orientation === "horizontal" ? [main, cross] as const : [cross + 155, main - 30] as const;
  }).map((point,index)=>fixedLayout?[fixedLayout[index]!.x,fixedLayout[index]!.y] as const:point);
  const chartToolbox=typeof toolbox==="object"?{...toolbox,dataView:toolbox.dataView??<ChartDataEditor readOnly={toolbox.dataViewReadOnly} series={flattenTree(sourceData,new Set()).nodes.map(item=>({name:item.node.name,data:[item.node.value??0]}))} onApply={values=>{let cursor=0;const update=(node:TreeDatum):TreeDatum=>{const value=values[cursor++]![0];return {...node,value,children:node.children?.map(update)};};setSourceData(update(sourceData));}}/>,onRestore:()=>{setSourceData(data);setActive(undefined);setCollapsed(new Set());setRoamReset(n=>n+1);toolbox.onRestore?.();}}:toolbox;
  return <SiaChart {...props} toolbox={chartToolbox} ref={ref} palette={palette} empty={!layout.nodes.length} ariaLabel={props.ariaLabel ?? "树图"}>
    <ChartRoamGroup enabled={roam} width={props.viewBoxSize?.[0]??720} height={props.viewBoxSize?.[1]??360} resetSignal={roamReset}>
    <g className="sia-chart__tree-links" style={edgeShadow?{filter:`drop-shadow(${edgeShadow.offsetX}px ${edgeShadow.offsetY}px ${edgeShadow.blur}px ${edgeShadow.color})`}:undefined}>
      {layout.nodes.map((item, index) => {
        if (item.parent == null) return null;
        const source = positions[item.parent]!;
        const target = positions[index]!;
        const bend = fixedLayout ? .618 : .5;
        const path = radial || linkStyle === "straight"
          ? `M ${source[0]} ${source[1]} L ${target[0]} ${target[1]}`
          : linkStyle === "broken" && orientation === "horizontal"
            ? `M ${source[0]} ${source[1]} H ${(source[0] + target[0]) / 2} V ${target[1]} H ${target[0]}`
          : linkStyle === "broken"
            ? `M ${source[0]} ${source[1]} V ${(source[1] + target[1]) / 2} H ${target[0]} V ${target[1]}`
          : orientation === "horizontal"
            ? `M ${source[0]} ${source[1]} C ${source[0]+(target[0]-source[0])*bend} ${source[1]}, ${source[0]+(target[0]-source[0])*(1-bend)} ${target[1]}, ${target[0]} ${target[1]}`
            : `M ${source[0]} ${source[1]} C ${source[0]} ${source[1]+(target[1]-source[1])*bend}, ${target[0]} ${source[1]+(target[1]-source[1])*(1-bend)}, ${target[0]} ${target[1]}`;
        return <path key={index} d={path} style={{stroke:edgeColor,strokeWidth:edgeWidth}} />;
      })}
    </g>
    {layout.nodes.map((item, index) => {
      const position = positions[index]!;
      const resolved=resolveTreeItemStyle(itemStyle,item.node.itemStyle,emphasis,item.node.emphasis,active===index);
      const color = getColor(item.depth, resolved.color??item.node.color??nodeColor, palette);
      const radius = fixedLayout?fixedLayout[index]!.width/2:nodeSize + Math.min(7, Math.sqrt(Math.max(0, item.node.value ?? 0)));
      const glyphHeight=fixedLayout?.[index]?.height??radius*2;
      const labelPosition=resolved.label?.position??(orientation==='vertical'&&!radial?'bottom':'right');
      const labelX=position[0]+(labelPosition==='right'?radius+5:labelPosition==='left'?-radius-5:0);
      const labelY=position[1]+(labelPosition==='bottom'?glyphHeight/2+14:labelPosition==='top'?-glyphHeight/2-5:(resolved.label?.fontSize??labelFontSize??12)/3);
      return <ChartMark key={`${item.node.name}-${index}`} onPointerMove={()=>{if(hoverable)setActive(index);}} onPointerLeave={()=>setActive(undefined)} onFocus={()=>{if(hoverable)setActive(index);}} onBlur={()=>setActive(undefined)} label={`${item.node.name}${item.node.value == null ? "" : `，${item.node.value}`}`} tooltip={hoverable?<TooltipValue name={item.node.name} value={item.node.value ?? 0} />:undefined} tooltipPoint={position} onPointerUp={(event) => {
        if (collapsible && item.node.children?.length) {
          const nextCollapsed = !collapsed.has(item.node.name);
          setCollapsed((current) => { const next = new Set(current); if (nextCollapsed) next.add(item.node.name); else next.delete(item.node.name); return next; });
          onToggle?.(item.node, nextCollapsed);
        }
        onDataClick?.({ name: item.node.name, value: item.node.value ?? 0, data: item.node, nativeEvent: event });
      }}>
        <TreeNodeGlyph symbol={item.node.symbol} x={position[0]} y={position[1]} width={radius*2} height={glyphHeight} color={color} itemStyle={resolved}/>
        {collapsible && item.node.children?.length ? <text x={position[0]} y={position[1] + 4} textAnchor="middle" className="sia-chart__tree-toggle">{collapsed.has(item.node.name) ? "+" : "−"}</text> : null}
        {(resolved.label?.show??(active===index?emphasisShowLabels:showLabels))?<text x={labelX} y={labelY} textAnchor={labelPosition==='left'?'end':labelPosition==='right'?'start':'middle'} style={{fontSize:resolved.label?.fontSize??labelFontSize,fill:resolved.label?.color??labelColor,fontWeight:resolved.label?.fontWeight}} className="sia-chart__tree-label">{(resolved.label?.formatter??'{b}').replaceAll('{b}',item.node.name).replaceAll('{c}',String(item.node.value??''))}</text>:null}
      </ChartMark>;
    })}
    </ChartRoamGroup>
  </SiaChart>;
});

/** WordCloud的单条数据。 */
export interface WordCloudDatum {
  /** 名称或字段标识。 */
  name: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 旋转角度。 */
  rotation?: number;
  /** 文字大小，单位为像素。 */
  fontSize?: number;
  /** 字体族名称。 */
  fontFamily?: string;
  /** 文字粗细，可使用数字或 CSS 字重名称。 */
  fontWeight?: number | string;
}

/** 词云的属性配置。 */
export interface WordCloudChartProps extends Omit<SiaChartProps, "children" | "empty"> {
  /**
   * 图形面积的计算方式。
   * @defaultValue false
   */
  areaSizing?: boolean;
  /** 布局边界。 */
  bounds?: CloudBounds;
  /**
   * 是否自动适配可用绘图空间。
   * @defaultValue false
   */
  autoFit?: boolean;
  /** 布局计算完成时调用。 */
  onLayout?: (result:{
  /** 成功放置的词条集合。 */
  placed:number;
  /** 未能放入布局的词条集合。 */
  unplaced:readonly string[]})=>void;
  /** 用于渲染的数据集合。 */
  data: readonly WordCloudDatum[];
  /**
   * 允许的最小文字大小。
   * @defaultValue 14
   */
  minFontSize?: number;
  /**
   * 允许的最大文字大小。
   * @defaultValue 52
   */
  maxFontSize?: number;
  /**
   * 允许的文字旋转角度集合。
   * @defaultValue [0, 0, -28, 28, 0]
   */
  rotations?: readonly number[];
  /**
   * 词云布局螺旋搜索的步长。
   * @defaultValue 9
   */
  spiralStep?: number;
  /**
   * 外观形状。
   * @defaultValue "ellipse"
   */
  shape?: "ellipse" | "circle" | "square" | "diamond";
  /**
   * 内容内边距。
   * @defaultValue 4
   */
  padding?: number;
  /** 字体族名称。 */
  fontFamily?: string;
  /**
   * 文字粗细，可使用数字或 CSS 字重名称。
   * @defaultValue 650
   */
  fontWeight?: number | string;
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<WordCloudDatum>) => void;
}


/** 词云组件。 */
export const WordCloudChart = forwardRef<SiaChartRef, WordCloudChartProps>(function WordCloudChart(
  { data, bounds,areaSizing=false,autoFit=false,onLayout,minFontSize = 14, maxFontSize = 52, rotations = [0, 0, -28, 28, 0], spiralStep = 9, shape = "ellipse", padding = 4, fontFamily, fontWeight = 650, onDataClick, palette, ...props }, ref,
) {
  const placements = useMemo(() => {
    const context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
    return layoutCloudWords(data,{bounds:bounds??{x:18,y:18,width:684,height:324},minFontSize,maxFontSize,rotations,spiralStep,shape,padding,autoFit,areaSizing,measure:context?(word,size)=>{context.font=`${word.fontWeight??fontWeight} ${size}px ${word.fontFamily??fontFamily??'Arial'}`;return context.measureText(word.name).width;}:undefined});
  },[data,bounds,autoFit,areaSizing,maxFontSize,minFontSize,padding,rotations,shape,spiralStep,fontFamily,fontWeight]);
  useEffect(()=>{const present=new Set(placements.map(p=>p.index));onLayout?.({placed:placements.length,unplaced:data.filter((_,i)=>!present.has(i)).map(item=>item.name)});},[placements,data,onLayout]);
  return <SiaChart {...props} ref={ref} palette={palette} empty={!placements.length} ariaLabel={props.ariaLabel ?? "字符云"}>
    {placements.map((placement) => {
      const color = getColor(placement.index, placement.item.color, palette);
      return <ChartMark key={`${placement.item.name}-${placement.index}`} label={`${placement.item.name}，${placement.item.value}`} tooltip={<TooltipValue name={placement.item.name} value={placement.item.value} />} tooltipPoint={[placement.x, placement.y]} transform={`rotate(${placement.rotation} ${placement.x} ${placement.y})`} onPointerUp={(event) => onDataClick?.({ name: placement.item.name, value: placement.item.value, data: placement.item, nativeEvent: event })}>
        <text x={placement.x} y={placement.y + placement.fontSize * 0.34} textAnchor="middle" fill={color} style={{ fontSize: placement.fontSize, fontFamily: placement.item.fontFamily ?? fontFamily, fontWeight: placement.item.fontWeight ?? fontWeight }} className="sia-chart__word">{placement.item.name}</text>
      </ChartMark>;
    })}
  </SiaChart>;
});

/** Mixed的数据系列。 */
export interface MixedSeries extends Omit<ChartSeries,'data'> {
  /** Distinct co-located category axes own separate bar groups and stacking totals. */
  categoryAxisIndex?: number;
  /** Diameter in chart coordinates; defaults to the existing 9px marker. */
  symbolSize?: number;
  /** 数据点是否使用空心符号。 */
  hollowSymbol?: boolean;
  /** 面积填充透明度。 */
  areaOpacity?:number;
  /** 数据采样方式，用于减少绘制点数。 */
  sampling?:'pixel';
  /** 标记使用的图形符号。 */
  markSymbol?: 'arrow' | 'none';
  /** 是否显示标记标签。 */
  showMarkLabel?: boolean;
  /** 提示框按数据项还是坐标轴触发。 */
  tooltipTrigger?: 'item'|'axis';
  /** 用于渲染的数据集合。 */
  data:readonly (number|null)[];
  /** 堆叠分组标识；同标识的数据系列参与同组堆叠。 */
  stack?: string;
  /** 柱形宽度。 */
  barWidth?: number;
  /** 柱形圆角。 */
  barRadius?: number;
  /** 各数据点的颜色。 */
  pointColors?: readonly (string | undefined)[];
  /** 是否显示数据点。 */
  showPoints?: boolean;
  /** 线条样式。 */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /** 线条粗细。 */
  lineWidth?: number;
  /** 是否显示平均值标记。 */
  markAverage?: boolean;
  /** 标记颜色。 */
  markColor?: string;
  /** 标记文本格式化函数。 */
  markFormatter?: (value:number)=>ReactNode;
  /** Index into valueAxes; distinct units must never share an inferred range. */
  valueAxisIndex?: number;
  /** 类型标识，用于选择对应的表现形式。 */
  type: "line" | "bar";
  /** 连接数据点的曲线类型。 */
  curve?: LineSeries["curve"];
  /** 面积区域填充配置。 */
  area?: boolean;
}

/** 混合图的属性配置。 */
export interface MixedChartProps extends Omit<CartesianChartProps, "series"> {
  /** 坐标轴指示线配置。 */
  axisPointer?: boolean | {
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?:number;
  /** 线条样式。 */
  lineStyle?:'solid'|'dashed'|'dotted';
  /** 是否对齐到像素网格。 */
  pixelAlign?:boolean;
  /** 是否联动高亮关联数据。 */
  linkedEmphasis?:boolean};
  /** Labels for co-located category axes, used by axis-specific tooltips and accessible marks. */
  categoryAxisLabels?: readonly (readonly string[])[];
  /** 柱形之间的间距配置。 */
  barSpacing?: MixedBarSpacing;
  /** With overlay enabled, renderAxes is called for base content and then foreground strokes. */
  axisLayering?: 'inline'|'overlay';
  /** 是否绘制坐标轴或自定义轴渲染函数。 */
  renderAxes?: (context:{
  /** 当前图层标识或图层配置。 */
  layer:'all'|'base'|'line';
  /** 绘图区或图形绘制配置。 */
  plot:{
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
  /** 各类目在绘图区中的位置。 */
  categoryPositions:readonly number[];
  /** 各数值轴的数据范围。 */
  valueDomains:readonly (readonly [number,number,number])[]})=>ReactNode;
  /**
   * 坐标位置变化时的动画配置。
   * @defaultValue false
   */
  coordinateAnimation?:boolean;
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?:number;
  /**
   * 数据更新动画的持续时间。
   * @defaultValue 500
   */
  animationDurationUpdate?:number;
  /** Leave half a category slot at either end; bars always require category slots. */
  boundaryGap?:boolean;
  /** Clip series geometry and hit targets to the plot (fixed domains). */
  clipPlot?: boolean;
  /** 当前激活的数据索引。 */
  activeIndex?: number | null;
  /** 当前激活数据索引变化时调用。 */
  onActiveIndexChange?: (index:number|null)=>void;
  /**
   * 是否显示类目标签。
   * @defaultValue true
   */
  showCategoryLabels?: boolean;
  /**
   * 类目标签显示间隔。
   * @defaultValue 0
   */
  categoryLabelInterval?: number | "auto";
  /** 数据转移的关联标识。 */
  transferId?:string;
  /** 图表间转移数据值时调用。 */
  onValueTransfer?:ChartValueTransferHandler;
  /**
   * 是否允许通过拖拽图形修改数据。
   * @defaultValue false
   */
  calculable?: boolean;
  /** 图表间数据转移失败时调用。 */
  onTransferError?: (message:string)=>void;
  /**
   * 提示框按数据项还是坐标轴触发。
   * @defaultValue 'item'
   */
  tooltipTrigger?: 'item'|'axis';
  /** 图例名称集合。 */
  legendNames?: readonly string[];
  /** 坐标轴提示内容格式化函数。 */
  axisTooltipFormatter?: (index:number,series:readonly MixedSeries[],categoryAxisIndex?:number)=>ReactNode;
  /** 图例布局配置。 */
  legendLayout?: {
  /** 横向位置或 X 轴数据值。 */
  x?:number;
  /** 纵向位置或 Y 轴数据值。 */
  y?:number;
  /** 允许的最大宽度。 */
  maxWidth?:number;
  /** 数据点或节点使用的图形符号。 */
  symbol?:'rect'|'line'|'sector'|'auto'};
  /** 绘图区边界。 */
  plotBounds?: {
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
  /** 数据被交互修改后调用。 */
  onDataChange?: (series:readonly MixedSeries[])=>void;
  /**
   * 是否堆叠展示数据系列。
   * @defaultValue false
   */
  stacked?: boolean;
  /** 多数值轴配置集合。 */
  valueAxes?: readonly {
  /** 是否根据数据自动计算轴范围。 */
  autoDomain?:MixedValueDomainOptions;
  /** 名称或字段标识。 */
  name?: string;
  /** 坐标轴的数据取值范围。 */
  domain?: readonly [number,number,number];
  /** 显示位置或定位配置。 */
  position?: 'left'|'right';
  /** 将原始值转换为展示文本的函数。 */
  formatter?:(value:number)=>string;
  /** 坐标轴线颜色。 */
  axisColor?:string;
  /** 网格线颜色。 */
  gridColor?:string;
  /** 是否显示刻度线。 */
  showTicks?:boolean;
  /** 名称的文字样式。 */
  nameStyle?:CSSProperties}[];
  /** 图表数据系列。 */
  series: readonly MixedSeries[];
  /** 点击图表数据项时调用。 */
  onDataClick?: (info: ChartDataClickInfo<number>) => void;
}

/** 混合图组件。 */
export const MixedChart = forwardRef<SiaChartRef, MixedChartProps>(function MixedChart(
  { axisPointer,categoryAxisLabels,axisLayering="inline",barSpacing,renderAxes,coordinateAnimation=false, animationProgress, animationDurationUpdate=500, boundaryGap=true, categories, activeIndex,onActiveIndexChange,showCategoryLabels=true,categoryLabelInterval=0,clipPlot=false, series:sourceSeries, valueAxes, stacked:sourceStacked=false, plotBounds,tooltipTrigger='item',calculable=false,onTransferError,onDataChange,transferId,onValueTransfer,toolbox,legendNames,axisTooltipFormatter,legendLayout,showLegend = true, legendInteractive = true, legendSelected, onLegendSelectionChange, valueFormatter, onDataClick, palette, ...props }, ref,
) {
  const plotClipId=`sia-mixed-plot-${useId().replaceAll(':','')}`;
  const [editableSeries,setEditableSeries]=useState(sourceSeries);
  const [geometry,setGeometry]=useState<'bar'|'line'>();
  const [pointerIndex,setPointerIndex]=useState<number|null>(null);
  const [pointerAxisIndex,setPointerAxisIndex]=useState(0);
  const [motionRevision,setMotionRevision]=useState(0);
  const [stackMode,setStackMode]=useState<boolean>();
  const lastPublished=useRef<readonly MixedSeries[]|null>(null);
  const publishData=(next:readonly MixedSeries[])=>{lastPublished.current=next;onDataChange?.(next);};
  const [islands,setIslands]=useState<(CartesianIsland&{x:number;y:number})[]>([]);
  const drag=useRef<{series:number;index:number;x:number;y:number;moved:boolean}|null>(null);
  const [dragOffset,setDragOffset]=useState<{series:number;index:number;x:number;y:number}>();
  useEffect(()=>{if(sourceSeries===lastPublished.current)return;setEditableSeries(sourceSeries);setIslands([]);drag.current=null;setDragOffset(undefined);},[sourceSeries]);
  const series=useMemo(()=>editableSeries.map(item=>geometry?{...item,type:geometry}:item),[editableSeries,geometry]);
  const stacked=stackMode??sourceStacked;
  const PLOT=plotBounds??{x:62,y:48,width:628,height:250},PLOT_BOTTOM=PLOT.y+PLOT.height;
  const legend = useLegendSelection(series.map((item) => item.name), legendSelected, onLegendSelectionChange);
  const options=toolbox===true?{}:toolbox||undefined;
  const chartToolbox=options?{...options,activeMagicType:geometry??series[0]?.type,
    onMagicTypeChange:(type:string)=>{if(type==='bar'||type==='line')setGeometry(type);if(type==='stack')setStackMode(true);if(type==='tiled')setStackMode(false);options.onMagicTypeChange?.(type);},
    onRestore:()=>{if(coordinateAnimation)setMotionRevision(value=>value+1);setPointerIndex(null);setPointerAxisIndex(0);setEditableSeries(sourceSeries);setIslands([]);drag.current=null;setDragOffset(undefined);setGeometry(undefined);setStackMode(undefined);legend.replace(Object.fromEntries(sourceSeries.map(item=>[item.name,legendSelected?.[item.name]??true])));options.onRestore?.();},
    dataView:options.dataView??<ChartDataEditor<number|null> allowNull readOnly={options.dataViewReadOnly} series={editableSeries} onApply={values=>{const next=editableSeries.map((item,index)=>({...item,data:values[index]!}));setEditableSeries(next);publishData(next);}}/>,
  }:undefined;
  const activeSeries = series.filter((item) => legend.isSelected(item.name));
  const layout=layoutBarValues(activeSeries.map(item=>({...item,data:item.data.map(value=>value===null?{value:0,hidden:true}:value),stack:stackMode!==false&&(stacked||item.stack!==undefined)?JSON.stringify([item.categoryAxisIndex??0,item.valueAxisIndex??0,item.type,stacked?'all':item.stack]):undefined})),categories.length);
  const domain = niceChartDomain(layout.bounds);
  const axisDomains=valueAxes?.map((axis,index)=>axis.domain??(axis.autoDomain?mixedValueDomain(activeSeries.flatMap((item,row)=>(item.valueAxisIndex??0)===index?layout.rows[row]!.flatMap(point=>point?[point.end]:[]):[]),axis.autoDomain):niceChartDomain(activeSeries.flatMap((item,row)=>(item.valueAxisIndex??0)===index?layout.rows[row]!.flatMap(point=>point?[point.start,point.end]:[]):[]))));
  const barSeries = activeSeries.filter((item) => item.type === "bar");
  const renderSeries=activeSeries.some(item=>item.categoryAxisIndex!==undefined)?[...activeSeries].sort((a,b)=>a.type===b.type?(b.categoryAxisIndex??0)-(a.categoryAxisIndex??0):a.type==='bar'?-1:1):activeSeries;
  const categoryName=(index:number,axisIndex=0)=>categoryAxisLabels?.[axisIndex]?.[index]??categories[index]??`${index+1}`;
  const axisTooltip=(index:number,axisIndex=0)=>{
    const rows=activeSeries.filter(item=>(item.categoryAxisIndex??0)===axisIndex);
    return axisTooltipFormatter?axisTooltipFormatter(index,rows,axisIndex):<><strong>{categoryName(index,axisIndex).trim()}</strong>{rows.map(item=><span key={item.name}>{item.name}：{item.data[index]==null?'-':valueFormatter?valueFormatter(item.data[index]!):item.data[index]}</span>)}</>;
  };
  const categoryGap=boundaryGap||barSeries.length>0;
  const band = PLOT.width / Math.max(1, categories.length-(categoryGap?0:1));
  const categoryAt=(index:number)=>PLOT.x+(categories.length===1?.5:categoryGap?index+.5:index)*(categories.length===1?PLOT.width:band);
  const labelStep=categoryLabelStep(categories,PLOT.width,categoryLabelInterval,false,categoryGap);
  const updatePointer=(index:number|null,axisIndex=0)=>{if(axisPointer){setPointerIndex(index);setPointerAxisIndex(axisIndex);}onActiveIndexChange?.(index);};
  const activeProps=(index:number,axisIndex=0)=>({onFocus:()=>updatePointer(index,axisIndex),onBlur:()=>updatePointer(null),onPointerMove:()=>updatePointer(index,axisIndex),onPointerLeave:()=>updatePointer(null),onKeyDown:(event:React.KeyboardEvent<SVGGElement>)=>{if(event.key==='Escape')updatePointer(null);}});
  const shownPointer=activeIndex===undefined?pointerIndex:activeIndex;
  const pointerStyle=typeof axisPointer==='object'?axisPointer:{};
  const pointerWidth=pointerStyle.width??1;
  const rawPointerX=shownPointer==null?0:categoryAt(shownPointer);
  const pointerX=pointerStyle.pixelAlign?(Math.round(pointerWidth)%2?Math.floor(rawPointerX)+.5:Math.round(rawPointerX)):rawPointerX;
  function finishDrag(event:PointerEvent<SVGGElement>){
    const source=drag.current;drag.current=null;setDragOffset(undefined);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(!source?.moved)return false;
    if(transferId&&onValueTransfer&&source.series>=0){
      const crossTarget=findCompositeValueTarget(event.currentTarget,event.clientX,event.clientY);
      if(crossTarget&&crossTarget.chart!==transferId){
        try{onValueTransfer({chart:transferId,series:source.series,index:source.index},crossTarget);}catch(error){onTransferError?.(error instanceof Error?error.message:String(error));}
        return true;
      }
    }
    const svg=event.currentTarget.ownerSVGElement;
    const hit=document.elementsFromPoint(event.clientX,event.clientY).map(node=>node.closest('[data-mixed-series]')).find(node=>node&&node!==event.currentTarget&&svg?.contains(node));
    const target=hit?{series:Number(hit.getAttribute('data-mixed-series')),index:Number(hit.getAttribute('data-mixed-index'))}:null;
    // Islands are retained separately; dropping onto an island does not discard either value.
    const destination=target&&target.series>=0?target:null;
    const matrix=svg?.getScreenCTM();
    const point=matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):{x:PLOT.x,y:PLOT.y};
    try{
      if(source.series<0){
        const island=islands[source.index];if(!island)return true;
        if(destination){
          const temporary:MixedSeries={name:island.seriesName,type:'bar',data:[island.value]};
          const result=transferCartesianValue([...editableSeries,temporary],{series:editableSeries.length,index:0},destination,[island.name]);
          const next=result.series.slice(0,-1);setEditableSeries(next);publishData(next);
          setIslands(current=>current.filter((_,index)=>index!==source.index));
        }else setIslands(current=>current.map((value,index)=>index===source.index?{...value,x:Math.max(25,Math.min((props.viewBoxSize?.[0]??720)-25,point.x)),y:Math.max(30,Math.min((props.viewBoxSize?.[1]??360)-30,point.y))}:value));
      }else{
        const result=transferCartesianValue(editableSeries,source,destination,categories);
        setEditableSeries(result.series);publishData(result.series);
        if(result.island)setIslands(current=>[...current,{...result.island!,x:Math.max(25,Math.min((props.viewBoxSize?.[0]??720)-25,point.x)),y:Math.max(30,Math.min((props.viewBoxSize?.[1]??360)-30,point.y))}]);
      }
    }catch(error){onTransferError?.(error instanceof Error?error.message:String(error));}
    return true;
  }
  function dragProps(seriesIndex:number,index:number){
    const moving=dragOffset?.series===seriesIndex&&dragOffset.index===index;
    return {
      ...activeProps(index,series[seriesIndex]?.categoryAxisIndex),
      'data-mixed-series':seriesIndex,'data-mixed-index':index,
      'data-value-chart':calculable&&seriesIndex>=0?transferId:undefined,'data-value-series':seriesIndex,'data-value-index':index,
      style:{cursor:calculable?'move':undefined,touchAction:calculable?'none':undefined,pointerEvents:moving?'none' as const:undefined},
      transform:moving?`translate(${dragOffset.x} ${dragOffset.y})`:undefined,
      onPointerDown:(event:PointerEvent<SVGGElement>)=>{if(!calculable||event.button!==0||seriesIndex>=0&&editableSeries[seriesIndex]?.data[index]==null)return;event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);drag.current={series:seriesIndex,index,x:event.clientX,y:event.clientY,moved:false};},
      onPointerMove:(event:PointerEvent<SVGGElement>)=>{if(seriesIndex>=0)updatePointer(index,series[seriesIndex]?.categoryAxisIndex);const source=drag.current;if(!source||source.series!==seriesIndex||source.index!==index)return;const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();if(!matrix)return;if(Math.hypot(event.clientX-source.x,event.clientY-source.y)<4&&!source.moved)return;source.moved=true;const start=new DOMPoint(source.x,source.y).matrixTransform(matrix.inverse()),end=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());setDragOffset({series:seriesIndex,index,x:end.x-start.x,y:end.y-start.y});},
      onPointerCancel:()=>{drag.current=null;setDragOffset(undefined);},
    };
  }
  return <SiaChart {...props} toolbox={chartToolbox} ref={ref} palette={palette} empty={!categories.length || !series.length} ariaLabel={props.ariaLabel ?? "混搭图"}>
    {showLegend ? <ChartLegend {...legendLayout} symbol={legendLayout?.symbol==='auto'?'rect':legendLayout?.symbol} items={series.map((item, index) => ({ name: item.name, symbol:legendLayout?.symbol==='auto'?(item.type==='line'?'line' as const:'rect' as const):undefined, color: getColor(index, item.color, palette), disabled: !legend.isSelected(item.name) })).filter(item=>!legendNames||legendNames.includes(item.name))} selected={legend.selected} onItemClick={legendInteractive ? legend.toggle : undefined} /> : null}
    {renderAxes?renderAxes({layer:axisLayering==='overlay'?'base':'all',plot:PLOT,categoryPositions:categories.map((_,index)=>(categoryAt(index)-PLOT.x)/PLOT.width),valueDomains:axisDomains??[domain]}):valueAxes?.length?<>
      <ChartAxis orientation="bottom" x={PLOT.x} y={PLOT_BOTTOM} length={PLOT.width} showLabels={showCategoryLabels} tickInterval={labelStep} labels={categories.map((name,index)=>index%labelStep===0?name:"")} positions={categories.map((_,index)=>(categoryAt(index)-PLOT.x)/PLOT.width)} boundaryGap={categoryGap} />
      {valueAxes.map((axis,index)=>{const position=axis.position??(index===0?'left':'right');const x=position==='left'?PLOT.x:PLOT.x+PLOT.width;return <g key={index} data-value-axis={index}>
        <ChartAxis boundaryGap={false} orientation={position} x={x} y={PLOT_BOTTOM} length={PLOT.height} labels={chartTicks(axisDomains![index]!).map(axis.formatter??formatChartNumber)} gridLength={index===0?PLOT.width:undefined} axisColor={axis.axisColor} gridColor={axis.gridColor} showTicks={axis.showTicks}/>
        {axis.name?<text x={x} y={PLOT.y-12} textAnchor={position==='left'?'start':'end'} className="sia-chart__axis-name" style={axis.nameStyle}>{axis.name}</text>:null}
      </g>;})}
    </>:<CartesianAxes categories={categories} domain={domain} band={categoryGap} />}
    {activeIndex!=null&&activeIndex>=0&&activeIndex<categories.length?<rect data-mixed-active-index={activeIndex} x={Math.max(PLOT.x,categoryAt(activeIndex)-band/2)} y={PLOT.y} width={Math.min(PLOT.x+PLOT.width,categoryAt(activeIndex)+band/2)-Math.max(PLOT.x,categoryAt(activeIndex)-band/2)} height={PLOT.height} fill="currentColor" opacity={.06} pointerEvents="none"/>:null}
    {tooltipTrigger==='axis'?categories.map((name,index)=><ChartMark {...activeProps(index)} key={`axis-${index}`} data-mixed-axis-tooltip={index} label={`${name.trim()} 各指标`} tooltip={axisTooltip(index)} tooltipPoint={[categoryAt(index),PLOT.y+PLOT.height/2]}><rect x={Math.max(PLOT.x,categoryAt(index)-band/2)} y={PLOT.y} width={Math.min(PLOT.x+PLOT.width,categoryAt(index)+band/2)-Math.max(PLOT.x,categoryAt(index)-band/2)} height={PLOT.height} fill="transparent"/></ChartMark>):null}
    {calculable?activeSeries.flatMap(item=>item.data.map((value,index)=>value===null?<ChartMark key={`empty-${item.name}-${index}`} {...dragProps(series.indexOf(item),index)} label={`${item.name}，${categories[index]}，空槽`} tooltip="拖入数据以填充"><rect x={PLOT.x+index*band+band*activeSeries.indexOf(item)/Math.max(1,activeSeries.length)} y={PLOT_BOTTOM-14} width={Math.max(4,band/Math.max(1,activeSeries.length)-2)} height={14} fill="transparent" stroke={getColor(series.indexOf(item),item.color,palette)} strokeDasharray="3 2"/></ChartMark>:null)):null}
    <defs><clipPath id={plotClipId}><rect x={PLOT.x} y={PLOT.y} width={PLOT.width} height={PLOT.height}/></clipPath></defs>
    <g data-mixed-plot="" clipPath={clipPlot?`url(#${plotClipId})`:undefined}>
    {renderSeries.map((item) => {
      const seriesIndex = series.indexOf(item);
      const color = getColor(seriesIndex, item.color, palette);
      const valueDomain=axisDomains?.[item.valueAxisIndex??0]??domain;
      const placements=layout.rows[activeSeries.indexOf(item)]!;
      const finiteValues=item.data.filter((value):value is number=>value!==null&&Number.isFinite(value));
      const average=finiteValues.reduce((sum,value)=>sum+value,0)/Math.max(1,finiteValues.length);
      const averageY=linearScale(average,[valueDomain[0],valueDomain[1]],[PLOT_BOTTOM,PLOT.y]);
      const averageMark=item.markAverage&&finiteValues.length?<g className="sia-chart__mark-line" data-mixed-average={item.name}>
        <line x1={PLOT.x} x2={PLOT.x+PLOT.width} y1={averageY} y2={averageY} style={{stroke:item.markColor??color}}/>
        {item.markSymbol!=='none'?<path d={`M ${PLOT.x+8} ${averageY-4} L ${PLOT.x} ${averageY} L ${PLOT.x+8} ${averageY+4} Z`} fill={item.markColor??color}/>:null}
        {!clipPlot&&item.showMarkLabel!==false?<text x={PLOT.x-8} y={averageY+4} textAnchor="end" style={{fill:item.markColor??color}}>{item.markFormatter?item.markFormatter(average):Number(average.toFixed(2))}</text>:null}
      </g>:null;
      if (item.type === "bar") {
        const axisBars=barSeries.filter(candidate=>(candidate.categoryAxisIndex??0)===(item.categoryAxisIndex??0));
        const barGroups=[...new Set(axisBars.map(candidate=>layout.rows[activeSeries.indexOf(candidate)]?.find(Boolean)?.group).filter((group):group is number=>group!==undefined))];
        const barIndex = barGroups.indexOf(placements.find(Boolean)?.group??-1);
        const slotWidth = band * 0.68 / Math.max(1, barGroups.length);
        const group=placements.find(Boolean)?.group;
        const requestedWidth=barSeries.find(candidate=>layout.rows[activeSeries.indexOf(candidate)]?.find(Boolean)?.group===group&&candidate.barWidth!==undefined)?.barWidth;
        const customSlot=barSpacing?mixedBarSlots(band,barGroups.map(group=>barSeries.find(candidate=>layout.rows[activeSeries.indexOf(candidate)]?.find(Boolean)?.group===group&&candidate.barWidth!==undefined)?.barWidth),barSpacing)[barIndex]:undefined;
        const rawWidth = customSlot?.width??Math.min(slotWidth,Math.max(0,requestedWidth??slotWidth));
        const width=barSpacing?.pixelAlign?Math.ceil(rawWidth):rawWidth;
        return <g key={`${item.name}-${seriesIndex}`}>{averageMark}{categories.map((_, index) => {
          const name=categoryName(index,item.categoryAxisIndex);
          const placement=placements[index];if(!placement)return null;
          const value = item.data[index] ?? 0;
          const rawX = customSlot?categoryAt(index)-band/2+customSlot.offset:PLOT.x + index * band + band * 0.16 + barIndex * slotWidth + (slotWidth-width)/2;
          const x=barSpacing?.pixelAlign?Math.floor(rawX):rawX;
          const y = linearScale(placement.end, [valueDomain[0], valueDomain[1]], [PLOT_BOTTOM, PLOT.y]);
          const zero = linearScale(placement.start, [valueDomain[0], valueDomain[1]], [PLOT_BOTTOM, PLOT.y]);
          const rectY=barSpacing?.pixelAlign?Math.floor(Math.min(y,zero)):Math.min(y,zero);
          const rectHeight=barSpacing?.pixelAlign?Math.ceil(Math.abs(zero-y)):Math.abs(zero-y);
          return <ChartPointMotion key={`${item.name}-${index}-${motionRevision}`} points={[[x,value>=0?rectY+rectHeight:rectY],[x,rectY],[x+width,rectY+rectHeight]]} enabled={coordinateAnimation&&props.animation!==false} duration={props.animationDuration??2000} updateDuration={animationDurationUpdate} progress={coordinateAnimation?animationProgress:undefined}>{frame=><ChartMark {...dragProps(seriesIndex,index)} key={`${name}-${index}`} label={`${item.name}，${name}，${value}`} tooltip={(item.tooltipTrigger??tooltipTrigger)==='axis'?axisTooltip(index,item.categoryAxisIndex):<TooltipValue name={name} series={item.name} value={value} formatter={valueFormatter} />} tooltipPoint={[props.tooltipProps?.placement==='axis'?Math.round(categoryAt(index)):x + width / 2, y]} onPointerUp={(event) => {if(!finishDrag(event))onDataClick?.({ name, value, seriesName: item.name, data: value, nativeEvent: event });}}><rect style={{animation:coordinateAnimation?'none':undefined}} x={frame[1]![0]} y={Math.min(frame[1]![1],frame[2]![1])} width={Math.max(0,frame[2]![0]-frame[1]![0])} height={Math.abs(frame[2]![1]-frame[1]![1])} rx={item.barRadius??4} fill={item.pointColors?.[index]??color} className="sia-chart__bar" /></ChartMark>}</ChartPointMotion>;
        })}</g>;
      }
      const points = categories.map((_, index) => [categoryAt(index), linearScale(placements[index]?.end ?? 0, [valueDomain[0], valueDomain[1]], [PLOT_BOTTOM, PLOT.y])] as const);
      const baseline=categories.map((_,index)=>[categoryAt(index),linearScale(placements[index]?.start??0,[valueDomain[0],valueDomain[1]],[PLOT_BOTTOM,PLOT.y])] as const).reverse();
      const segments:number[][]=[];
      categories.forEach((_,index)=>{if(!placements[index])return;if(index===0||!placements[index-1])segments.push([]);segments.at(-1)!.push(index);});
      return <ChartPointMotion key={`${item.name}-${seriesIndex}-${motionRevision}`} points={[...points,...baseline]} enabled={coordinateAnimation&&props.animation!==false} duration={props.animationDuration??2000} updateDuration={animationDurationUpdate} progress={coordinateAnimation?animationProgress:undefined}>{frame=>{
      const points=frame.slice(0,categories.length),baseline=frame.slice(categories.length);
      return <g>
        {averageMark}
        {segments.map(segment=>item.sampling==='pixel'?chartPixelSample(segment,PLOT.width):segment).map((segment,segmentIndex)=><g key={segmentIndex}>
          {item.area?<path d={`${linePath(segment.map(index=>points[index]!),item.curve)} ${[...segment].reverse().map(index=>{const point=baseline[categories.length-1-index]!;return `L ${point[0]} ${point[1]}`;}).join(' ')} Z`} fill={color} style={item.areaOpacity===undefined?undefined:{opacity:item.areaOpacity}} className="sia-chart__area"/>:null}
          <path d={linePath(segment.map(index=>points[index]!),item.curve)} fill="none" stroke={color} pathLength={item.lineStyle&&item.lineStyle!=='solid'?undefined:1} strokeDasharray={item.lineStyle==='dashed'?'7 5':item.lineStyle==='dotted'?'2 4':undefined} style={{strokeWidth:item.lineWidth,animation:coordinateAnimation?'none':undefined}} className={`sia-chart__line${coordinateAnimation||item.lineStyle&&item.lineStyle!=='solid'?'':' sia-chart__line--draw'}`}/>
        </g>)}
        {item.showPoints===false?null:points.map((point, index) => {
          if(!placements[index])return null;
          const name = categoryName(index,item.categoryAxisIndex);
          const value = item.data[index] ?? 0;
          return <ChartMark {...dragProps(seriesIndex,index)} key={`${name}-${index}`} label={`${item.name}，${name}，${value}`} tooltip={(item.tooltipTrigger??tooltipTrigger)==='axis'?axisTooltip(index,item.categoryAxisIndex):<TooltipValue name={name} series={item.name} value={value} formatter={valueFormatter} />} tooltipPoint={props.tooltipProps?.placement==='axis'?[Math.round(point[0]),point[1]]:point} onPointerUp={(event) => {if(!finishDrag(event))onDataClick?.({ name, value, seriesName: item.name, data: value, nativeEvent: event });}}><circle className={item.hollowSymbol?'sia-chart__mixed-hollow-symbol':undefined} cx={point[0]} cy={point[1]} r={Math.max(0,item.symbolSize??9)/2} fill={item.hollowSymbol?'#fff':color} stroke={item.hollowSymbol?color:'var(--sia-color-surface)'} strokeWidth={2} /></ChartMark>;
        })}
      </g>;
      }}</ChartPointMotion>;
    })}
    </g>
    {axisLayering==='overlay'?renderAxes?.({layer:'line',plot:PLOT,categoryPositions:categories.map((_,index)=>(categoryAt(index)-PLOT.x)/PLOT.width),valueDomains:axisDomains??[domain]}):null}
    {axisPointer&&shownPointer!=null&&shownPointer>=0&&shownPointer<categories.length?<line data-mixed-axis-pointer={shownPointer} x1={pointerX} x2={pointerX} y1={PLOT.y} y2={PLOT_BOTTOM} stroke={pointerStyle.color??'var(--sia-color-primary)'} strokeWidth={pointerWidth} strokeDasharray={pointerStyle.lineStyle==='dashed'?'5 4':pointerStyle.lineStyle==='dotted'?'2 2':undefined} pointerEvents="none"/>:null}
    {axisPointer&&pointerStyle.linkedEmphasis&&shownPointer!=null&&shownPointer>=0&&shownPointer<categories.length?activeSeries.filter(item=>item.type==='line'&&item.showPoints!==false&&(item.categoryAxisIndex??0)===pointerAxisIndex).map(item=>{
      const placement=layout.rows[activeSeries.indexOf(item)]?.[shownPointer];if(!placement)return null;
      const range=axisDomains?.[item.valueAxisIndex??0]??domain,color=getColor(series.indexOf(item),item.color,palette);
      return <circle key={item.name} data-mixed-axis-emphasis={item.name} cx={categoryAt(shownPointer)} cy={linearScale(placement.end,[range[0],range[1]],[PLOT_BOTTOM,PLOT.y])} r={Math.max(0,item.symbolSize??9)/2} fill={item.hollowSymbol?'#fff':color} stroke={item.hollowSymbol?color:'var(--sia-color-surface)'} strokeWidth={4} pointerEvents="none"/>;
    }):null}
    {clipPlot?activeSeries.map(item=>{
      if(!item.markAverage||item.showMarkLabel===false)return null;
      const values=item.data.filter((value):value is number=>value!==null&&Number.isFinite(value));if(!values.length)return null;
      const average=values.reduce((sum,value)=>sum+value,0)/values.length;
      const range=axisDomains?.[item.valueAxisIndex??0]??domain;
      if(average<range[0]||average>range[1])return null;
      const y=linearScale(average,[range[0],range[1]],[PLOT_BOTTOM,PLOT.y]);
      return <text key={item.name} data-mixed-average-label={item.name} x={PLOT.x-8} y={y+4} textAnchor="end" fontSize={12} fill={item.markColor??getColor(series.indexOf(item),item.color,palette)}>{item.markFormatter?item.markFormatter(average):Number(average.toFixed(2))}</text>;
    }):null}
    {calculable?islands.map((island,index)=><ChartMark key={`island-${index}`} {...dragProps(-1,index)} label={`孤岛 ${island.name} ${island.value}`} tooltip={<>{island.seriesName} / {island.name}：{island.value}</>} onPointerUp={finishDrag}>
      <circle cx={island.x} cy={island.y} r={20} fill="#fff" stroke="#2ec7c9" strokeWidth={2}/>
      <text x={island.x} y={island.y+4} textAnchor="middle" style={{fontSize:11}}>{island.value}</text>
    </ChartMark>):null}
  </SiaChart>;
});

/** ECharts 2 文档中的 KLine 命名兼容别名。 */
export const KLineChart = CandlestickChart;
