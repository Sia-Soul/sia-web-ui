import { ROOT_GROUP_ID, type BrowserGroup, type BrowserTab } from "./browserTypes";

/** 树中可整体拖动的对象；小分组必须携带其当前父级。 */
export type TreeDragItem = { kind: "tab"; tabId: string }
  | { kind: "group"; groupId: string }
  | { kind: "small-group"; groupId: string; smallGroupId: string };

/** 大分组按 beforeId 排序；小分组移入 groupId，并插在 beforeId 前，null 表示末尾。 */
export interface GroupDropTarget {
  groupId: string;
  beforeId: string | null;
}

/** 校验目标后整体搬移分组；页签身份、顺序和原数据空间保持不变。非法落点返回原数组。 */
export function moveTreeGroup(groups: BrowserGroup[], tabs: BrowserTab[], item: TreeDragItem, target: GroupDropTarget) {
  const unchanged = { groups, tabs };
  const source = item.kind !== "tab" && groups.find(group => group.id === item.groupId);
  if (!source) return unchanged;
  if (item.kind === "group") {
    if (target.beforeId === item.groupId || (target.beforeId !== null && !groups.some(group => group.id === target.beforeId))) return unchanged;
    const next = groups.filter(group => group.id !== item.groupId);
    next.splice(target.beforeId === null ? next.length : next.findIndex(group => group.id === target.beforeId), 0, source);
    return { groups: next, tabs };
  }
  if (item.kind !== "small-group") return unchanged;
  const small = source.smallGroups.find(group => group.id === item.smallGroupId);
  const destination = groups.find(group => group.id === target.groupId);
  if (!small || !destination || target.beforeId === small.id
    || (target.beforeId !== null && !destination.smallGroups.some(group => group.id === target.beforeId))
    || (source.id !== destination.id && destination.smallGroups.some(group => group.id === small.id))) return unchanged;
  const moved = { ...small, profileGroupId: small.profileGroupId ?? source.id };
  const nextGroups = groups.map(group => {
    const children = group.smallGroups.filter(child => group.id !== source.id || child.id !== small.id);
    if (group.id === destination.id) children.splice(target.beforeId === null ? children.length : children.findIndex(child => child.id === target.beforeId), 0, moved);
    return group.id === source.id || group.id === destination.id ? { ...group, smallGroups: children } : group;
  });
  const nextTabs = tabs.map(tab => tab.groupId === source.id && tab.smallGroupId === small.id
    ? { ...tab, groupId: destination.id, profileGroupId: tab.profileGroupId ?? moved.profileGroupId } : tab);
  return { groups: nextGroups, tabs: nextTabs };
}

/** 提取独立窗口所需的最小分组树，不复制同组的其他页签；空分组由调用方补一个空白页。 */
export function extractTreeItem(groups: BrowserGroup[], tabs: BrowserTab[], item: TreeDragItem) {
  const selected = tabs.filter(tab => item.kind === "tab" ? tab.id === item.tabId
    : tab.groupId === item.groupId && (item.kind === "group" || tab.smallGroupId === item.smallGroupId));
  const parentId = item.kind === "tab" ? selected[0]?.groupId : item.groupId;
  const parent = groups.find(group => group.id === parentId);
  if (item.kind === "tab" && !selected.length) return null;
  if (item.kind !== "tab" && !parent) return null;
  const smallId = item.kind === "small-group" ? item.smallGroupId : item.kind === "tab" ? selected[0]?.smallGroupId : undefined;
  if (item.kind === "small-group" && !parent?.smallGroups.some(small => small.id === smallId)) return null;
  const extractedGroups = parent ? [{ ...parent, smallGroups: item.kind === "group" ? parent.smallGroups : parent.smallGroups.filter(small => small.id === smallId) }] : [];
  return { groups: extractedGroups, tabs: selected, groupId: parentId ?? ROOT_GROUP_ID, smallGroupId: smallId };
}

/** 扩展权限跟随保留的数据空间；选择器仍使用当前名称，避免移动后出现失效的旧范围选项。 */
export function profileScopeGroups(groups: readonly BrowserGroup[]): BrowserGroup[] {
  const result = groups.map(group => ({ ...group, smallGroups: group.smallGroups.filter(small => !small.profileGroupId || small.profileGroupId === group.id) }));
  for (const group of groups) for (const small of group.smallGroups) {
    if (!small.profileGroupId || small.profileGroupId === group.id) continue;
    let owner = result.find(candidate => candidate.id === small.profileGroupId);
    if (!owner) { owner = { id: small.profileGroupId, name: `${group.name}的数据空间`, color: group.color, smallGroups: [] }; result.push(owner); }
    if (!owner.smallGroups.some(candidate => candidate.id === small.id)) owner.smallGroups = [...owner.smallGroups, { ...small, name: `${group.name} / ${small.name}` }];
  }
  return result;
}
