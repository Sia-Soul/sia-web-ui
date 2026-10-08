import type { TableColumn, TableColumnSettingItem } from "./types";

/** 动态分组只展示当前叶子列；新叶子继承父列显隐与固定位置，历史配置仍留在存储中。 */
export function reconcileColumnSettings<T>(
  columns: readonly TableColumn<T>[],
  defaults: readonly TableColumnSettingItem[],
  saved: readonly TableColumnSettingItem[],
): TableColumnSettingItem[] {
  const stored = new Map(saved.map((item) => [item.key, item]));
  const base = new Map(defaults.map((item) => [item.key, item]));
  const result: TableColumnSettingItem[] = [];
  // 父列有独立排序锚点，展开后不能因子列尚未保存而跳到整个表格末尾。
  const rank = (column: TableColumn<T>): number | undefined => {
    const own = stored.get(column.key)?.order;
    if (own !== undefined) return own;
    const children = column.children?.map(rank).filter((value): value is number => value !== undefined);
    return children?.length ? Math.min(...children) : undefined;
  };
  const walk = (source: readonly TableColumn<T>[], parent?: TableColumnSettingItem) => {
    const entries = source.map((column, index) => ({ column, index, rank: rank(column) }));
    // 未保存的新列按源码顺序插到最近的已知列之后，而不是从设置面板消失。
    let anchor = -1;
    for (const entry of entries) {
      if (entry.rank !== undefined) anchor = entry.rank;
      else entry.rank = anchor + (entry.index + 1) / (entries.length + 1);
    }
    entries.sort((a, b) => a.rank! - b.rank! || a.index - b.index);
    for (const { column } of entries) {
      const own = stored.get(column.key);
      if (column.children?.length) {
        walk(column.children, own ?? parent);
      } else {
        const fallback = base.get(column.key);
        if (!fallback) continue;
        const item = own ?? {
          ...fallback,
          fixed: parent?.fixed ?? fallback.fixed,
          visible: fallback.visible && (parent?.visible ?? true),
        };
        result.push({ ...item, order: result.length });
      }
    }
  };
  walk(columns);
  return result;
}

/** 保存当前设置时保留暂时收起的列，并同步分组排序锚点；不依赖业务 key 的命名格式。 */
export function mergeColumnSettings<T>(
  columns: readonly TableColumn<T>[],
  saved: readonly TableColumnSettingItem[],
  active: readonly TableColumnSettingItem[],
): TableColumnSettingItem[] {
  const merged = new Map(saved.filter((item) => !["__index__", "__selection__"].includes(item.key)).map((item) => [item.key, item]));
  active.forEach((item) => merged.set(item.key, item));
  const current = new Map(active.map((item) => [item.key, item]));
  const walk = (column: TableColumn<T>): TableColumnSettingItem[] => {
    if (!column.children?.length) return current.has(column.key) ? [current.get(column.key)!] : [];
    const leaves = column.children.flatMap(walk);
    if (leaves.length) {
      const old = merged.get(column.key);
      merged.set(column.key, {
        key: column.key,
        width: old?.width ?? column.width,
        fixed: old?.fixed,
        visible: leaves.some((item) => item.visible),
        order: Math.min(...leaves.map((item) => item.order)),
      });
    }
    return leaves;
  };
  columns.forEach(walk);
  // 同时保持数组顺序，兼容仅按数组位置读取旧配置的存储适配器。
  return [...merged.values()].sort((left, right) => left.order - right.order);
}
