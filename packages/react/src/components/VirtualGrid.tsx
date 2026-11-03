import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HTMLAttributes, Key, ReactNode } from "react";

/** 固定行高的响应式虚拟网格；父容器需提供确定高度或可收缩的弹性高度。 */
export interface VirtualGridProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** 已加载的数据；追加数组可继续滚动，组件不请求或存储远程数据。 */
  items: readonly T[];
  /** 返回跨排序保持稳定的项目标识，供 React 复用可见项。 */
  itemKey: (item: T, index: number) => Key;
  /** 渲染可见项目；index 是项目在 items 中的原始索引。 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 每行固定高度，单位 px，须容纳完整项目内容；最小 1px。 */
  rowHeight: number;
  /** 每列最小宽度，单位 px；宽度不足时仍显示一列。@defaultValue 200 */
  minColumnWidth?: number;
  /** 行与列之间的间隔，单位 px。@defaultValue 8 */
  gap?: number;
  /** 视口上下额外保留的行数，降低快速滚动时的空白。@defaultValue 2 */
  overscan?: number;
  /** 是否还有后续数据；为 false 时不触发 onLoadMore。@defaultValue false */
  hasMore?: boolean;
  /** 是否正在加载；为 true 时不触发 onLoadMore，并设置 aria-busy。@defaultValue false */
  loading?: boolean;
  /** 距已加载内容底部多少 px 时请求下一批；首屏不足一屏时也触发。@defaultValue 120 */
  loadMoreThreshold?: number;
  /** 接近底部且 hasMore=true、loading=false 时调用；同一数据长度只通知一次。调用方追加 items 或变更 hasMore，异步加载及失败提示由调用方管理；需重试时可更换组件 key。 */
  onLoadMore?: () => void;
  /** 无已加载项目且未加载中时显示的内容。 */
  empty?: ReactNode;
}

/** 仅挂载可视行及缓冲行的网格；宽度变化自动重算列数，筛选重置滚动可更换 key。 */
export function VirtualGrid<T>({
  items, itemKey, renderItem, rowHeight, minColumnWidth = 200, gap = 8,
  overscan = 2, hasMore = false, loading = false, loadMoreThreshold = 120,
  onLoadMore, empty, className = "", onScroll, tabIndex = 0, ...props
}: VirtualGridProps<T>) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const frame = useRef<number>();
  const requestedLength = useRef<number>();
  const height = Math.max(1, rowHeight);
  const spacing = Math.max(0, gap);
  const columns = Math.max(1, Math.floor((size.width + spacing) / (Math.max(1, minColumnWidth) + spacing)));
  const rowCount = Math.ceil(items.length / columns);
  const stride = height + spacing;
  const totalHeight = Math.max(0, rowCount * stride - spacing);
  const paddingRows = Math.max(0, Math.floor(overscan));
  const startRow = Math.max(0, Math.min(rowCount - 1, Math.floor(scrollTop / stride)) - paddingRows);
  const endRow = Math.min(rowCount, Math.ceil((scrollTop + size.height) / stride) + paddingRows);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // 读取内容宽度而非外框，原生滚动条和侧栏调宽都能正确重排列数。
    const measure = () => setSize(previous => previous.width === el.clientWidth && previous.height === el.clientHeight
      ? previous : { width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { observer.disconnect(); if (frame.current !== undefined) cancelAnimationFrame(frame.current); };
  }, []);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // 缩短数据或增加列数时限制滚动位置，避免旧偏移使可视区落在列表之外。
    const next = Math.min(el.scrollTop, Math.max(0, totalHeight - size.height));
    if (el.scrollTop !== next) el.scrollTop = next;
    setScrollTop(next);
  }, [totalHeight, size.height]);
  useEffect(() => {
    if (!onLoadMore || !hasMore || loading || size.height <= 0) return;
    if (totalHeight - scrollTop - size.height > Math.max(0, loadMoreThreshold)) return;
    if (requestedLength.current === items.length) return;
    // 以数据长度锁定一次通知，防止重渲染或同帧滚动重复启动同一批请求。
    requestedLength.current = items.length;
    onLoadMore();
  }, [items.length, hasMore, loading, size.height, scrollTop, totalHeight, loadMoreThreshold, onLoadMore]);

  return <div {...props} ref={viewport} className={`sia-virtual-grid ${className}`.trim()}
    role={props.role ?? "list"} tabIndex={tabIndex} aria-busy={loading}
    onScroll={event => {
      onScroll?.(event);
      if (frame.current !== undefined) return;
      frame.current = requestAnimationFrame(() => { frame.current = undefined; setScrollTop(viewport.current?.scrollTop ?? 0); });
    }}>
    <div className="sia-virtual-grid__spacer" style={{ height: totalHeight }}>
      {Array.from({ length: Math.max(0, endRow - startRow) }, (_, offset) => {
        const row = startRow + offset;
        return <div key={row} className="sia-virtual-grid__row" role="presentation" style={{
          top: row * stride, height, columnGap: spacing, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}>
          {items.slice(row * columns, (row + 1) * columns).map((item, column) => {
            const index = row * columns + column;
            return <div key={itemKey(item, index)} className="sia-virtual-grid__item" role="listitem" aria-posinset={index + 1} aria-setsize={hasMore ? -1 : items.length}>
              {renderItem(item, index)}
            </div>;
          })}
        </div>;
      })}
    </div>
    {!items.length && !loading ? empty : null}
  </div>;
}
