import type { QueryFormFieldSetting } from "./queryFormSettingsTypes";

/** 按稳定 key 合并当前字段与历史布局，新增字段追加显示，暂时不存在的字段不参与当前布局。 */
export function reconcileQueryFields(keys: readonly string[], saved: readonly QueryFormFieldSetting[] = []): QueryFormFieldSetting[] {
  const stored = new Map(saved.map(item => [item.key, item]));
  return keys.map((key, index) => ({
    key,
    visible: stored.get(key)?.visible !== false,
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
