import { useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useControllableState } from "./shared";

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000] as const;

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  total?: number;
  current?: number;
  defaultCurrent?: number;
  pageSize?: number;
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  showSizeChanger?: boolean;
  showTotal?: boolean | ((total: number, range: [number, number]) => ReactNode);
  disabled?: boolean;
  hideOnSinglePage?: boolean;
  refreshing?: boolean;
  onRefreshTotal?: () => void | Promise<void>;
  onChange?: (page: number, pageSize: number) => void;
  onShowSizeChange?: (current: number, pageSize: number) => void;
}

export function Pagination({
  total = 0,
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
    <nav className={`sia-pagination ${className}`.trim()} aria-label="分页" {...props}>
      {showSizeChanger ? (
        <label className="sia-pagination__size">
          每页显示
          <select
            aria-label="每页条数"
            value={size}
            disabled={disabled}
            onChange={(event) => changeSize(Number(event.currentTarget.value))}
          >
            {sizes.map((value) => <option key={value} value={value}>{value} 条</option>)}
          </select>
        </label>
      ) : null}
      {showTotal ? (
        typeof showTotal === "function" ? (
          <span className="sia-pagination__total">{showTotal(safeTotal, range)}</span>
        ) : (
          <button
            type="button"
            className="sia-pagination__total"
            disabled={disabled || !onRefreshTotal || loading}
            title={onRefreshTotal ? "点击刷新总记录数" : undefined}
            onClick={() => void refreshTotal()}
          >
            {loading ? <Icon name="loader" size={13} spin /> : null}
            共 {safeTotal} 条
            {onRefreshTotal && !loading ? <Icon name="refresh" size={13} /> : null}
          </button>
        )
      ) : null}
      <div className="sia-pagination__buttons">
        <Button size="small" variant="text" aria-label="第一页" disabled={disabled || safePage <= 1} onClick={() => change(1)}>|&lt;</Button>
        <Button size="small" variant="text" aria-label="上一页" disabled={disabled || safePage <= 1} onClick={() => change(safePage - 1)}>&lt;</Button>
        <span aria-live="polite">{safePage} / {totalPages}</span>
        <Button size="small" variant="text" aria-label="下一页" disabled={disabled || safePage >= totalPages} onClick={() => change(safePage + 1)}>&gt;</Button>
        <Button size="small" variant="text" aria-label="最后一页" disabled={disabled || safePage >= totalPages} onClick={() => change(totalPages)}>&gt;|</Button>
      </div>
    </nav>
  );
}
