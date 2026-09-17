import type { TreeKey, TreeNode } from './FloatingDisplay';

/** 树勾选的内部状态；checked 含完整父子键，halfChecked 只含部分勾选的父节点。 */
export interface TreeCheckState {
  /** 完整选中的节点键，包括由子节点汇总得到的父节点。 */
  checked: Set<TreeKey>;
  /** 有部分可勾选子节点选中的父节点键。 */
  halfChecked: Set<TreeKey>;
}

// 禁用节点是传播边界；不勾选自身的分组节点仍允许其子节点参与联动。
function affectedKeys(node: TreeNode): TreeKey[] {
  if (node.disabled || node.disableCheckbox) return [];
  return [...(node.checkable === false ? [] : [node.key]), ...(node.children?.flatMap(affectedKeys) ?? [])];
}

/** 根据外部键集合计算父子联动及半选；独立模式原样保留键，不展开父节点。 */
export function getTreeCheckState(nodes: readonly TreeNode[], keys: readonly TreeKey[], strictly = false): TreeCheckState {
  const checked = new Set(keys);
  const halfChecked = new Set<TreeKey>();
  if (strictly) return { checked, halfChecked };
  const explicit = new Set(keys);
  function expand(items: readonly TreeNode[]) {
    for (const node of items) {
      if (explicit.has(node.key)) affectedKeys(node).forEach(key => checked.add(key));
      if (node.children) expand(node.children);
    }
  }
  expand(nodes);
  function fold(node: TreeNode): { checked: boolean; partial: boolean } | undefined {
    const children = node.children?.map(fold).filter(value => value !== undefined) ?? [];
    if (node.disabled || node.disableCheckbox) return undefined;
    if (!children.length) return { checked: checked.has(node.key), partial: false };
    const all = children.every(child => child.checked);
    const some = children.some(child => child.checked || child.partial);
    if (node.checkable !== false) {
      if (all) checked.add(node.key); else checked.delete(node.key);
      if (!all && some) halfChecked.add(node.key);
    }
    return { checked: all, partial: !all && some };
  }
  nodes.forEach(fold);
  return { checked, halfChecked };
}

/** 切换节点后重新汇总祖先；取消子项前移除祖先显式键，避免被父节点再次全选。 */
export function toggleTreeCheck(nodes: readonly TreeNode[], keys: readonly TreeKey[], node: TreeNode, strictly = false) {
  const state = getTreeCheckState(nodes, keys, strictly);
  const next = new Set(state.checked);
  const checked = !next.has(node.key);
  if (node.disabled || node.disableCheckbox || node.checkable === false) return { ...state, checkedValue: !checked };
  (strictly ? [node.key] : affectedKeys(node)).forEach(key => checked ? next.add(key) : next.delete(key));
  if (!strictly && !checked) {
    function removeParents(items: readonly TreeNode[]): boolean {
      let found = false;
      for (const item of items) {
        const childFound = item.children ? removeParents(item.children) : false;
        if (childFound) next.delete(item.key);
        if (item.key === node.key || childFound) found = true;
      }
      return found;
    }
    removeParents(nodes);
  }
  return { ...getTreeCheckState(nodes, [...next], strictly), checkedValue: checked };
}
