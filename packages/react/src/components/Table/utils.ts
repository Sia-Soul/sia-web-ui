import type { Key } from "react";
import type { TableColumn, TableFixed, TableRow } from "./types";

export function getTableValue<T>(record: T, dataIndex: TableColumn<T>["dataIndex"], fallbackKey: string): unknown {
  const path = Array.isArray(dataIndex) ? dataIndex : String(dataIndex ?? fallbackKey).split(".");
  return path.reduce<unknown>((value, key) => value != null && typeof value === "object" ? (value as Record<string, unknown>)[String(key)] : undefined, record);
}

export function flattenTableColumns<T>(columns: readonly TableColumn<T>[]): TableColumn<T>[] {
  const result: TableColumn<T>[] = [];
  const keys = new Set<string>();
  const walk = (items: readonly TableColumn<T>[]) => {
    for (const column of items) {
      if (column.children?.length) walk(column.children);
      else if (!column.hidden && !keys.has(column.key)) {
        keys.add(column.key);
        result.push(column);
      }
    }
  };
  walk(columns);
  return result;
}

export function mapTableLeafColumns<T>(columns: readonly TableColumn<T>[], mapper: (column: TableColumn<T>) => TableColumn<T>): TableColumn<T>[] {
  return columns.map((column) => column.children?.length
    ? { ...column, children: mapTableLeafColumns(column.children, mapper) }
    : mapper(column));
}

export function normalizeFixed(fixed: TableColumn<unknown>["fixed"]): TableFixed | undefined {
  if (fixed === true || fixed === "left") return "left";
  return fixed === "right" ? "right" : undefined;
}

export function sortTableColumnsByFixed<T>(columns: readonly TableColumn<T>[]): TableColumn<T>[] {
  const weight = (column: TableColumn<T>) => normalizeFixed(column.fixed) === "left" ? 0 : normalizeFixed(column.fixed) === "right" ? 2 : 1;
  return [...columns].sort((a, b) => weight(a) - weight(b));
}

export function createTableRows<T>(data: readonly T[], getKey: (record: T, index: number) => Key): TableRow<T>[] {
  return data.map((record, sourceIndex) => ({ key: getKey(record, sourceIndex), record, sourceIndex, depth: 0, meta: {} }));
}

export function getColumnLabel<T>(column: TableColumn<T>): string {
  if (column.name) return column.name;
  if (typeof column.title === "string") return column.title;
  return column.key;
}

export function toTablePageParams(current: number, pageSize: number): import("./types").TablePageParams {
  return { current, pageIndex: current, pageSize, skipCount: Math.max(0, current - 1) * pageSize, maxResultCount: pageSize };
}
