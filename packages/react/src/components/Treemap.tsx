import { withTitleTooltip } from "./titleTooltip";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react";
import { Icon } from "./Icon";

/** 矩形树图节点的种类。 */
export type TreemapNodeKind = "directory" | "file";

/** 可下钻矩形树图的节点，包含权重、子节点和业务数据。 */
export interface TreemapNode {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: number;
  /** 补全项或节点的类别。 */
  kind?: TreemapNodeKind;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 附加的业务元数据。 */
  meta?: ReactNode;
  /** 用于布局计算的权重值。 */
  layoutValue?: number;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: readonly TreemapNode[];
  /** 是否包含子节点。 */
  hasChildren?: boolean;
  /** 是否禁用交互。 */
  disabled?: boolean;
}

/** TreemapNode的点击事件上下文。 */
export interface TreemapNodeClickInfo {
  /** 当前操作关联的节点数据。 */
  node: TreemapNode;
  /** 是否处于展开状态。 */
  expanded: boolean;
  /** 触发本次操作的原生事件。 */
  nativeEvent: MouseEvent<HTMLElement>;
}

/** 矩形树图的属性配置。 */
export interface TreemapProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** 用于渲染的数据集合。 */
  data: readonly TreemapNode[];
  /**
   * 高亮节点键值
   * @defaultValue null
   */
  activeKey?: string | null;
  /** 受控的展开节点标识集合。 */
  expandedKeys?: readonly string[];
  /**
   * 初始化时展开的节点标识集合。
   * @defaultValue []
   */
  defaultExpandedKeys?: readonly string[];
  /** 当前聚焦节点的唯一标识。 */
  focusedKey?: string | null;
  /**
   * 初始化时聚焦的节点标识。
   * @defaultValue null
   */
  defaultFocusedKey?: string | null;
  /**
   * 预设或自定义间距
   * @defaultValue 2
   */
  gap?: number;
  /**
   * 标题区域高度。
   * @defaultValue 28
   */
  headerHeight?: number;
  /**
   * 显示标签所需的最小宽度。
   * @defaultValue 26
   */
  minLabelWidth?: number;
  /**
   * 显示标签所需的最小高度。
   * @defaultValue 18
   */
  minLabelHeight?: number;
  /**
   * 矩形块的最小宽度。
   * @defaultValue 28
   */
  minTileWidth?: number;
  /**
   * 矩形块的最小高度。
   * @defaultValue 18
   */
  minTileHeight?: number;
  /**
   * 启用节点聚合时允许直接显示的最大节点数；超出后合并为一个汇总节点。
   * @defaultValue 180
   */
  maxVisibleNodes?: number;
  /**
   * 是否把数量超限或无法满足最小尺寸的节点合并为汇总节点。关闭后保留每个原始节点，并将尺寸不足的节点排列为紧凑网格；当容器面积不足以容纳所有最小尺寸时，网格仍会按现有空间等分。
   * @defaultValue true
   */
  aggregateOverflow?: boolean;
  /**
   * 没有数据时的显示内容。
   * @defaultValue "暂无数据"
   */
  emptyContent?: ReactNode;
  /**
   将数值格式化为显示文本的函数。
   * @defaultValue defaultValueFormatter
   */
  valueFormatter?: (value: number, node: TreemapNode) => ReactNode;
  /** 启用节点聚合时用于生成汇总节点名称；参数为被合并的节点数量。 */
  overflowLabel?: (count: number) => string;
  /**
   * 是否在紧凑矩形块中也显示格式化后的数值；内容超出矩形块时按组件样式截断。
   * @defaultValue false
   */
  showValueInCompactTiles?: boolean;
  /** 展开状态改变时调用。 */
  onExpandedChange?: (keys: string[]) => void;
  /** 聚焦节点改变时调用。 */
  onFocusedChange?: (key: string | null) => void;
  /** 节点点击回调 */
  onNodeClick?: (info: TreemapNodeClickInfo) => void;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WeightedNode {
  node: TreemapNode;
  area: number;
}

interface PositionedNode {
  node: TreemapNode;
  rectangle: Rectangle;
  depth: number;
  expanded: boolean;
}

type InternalTreemapNode = TreemapNode & {
  __active?: boolean;
};

function positiveValue(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function layoutValue(node: TreemapNode) {
  return positiveValue(node.layoutValue ?? node.value);
}

function minimumAreaWeights(nodes: readonly TreemapNode[], totalArea: number, minimumArea: number) {
  const values = nodes.map(layoutValue);
  const areas = new Array<number>(nodes.length).fill(0);
  const remaining = new Set(nodes.map((_, index) => index));
  let availableArea = totalArea;
  let availableValue = values.reduce((sum, value) => sum + value, 0);

  while (remaining.size > 0 && availableArea > 0 && availableValue > 0) {
    const undersized = [...remaining].filter(
      (index) => values[index]! / availableValue * availableArea < minimumArea,
    );
    if (undersized.length === 0) {
      remaining.forEach((index) => {
        areas[index] = values[index]! / availableValue * availableArea;
      });
      break;
    }
    undersized.forEach((index) => {
      areas[index] = minimumArea;
      availableArea -= minimumArea;
      availableValue -= values[index]!;
      remaining.delete(index);
    });
  }

  if (remaining.size > 0 && (availableArea <= 0 || availableValue <= 0)) {
    const equalArea = Math.max(0, availableArea) / remaining.size;
    remaining.forEach((index) => { areas[index] = equalArea; });
  }
  return nodes.map((node, index) => ({ node, area: areas[index] ?? 0 }));
}

function worstAspectRatio(row: readonly WeightedNode[], side: number) {
  if (row.length === 0 || side <= 0) return Number.POSITIVE_INFINITY;
  const sum = row.reduce((total, item) => total + item.area, 0);
  const minimum = Math.min(...row.map((item) => item.area));
  const maximum = Math.max(...row.map((item) => item.area));
  if (minimum <= 0 || sum <= 0) return Number.POSITIVE_INFINITY;
  const sideSquared = side * side;
  const sumSquared = sum * sum;
  return Math.max((sideSquared * maximum) / sumSquared, sumSquared / (sideSquared * minimum));
}

function placeRow(row: readonly WeightedNode[], bounds: Rectangle) {
  const placements: Array<{ node: TreemapNode; rectangle: Rectangle }> = [];
  const rowArea = row.reduce((total, item) => total + item.area, 0);
  if (bounds.width >= bounds.height) {
    const columnWidth = bounds.height > 0 ? rowArea / bounds.height : 0;
    let y = bounds.y;
    row.forEach((item, index) => {
      const height = columnWidth > 0
        ? index === row.length - 1
          ? bounds.y + bounds.height - y
          : item.area / columnWidth
        : 0;
      placements.push({
        node: item.node,
        rectangle: { x: bounds.x, y, width: columnWidth, height },
      });
      y += height;
    });
    return {
      placements,
      remaining: {
        x: bounds.x + columnWidth,
        y: bounds.y,
        width: Math.max(0, bounds.width - columnWidth),
        height: bounds.height,
      },
    };
  }

  const rowHeight = bounds.width > 0 ? rowArea / bounds.width : 0;
  let x = bounds.x;
  row.forEach((item, index) => {
    const width = rowHeight > 0
      ? index === row.length - 1
        ? bounds.x + bounds.width - x
        : item.area / rowHeight
      : 0;
    placements.push({
      node: item.node,
      rectangle: { x, y: bounds.y, width, height: rowHeight },
    });
    x += width;
  });
  return {
    placements,
    remaining: {
      x: bounds.x,
      y: bounds.y + rowHeight,
      width: bounds.width,
      height: Math.max(0, bounds.height - rowHeight),
    },
  };
}

function squarify(nodes: readonly TreemapNode[], bounds: Rectangle, minimumArea: number) {
  if (nodes.length === 0 || bounds.width <= 0 || bounds.height <= 0) return [];
  const remainingNodes = minimumAreaWeights(
    nodes,
    bounds.width * bounds.height,
    minimumArea,
  ).sort((left, right) => right.area - left.area);
  const placements: Array<{ node: TreemapNode; rectangle: Rectangle }> = [];
  let remainingBounds = { ...bounds };
  let row: WeightedNode[] = [];

  while (remainingNodes.length > 0) {
    const candidate = remainingNodes[0]!;
    const side = Math.min(remainingBounds.width, remainingBounds.height);
    const nextRow = [...row, candidate];
    if (row.length === 0 || worstAspectRatio(nextRow, side) <= worstAspectRatio(row, side)) {
      row = nextRow;
      remainingNodes.shift();
      continue;
    }

    const result = placeRow(row, remainingBounds);
    placements.push(...result.placements);
    remainingBounds = result.remaining;
    row = [];
  }

  if (row.length > 0) placements.push(...placeRow(row, remainingBounds).placements);
  return placements;
}

function limitNodes(
  nodes: readonly TreemapNode[],
  bounds: Rectangle,
  minimumArea: number,
  maxVisibleNodes: number,
  groupKey: string,
  overflowLabel: (count: number) => string,
  activeKey: string | null,
) {
  const areaCapacity = Math.max(1, Math.floor(bounds.width * bounds.height / minimumArea));
  const capacity = Math.max(1, Math.min(maxVisibleNodes, areaCapacity));
  if (nodes.length <= capacity) return nodes;
  const sorted = [...nodes].sort((left, right) => layoutValue(right) - layoutValue(left));
  const visible = sorted.slice(0, capacity - 1);
  const overflow = sorted.slice(capacity - 1);
  const overflowNode: InternalTreemapNode = {
    key: `${groupKey}::sia-overflow`,
    label: overflowLabel(overflow.length),
    value: overflow.reduce((sum, node) => sum + Math.max(0, Number.isFinite(node.value) ? node.value : 0), 0),
    layoutValue: overflow.reduce((sum, node) => sum + layoutValue(node), 0),
    kind: "directory",
    color: "#a9b6c5",
    children: overflow,
    hasChildren: true,
    __active: Boolean(activeKey && overflow.some((node) => node.key === activeKey)),
  };
  return [...visible, overflowNode];
}

function collapseNarrowNodes(
  nodes: readonly TreemapNode[],
  placements: readonly { node: TreemapNode; rectangle: Rectangle }[],
  bounds: Rectangle,
  minimumArea: number,
  minimumWidth: number,
  minimumHeight: number,
  groupKey: string,
  overflowLabel: (count: number) => string,
  activeKey: string | null,
) {
  const narrowKeys = new Set(
    placements
      .filter(({ rectangle }) => rectangle.width < minimumWidth || rectangle.height < minimumHeight)
      .map(({ node }) => node.key),
  );
  if (narrowKeys.size === 0 || narrowKeys.size === nodes.length) return placements;

  const kept: TreemapNode[] = [];
  const collapsed: TreemapNode[] = [];
  nodes.forEach((node) => {
    if (!narrowKeys.has(node.key)) {
      kept.push(node);
      return;
    }
    if (node.key.endsWith("::sia-overflow") && node.children?.length) collapsed.push(...node.children);
    else collapsed.push(node);
  });

  const availableArea = Math.max(1, bounds.width * bounds.height);
  const readableArea = Math.min(
    availableArea * 0.18,
    Math.max(minimumWidth * bounds.height, minimumHeight * bounds.width),
  );
  const keptWeight = kept.reduce((sum, node) => sum + layoutValue(node), 0);
  const actualValue = collapsed.reduce(
    (sum, node) => sum + Math.max(0, Number.isFinite(node.value) ? node.value : 0),
    0,
  );
  const actualLayoutValue = collapsed.reduce((sum, node) => sum + layoutValue(node), 0);
  const readableWeight = readableArea < availableArea && keptWeight > 0
    ? readableArea * keptWeight / (availableArea - readableArea)
    : actualValue;
  const overflowNode: InternalTreemapNode = {
    key: `${groupKey}::sia-readable-overflow`,
    label: overflowLabel(collapsed.length),
    value: actualValue,
    layoutValue: Math.max(actualLayoutValue, readableWeight),
    kind: "directory",
    color: "#a9b6c5",
    children: collapsed,
    hasChildren: true,
    __active: Boolean(activeKey && collapsed.some((node) => node.key === activeKey)),
  };
  return squarify([...kept, overflowNode], bounds, minimumArea);
}

/**
 * 将尺寸不足的原始节点填满指定区域，避免关闭聚合后再次产生汇总节点或网格末行空洞。
 */
function placeCompactGrid(
  nodes: readonly TreemapNode[],
  bounds: Rectangle,
  minimumWidth: number,
  minimumHeight: number,
) {
  if (nodes.length === 0 || bounds.width <= 0 || bounds.height <= 0) return [];
  const preferredAspectRatio = Math.max(0.1, minimumWidth / Math.max(1, minimumHeight));
  let columnCount = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  // 同时衡量最小尺寸缺口、方块形状与末行空位，选择更易阅读的网格列数。
  for (let columns = 1; columns <= nodes.length; columns += 1) {
    const rows = Math.ceil(nodes.length / columns);
    const cellWidth = bounds.width / columns;
    const cellHeight = bounds.height / rows;
    const widthDeficit = Math.max(0, minimumWidth - cellWidth) / Math.max(1, minimumWidth);
    const heightDeficit = Math.max(0, minimumHeight - cellHeight) / Math.max(1, minimumHeight);
    const aspectPenalty = Math.abs(Math.log(Math.max(0.01, cellWidth / Math.max(1, cellHeight)) / preferredAspectRatio));
    const emptyPenalty = (rows * columns - nodes.length) / nodes.length;
    const score = (widthDeficit + heightDeficit) * 12 + aspectPenalty + emptyPenalty * 0.25;
    if (score < bestScore) {
      bestScore = score;
      columnCount = columns;
    }
  }

  const orderedNodes = [...nodes].sort((left, right) => layoutValue(right) - layoutValue(left));
  const rowCount = Math.ceil(orderedNodes.length / columnCount);
  const rowHeight = bounds.height / rowCount;
  return orderedNodes.map((node, index) => {
    const row = Math.floor(index / columnCount);
    const firstIndex = row * columnCount;
    const itemsInRow = Math.min(columnCount, orderedNodes.length - firstIndex);
    const column = index - firstIndex;
    const cellWidth = bounds.width / itemsInRow;
    return {
      node,
      rectangle: {
        x: bounds.x + column * cellWidth,
        y: bounds.y + row * rowHeight,
        width: column === itemsInRow - 1 ? bounds.x + bounds.width - (bounds.x + column * cellWidth) : cellWidth,
        height: row === rowCount - 1 ? bounds.y + bounds.height - (bounds.y + row * rowHeight) : rowHeight,
      },
    };
  });
}

/**
 * 保留所有过窄节点，并在不破坏较大节点权重关系的前提下为其分配紧凑网格区域。
 */
function preserveNarrowNodes(
  nodes: readonly TreemapNode[],
  placements: readonly { node: TreemapNode; rectangle: Rectangle }[],
  bounds: Rectangle,
  minimumArea: number,
  minimumWidth: number,
  minimumHeight: number,
  groupKey: string,
) {
  const narrowKeys = new Set(
    placements
      .filter(({ rectangle }) => rectangle.width < minimumWidth || rectangle.height < minimumHeight)
      .map(({ node }) => node.key),
  );
  if (narrowKeys.size === 0) return placements;

  let kept = nodes.filter((node) => !narrowKeys.has(node.key));
  let compact = nodes.filter((node) => narrowKeys.has(node.key));
  const totalArea = Math.max(1, bounds.width * bounds.height);

  // 紧凑区域扩大后可能挤窄原本合格的节点，因此逐轮把新出现的窄块移入网格。
  while (kept.length > 0) {
    const keptWeight = kept.reduce((sum, node) => sum + layoutValue(node), 0);
    const compactWeight = compact.reduce((sum, node) => sum + layoutValue(node), 0);
    const proportionalArea = totalArea * compactWeight / Math.max(1, keptWeight + compactWeight);
    const readableArea = Math.min(
      totalArea * 0.82,
      Math.max(proportionalArea, compact.length * minimumArea),
    );
    const compactLayoutWeight = readableArea * keptWeight / Math.max(1, totalArea - readableArea);
    const compactGroup: TreemapNode = {
      key: `${groupKey}::sia-compact-grid`,
      label: "",
      value: compact.reduce((sum, node) => sum + Math.max(0, node.value), 0),
      layoutValue: Math.max(compactWeight, compactLayoutWeight),
    };
    const outerPlacements = squarify([...kept, compactGroup], bounds, minimumArea);
    const newlyNarrowKeys = new Set(
      outerPlacements
        .filter(({ node, rectangle }) => node.key !== compactGroup.key
          && (rectangle.width < minimumWidth || rectangle.height < minimumHeight))
        .map(({ node }) => node.key),
    );
    if (newlyNarrowKeys.size === 0) {
      // 紧凑分组只参与布局计算，不渲染额外父块，最终结果仍全部对应真实节点。
      return outerPlacements.flatMap(({ node, rectangle }) => node.key === compactGroup.key
        ? placeCompactGrid(compact, rectangle, minimumWidth, minimumHeight)
        : [{ node, rectangle }]);
    }
    compact = [...compact, ...kept.filter((node) => newlyNarrowKeys.has(node.key))];
    kept = kept.filter((node) => !newlyNarrowKeys.has(node.key));
  }

  return placeCompactGrid(compact, bounds, minimumWidth, minimumHeight);
}

function collectPositions(
  nodes: readonly TreemapNode[],
  bounds: Rectangle,
  expanded: ReadonlySet<string>,
  gap: number,
  headerHeight: number,
  minTileWidth: number,
  minTileHeight: number,
  maxVisibleNodes: number,
  aggregateOverflow: boolean,
  overflowLabel: (count: number) => string,
  activeKey: string | null,
  depth = 0,
  parentKey = "root",
): PositionedNode[] {
  const result: PositionedNode[] = [];
  const minimumWidthWithGap = minTileWidth + gap * 2;
  const minimumHeightWithGap = minTileHeight + gap * 2;
  const minimumArea = Math.max(1, minimumWidthWithGap * minimumHeightWithGap);
  // 业务关闭聚合后直接保留原始节点，最大节点数仅用于聚合模式。
  const visibleNodes = aggregateOverflow
    ? limitNodes(
      nodes,
      bounds,
      minimumArea,
      maxVisibleNodes,
      `${parentKey}:${depth}`,
      overflowLabel,
      activeKey,
    )
    : nodes;
  const initialPlacements = squarify(visibleNodes, bounds, minimumArea);
  const placements = aggregateOverflow
    ? parentKey.endsWith("::sia-readable-overflow")
      ? initialPlacements
      : collapseNarrowNodes(
        visibleNodes,
        initialPlacements,
        bounds,
        minimumArea,
        minimumWidthWithGap,
        minimumHeightWithGap,
        `${parentKey}:${depth}`,
        overflowLabel,
        activeKey,
      )
    : preserveNarrowNodes(
      visibleNodes,
      initialPlacements,
      bounds,
      minimumArea,
      minimumWidthWithGap,
      minimumHeightWithGap,
      `${parentKey}:${depth}`,
    );
  placements.forEach(({ node, rectangle }) => {
    const inset = Math.min(gap, rectangle.width / 4, rectangle.height / 4);
    const tile = {
      x: rectangle.x + inset,
      y: rectangle.y + inset,
      width: Math.max(0, rectangle.width - inset * 2),
      height: Math.max(0, rectangle.height - inset * 2),
    };
    const hasChildren = Boolean(node.hasChildren || node.children?.length);
    const isExpanded = node.kind === "directory"
      && hasChildren
      && expanded.has(node.key)
      && Boolean(node.children?.length)
      && tile.width >= 72
      && tile.height >= headerHeight * 2;
    result.push({ node, rectangle: tile, depth, expanded: isExpanded });

    if (!isExpanded || !node.children) return;
    const childBounds = {
      x: tile.x,
      y: tile.y + headerHeight,
      width: tile.width,
      height: Math.max(0, tile.height - headerHeight),
    };
    result.push(...collectPositions(
      node.children,
      childBounds,
      expanded,
      gap,
      headerHeight,
      minTileWidth,
      minTileHeight,
      maxVisibleNodes,
      aggregateOverflow,
      overflowLabel,
      activeKey,
      depth + 1,
      node.key,
    ));
  });
  return result;
}

function defaultValueFormatter(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
}

function tileFontSize(rectangle: Rectangle) {
  const shortestSide = Math.min(rectangle.width, rectangle.height);
  if (shortestSide < 28 || rectangle.width < 44) return 8;
  if (shortestSide < 38 || rectangle.width < 62) return 9;
  if (shortestSide < 54 || rectangle.width < 86) return 10;
  if (shortestSide < 76) return 11;
  if (shortestSide < 110) return 12;
  return 14;
}

function findNode(nodes: readonly TreemapNode[], key: string): TreemapNode | null {
  for (const node of nodes) {
    if (node.key === key) return node;
    if (node.children?.length) {
      const found = findNode(node.children, key);
      if (found) return found;
    }
  }
  return null;
}

/** 矩形树图组件。 */
export function Treemap({
  data,
  activeKey = null,
  expandedKeys,
  defaultExpandedKeys = [],
  focusedKey,
  defaultFocusedKey = null,
  gap = 2,
  headerHeight = 28,
  minLabelWidth = 26,
  minLabelHeight = 18,
  minTileWidth = 28,
  minTileHeight = 18,
  maxVisibleNodes = 180,
  aggregateOverflow = true,
  emptyContent = "暂无数据",
  valueFormatter = defaultValueFormatter,
  overflowLabel = (count) => `其他 ${count} 项`,
  showValueInCompactTiles = false,
  onExpandedChange,
  onFocusedChange,
  onNodeClick,
  className = "",
  style,
  ...props
}: TreemapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [internalExpandedKeys, setInternalExpandedKeys] = useState(() => [...defaultExpandedKeys]);
  const [internalFocusedKey, setInternalFocusedKey] = useState<string | null>(defaultFocusedKey);
  const currentExpandedKeys = expandedKeys ?? internalExpandedKeys;
  const currentFocusedKey = focusedKey === undefined ? internalFocusedKey : focusedKey;
  const expandedSet = useMemo(() => new Set(currentExpandedKeys), [currentExpandedKeys]);
  const focusedNode = useMemo(
    () => currentFocusedKey ? findNode(data, currentFocusedKey) : null,
    [currentFocusedKey, data],
  );
  const effectiveFocusedNode = focusedNode
    && expandedSet.has(focusedNode.key)
    && Boolean(focusedNode.children?.length)
    ? focusedNode
    : null;
  const positions = useMemo(
    () => collectPositions(
      effectiveFocusedNode ? [effectiveFocusedNode] : data,
      { x: 0, y: 0, ...size },
      expandedSet,
      Math.max(0, gap),
      Math.max(18, headerHeight),
      Math.max(1, minTileWidth),
      Math.max(1, minTileHeight),
      Math.max(1, maxVisibleNodes),
      aggregateOverflow,
      overflowLabel,
      activeKey,
    ),
    [activeKey, aggregateOverflow, data, effectiveFocusedNode, expandedSet, gap, headerHeight, maxVisibleNodes, minTileHeight, minTileWidth, overflowLabel, size],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const updateSize = () => {
      const next = element.getBoundingClientRect();
      setSize((current) => current.width === next.width && current.height === next.height
        ? current
        : { width: next.width, height: next.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!currentFocusedKey || effectiveFocusedNode) return;
    if (focusedKey === undefined) setInternalFocusedKey(null);
    onFocusedChange?.(null);
  }, [currentFocusedKey, effectiveFocusedNode, focusedKey, onFocusedChange]);

  function updateFocusedKey(next: string | null) {
    if (focusedKey === undefined) setInternalFocusedKey(next);
    onFocusedChange?.(next);
  }

  function handleNodeClick(node: TreemapNode, nativeEvent: MouseEvent<HTMLElement>) {
    const isExpanded = expandedSet.has(node.key);
    const hasChildren = Boolean(node.hasChildren || node.children?.length);
    if (node.kind === "directory" && hasChildren && !node.disabled) {
      const next = isExpanded
        ? currentExpandedKeys.filter((key) => key !== node.key)
        : [...currentExpandedKeys, node.key];
      if (expandedKeys === undefined) setInternalExpandedKeys(next);
      onExpandedChange?.(next);
      if (isExpanded && currentFocusedKey === node.key) updateFocusedKey(null);
    }
    onNodeClick?.({ node, expanded: isExpanded, nativeEvent });
  }

  return (
    <div
      {...withTitleTooltip(props)}
      ref={containerRef}
      className={`sia-treemap ${className}`.trim()}
      style={style}
      role="tree"
    >
      {data.length === 0 ? <div className="sia-treemap__empty">{emptyContent}</div> : null}
      {positions.map(({ node, rectangle, depth, expanded }) => {
        const active = node.key === activeKey || Boolean((node as InternalTreemapNode).__active);
        const fontSize = tileFontSize(rectangle);
        const tileStyle = {
          "--sia-treemap-x": `${rectangle.x}px`,
          "--sia-treemap-y": `${rectangle.y}px`,
          "--sia-treemap-width": `${rectangle.width}px`,
          "--sia-treemap-height": `${rectangle.height}px`,
          "--sia-treemap-color": node.color,
          "--sia-treemap-depth": depth,
          "--sia-treemap-font-size": `${fontSize}px`,
          "--sia-treemap-value-font-size": `${Math.max(7, fontSize - 1)}px`,
        } as CSSProperties;
        const showLabel = rectangle.width >= minLabelWidth && rectangle.height >= minLabelHeight;
        const showValue = showLabel && (showValueInCompactTiles || (
          rectangle.width >= Math.max(52, minLabelWidth)
          && rectangle.height >= Math.max(34, minLabelHeight + 12)
        ));
        const hasChildren = Boolean(node.hasChildren || node.children?.length);
        const title = `${node.label} · ${String(valueFormatter(node.value, node))}`;
        if (expanded) {
          return (
            <div
              className={`sia-treemap__tile sia-treemap__tile--directory is-expanded${effectiveFocusedNode?.key === node.key ? " is-focused" : ""}${active ? " is-active" : ""}`}
              style={tileStyle}
              role="treeitem"
              aria-expanded="true"
              {...withTitleTooltip({ title: title })}
              data-treemap-key={node.key}
              key={node.key}
            >
              <div className="sia-treemap__header">
                <button
                  type="button"
                  className="sia-treemap__header-main"
                  disabled={node.disabled}
                  onClick={(event) => handleNodeClick(node, event)}
                >
                  <span className="sia-treemap__label">{node.label}</span>
                  {showValue ? <span className="sia-treemap__value">{valueFormatter(node.value, node)}</span> : null}
                </button>
                <button
                  type="button"
                  className="sia-treemap__focus"
                  aria-label={effectiveFocusedNode?.key === node.key ? `还原 ${node.label}` : `聚焦展开 ${node.label}`}
                  {...withTitleTooltip({ title: effectiveFocusedNode?.key === node.key ? "还原原有视图" : "展开到整个区域" })}
                  onClick={() => updateFocusedKey(effectiveFocusedNode?.key === node.key ? null : node.key)}
                >
                  <Icon name={effectiveFocusedNode?.key === node.key ? "fullscreen-exit" : "fullscreen"} size={14} />
                </button>
              </div>
            </div>
          );
        }
        return (
          <button
            type="button"
            className={`sia-treemap__tile sia-treemap__tile--${node.kind ?? "file"}${node.disabled ? " is-disabled" : ""}${showValue ? "" : " is-compact"}${active ? " is-active" : ""}`}
            style={tileStyle}
            role="treeitem"
            aria-expanded={node.kind === "directory" && hasChildren ? "false" : undefined}
            disabled={node.disabled}
            {...withTitleTooltip({ title: title })}
            data-treemap-key={node.key}
            onClick={(event) => handleNodeClick(node, event)}
            key={node.key}
          >
            {showLabel ? (
              <span className="sia-treemap__content">
                <span className="sia-treemap__label">{node.label}</span>
                {showValue ? <span className="sia-treemap__value">{valueFormatter(node.value, node)}</span> : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
