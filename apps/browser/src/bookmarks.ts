/** 收藏链接；旧版无 id、无 parentId 的记录视为根目录收藏。 */
export interface Bookmark {
  /** 持久化标识；旧记录在读取时补齐。 */
  id?: string;
  /** 收藏名称。 */
  title: string;
  /** 原始地址。 */
  url: string;
  /** 所属文件夹；省略表示根目录。 */
  parentId?: string;
  /** 同级来源顺序；旧数据未设置时按保存顺序显示。 */
  order?: number;
}

/** 收藏夹目录，可嵌套；空目录也会保留。 */
export interface BookmarkFolder {
  /** 目录唯一标识。 */
  id: string;
  /** 目录名称。 */
  title: string;
  /** 上级目录；省略表示根目录。 */
  parentId?: string;
  /** 同级来源顺序。 */
  order?: number;
}

/** 原生导入接口返回的目录或收藏链接。 */
export interface ImportedBookmark {
  /** 来源名称。 */
  title: string;
  /** null 表示目录。 */
  url: string | null;
  /** 来源目录中的有序子项。 */
  children: ImportedBookmark[];
}

/** 将目录转换为完整路径选项，孤立目录仍可选择，异常循环不会递归溢出。 */
export function bookmarkFolderOptions(folders: readonly BookmarkFolder[]) {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  return [{ value: "", label: "收藏夹根目录" }, ...folders.map(folder => {
    const names = [folder.title];
    const seen = new Set([folder.id]);
    let parent = folder.parentId;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const item = byId.get(parent);
      if (!item) break;
      names.unshift(item.title);
      parent = item.parentId;
    }
    return { value: folder.id, label: names.join(" / ") };
  })];
}

/** 生成全新标识，保留来源目录和同名项目；导入只追加，不覆盖已有收藏。 */
export function materializeBookmarks(nodes: readonly ImportedBookmark[], parentId?: string) {
  const bookmarks: Bookmark[] = [];
  const folders: BookmarkFolder[] = [];
  let count = 0;
  function visit(items: readonly ImportedBookmark[], parent: string | undefined, depth: number) {
    if (depth > 64) throw new Error("收藏夹层级过深");
    for (const [order, item] of items.entries()) {
      if (++count > 100_000) throw new Error("收藏数量超过限制");
      const id = crypto.randomUUID();
      if (typeof item.url === "string") bookmarks.push({ id, title: item.title || item.url, url: item.url, parentId: parent, order });
      else {
        folders.push({ id, title: item.title || "未命名文件夹", parentId: parent, order });
        visit(item.children, id, depth + 1);
      }
    }
  }
  visit(nodes, parentId, 0);
  return { bookmarks, folders };
}
