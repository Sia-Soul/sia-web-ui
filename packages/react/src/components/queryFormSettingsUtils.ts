import type { QueryFormFieldSetting } from "./queryFormSettingsTypes";

/** 按稳定 key 合并当前字段与历史布局，新增字段追加显示，暂时不存在的字段不参与当前布局。hideDisabledKeys 中的字段始终可见，但保留其保存顺序。 */
export function reconcileQueryFields(keys: readonly string[], saved: readonly QueryFormFieldSetting[] = [], hideDisabledKeys: readonly string[] = []): QueryFormFieldSetting[] {
  const stored = new Map(saved.map(item => [item.key, item]));
  return keys.map((key, index) => ({
    key,
    visible: hideDisabledKeys.includes(key) || stored.get(key)?.visible !== false,
    order: Number.isFinite(stored.get(key)?.order) ? stored.get(key)!.order : Infinity,
    index,
  })).sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ key, visible }, order) => ({ key, visible, order }));
}

/** 保留当前未出现字段的历史配置，避免动态条件消失一次后丢失个人设置。 */
export function mergeQueryFields(saved: readonly QueryFormFieldSetting[], active: readonly QueryFormFieldSetting[]): QueryFormFieldSetting[] {
  const current = new Set(active.map(item => item.key));
  return [...active, ...saved.filter(item => !current.has(item.key))];
}

/** 根据字段垂直中心坐标计算实际行数；半像素内差异视为同一行，避免缩放造成误判，不统计按钮或快捷查询。 */
export function countQueryFieldRows(centers: readonly number[]): number {
  const rows: number[] = [];
  for (const top of centers) {
    if (!rows.some(value => Math.abs(value - top) <= 0.5)) rows.push(top);
  }
  return rows.length;
}
