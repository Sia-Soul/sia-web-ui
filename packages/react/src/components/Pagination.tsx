import { useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Select } from "./Select";
import { useControllableState } from "./shared";
import { useControlSize } from "./shared";
import type { ControlSize } from "./shared";

/** 分页器默认提供的每页记录数选项。 */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000] as const;

/** 分页的属性配置。 */
export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /**
   * 数据总数
   * @defaultValue 0
   */
  total?: number;
  /** 当前页实际条数；未提供时根据总数、页码和每页条数计算。 */
  currentPageCount?: number;
  /** 当前页码，从 1 开始；传入后由外部控制。 */
  current?: number;
  /**
   * 非受控模式的初始页码或步骤位置。
   * @defaultValue 1
   */
  defaultCurrent?: number;
  /** 每页显示的记录数。 */
  pageSize?: number;
  /**
   * 非受控模式下每页默认展示的记录数。
   * @defaultValue 25
   */
  defaultPageSize?: number;
  /**
   * 每页条数候选项
   * @defaultValue DEFAULT_PAGE_SIZE_OPTIONS
   */
  pageSizeOptions?: readonly number[];
  /**
   * 是否显示每页条数切换控件。
   * @defaultValue true
   */
  showSizeChanger?: boolean;
  /**
   * 是否显示总数，或自定义总数文本的函数。
   * @defaultValue true
   */
  showTotal?: boolean | ((total: number, range: [number, number]) => ReactNode);
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /**
   * 只有一页数据时是否隐藏分页器。
   * @defaultValue false
   */
  hideOnSinglePage?: boolean;
  /** 是否正在刷新总数。 */
  refreshing?: boolean;
  /** 请求刷新总数时调用。 */
  onRefreshTotal?: () => void | Promise<void>;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (page: number, pageSize: number) => void;
  /** 每页条数变化时调用，参数为页码及新的每页条数。 */
  onShowSizeChange?: (current: number, pageSize: number) => void;
}

/** 分页组件。 */
export function Pagination({
  size: sizeProp,
  total = 0,
  currentPageCount,
  current,
  defaultCurrent = 1,
  pageSize,
  defaultPageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showSizeChanger = true,
  showTotal = true,
  disabled = false,
  hideOnSinglePage = false,
  refreshing,
  onRefreshTotal,
  onChange,
  onShowSizeChange,
  className = "",
  ...props
}: PaginationProps) {
  const controlSize = useControlSize(sizeProp);
  const [size, setSize] = useControllableState({ value: pageSize, defaultValue: Math.max(1, defaultPageSize) });
  const [page, setPage] = useControllableState({ value: current, defaultValue: Math.max(1, defaultCurrent) });
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / size));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const loading = refreshing ?? internalRefreshing;
  const sizes = [...new Set([...pageSizeOptions, size].filter((value) => value > 0))].sort((a, b) => a - b);
  const range: [number, number] = safeTotal
    ? [(safePage - 1) * size + 1, Math.min(safeTotal, safePage * size)]
    : [0, 0];
  const pageCount = Math.max(0, currentPageCount ?? (safeTotal ? range[1] - range[0] + 1 : 0));

  if (hideOnSinglePage && totalPages <= 1) return null;

  function change(nextPage: number, nextSize = size) {
    const nextTotalPages = Math.max(1, Math.ceil(safeTotal / nextSize));
    const normalizedPage = Math.max(1, Math.min(nextPage, nextTotalPages));
    setPage(normalizedPage);
    onChange?.(normalizedPage, nextSize);
  }

  function changeSize(nextSize: number) {
    setSize(nextSize);
    setPage(1);
    onShowSizeChange?.(1, nextSize);
    onChange?.(1, nextSize);
  }

  async function refreshTotal() {
    if (!onRefreshTotal || loading) return;
    if (refreshing === undefined) setInternalRefreshing(true);
    try {
      await onRefreshTotal();
    } finally {
      if (refreshing === undefined) setInternalRefreshing(false);
    }
  }

  return (
    <nav className={`sia-pagination sia-pagination--${controlSize} ${className}`.trim()} aria-label="分页" {...props}>
      <span className="sia-pagination__current-count" aria-live="polite">当前页 {pageCount} 条</span>
      {showSizeChanger ? (
        <div className="sia-pagination__size">
          <span>每页显示</span>
          <Select
            className="sia-pagination__size-select"
            size={controlSize}
            aria-label="每页条数"
            value={size}
            options={sizes.map((value) => ({ label: `${value} 条`, value }))}
            disabled={disabled}
            onChange={(nextSize) => { if (typeof nextSize === "number") changeSize(nextSize); }}
          />
        </div>
      ) : null}
      {showTotal ? (
        typeof showTotal === "function" ? (
          <span className="sia-pagination__total">{showTotal(safeTotal, range)}</span>
        ) : (
          <Button
            variant="text"
            size={controlSize}
            className="sia-pagination__total"
            disabled={disabled || !onRefreshTotal || loading}
            title={onRefreshTotal ? "点击刷新总记录数" : undefined}
            onClick={() => void refreshTotal()}
          >
            {loading ? <Icon name="loader" size={13} spin /> : null}
            共 {safeTotal} 条
            {onRefreshTotal && !loading ? <Icon name="refresh" size={13} /> : null}
          </Button>
        )
      ) : null}
      <div className="sia-pagination__buttons">
        <Button size={controlSize} variant="text" aria-label="第一页" disabled={disabled || safePage <= 1} onClick={() => change(1)}><Icon name="double-left" size={15} /></Button>
        <Button size={controlSize} variant="text" aria-label="上一页" disabled={disabled || safePage <= 1} onClick={() => change(safePage - 1)}><Icon name="chevron-left" size={15} /></Button>
        <span aria-live="polite">{safePage} / {totalPages}</span>
        <Button size={controlSize} variant="text" aria-label="下一页" disabled={disabled || safePage >= totalPages} onClick={() => change(safePage + 1)}><Icon name="chevron-right" size={15} /></Button>
        <Button size={controlSize} variant="text" aria-label="最后一页" disabled={disabled || safePage >= totalPages} onClick={() => change(totalPages)}><Icon name="double-right" size={15} /></Button>
      </div>
    </nav>
  );
}
