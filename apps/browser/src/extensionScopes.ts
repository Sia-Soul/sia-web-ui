import type { BrowserGroup } from "./browserTypes";

/** 扩展允许的范围；省略 smallGroupId 表示父分组及其全部子分组。 */
export interface ExtensionScope {
  /** 稳定的父分组 ID，重命名不会改变授权。 */
  groupId: string;
  /** 指定时只允许此子分组，不影响父分组直属标签或同级子分组。 */
  smallGroupId?: string | null;
}

/** 缺省或 null 兼容旧版全局启用；空数组表示没有允许的分组。 */
export function extensionMatchesScope(scopes: readonly ExtensionScope[] | null | undefined, groupId: string, smallGroupId?: string | null) {
  return scopes == null || scopes.some((scope) => scope.groupId === groupId
    && (scope.smallGroupId == null || scope.smallGroupId === smallGroupId));
}

/** 管理页面显示实际保存的授权范围，已删除分组仍提示其失效的选择。 */
export function extensionScopeLabel(scopes: readonly ExtensionScope[] | null | undefined, groups: readonly BrowserGroup[]) {
  if (scopes == null) return "所有分组";
  if (!scopes.length) return "未选择分组";
  return scopes.map((scope) => {
    const group = groups.find((item) => item.id === scope.groupId);
    if (!group) return "已删除的分组";
    return scope.smallGroupId == null ? `${group.name}（含全部子分组）`
      : `${group.name} / ${group.smallGroups.find((small) => small.id === scope.smallGroupId)?.name ?? "已删除的子分组"}`;
  }).join("、");
}
