export interface FlatTreeOptions {
  idField?: string;
  parentIdField?: string;
  rootParentId?: unknown;
}
export type FlatTreeNode<T> = T & { children: FlatTreeNode<T>[] };

/** 平级列表转树；容忍孤儿节点，并切断自引用和循环关系，防止递归溢出。 */
export function buildFlatTree<T extends Record<string, any>>(items: readonly T[], options: FlatTreeOptions = {}): FlatTreeNode<T>[] {
  const { idField = "id", parentIdField = "pId", rootParentId } = options;
  const keyOf = (value: unknown) => String(value ?? "");
  const nodes = new Map(items.map(item => [keyOf(item[idField]), { ...item, children: [] } as FlatTreeNode<T>]));
  const roots: FlatTreeNode<T>[] = [];
  const isRoot = (parent: unknown) => rootParentId !== undefined ? keyOf(parent) === keyOf(rootParentId) : parent === null || parent === undefined || parent === "" || parent === 0;
  for (const node of nodes.values()) {
    const parentKey = keyOf(node[parentIdField]);
    const parent = nodes.get(parentKey);
    let cyclic = false;
    const visited = new Set([keyOf(node[idField])]);
    let ancestor = parent;
    while (ancestor) {
      const key = keyOf(ancestor[idField]);
      if (visited.has(key)) { cyclic = true; break; }
      visited.add(key);
      if (isRoot(ancestor[parentIdField])) break;
      ancestor = nodes.get(keyOf(ancestor[parentIdField]));
    }
    if (isRoot(node[parentIdField]) || !parent || cyclic) roots.push(node);
    else parent.children.push(node);
  }
  return roots;
}
