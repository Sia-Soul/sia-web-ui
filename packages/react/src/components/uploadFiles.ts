/** 统一校验文件类型，避免拖拽和粘贴绕过 input.accept。 */
export function acceptsUploadFile(file: File, accept?: string) {
  if (!accept?.trim()) return true;
  return accept.split(",").some(part => {
    const rule = part.trim().toLowerCase();
    const type = file.type.toLowerCase();
    return rule.startsWith(".") ? file.name.toLowerCase().endsWith(rule)
      : rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule;
  });
}
/** 包含根目录的路径最多两段时，文件直接位于根目录。 */
export function includeUploadPath(path: string, recursive: boolean) {
  return recursive || path.split("/").filter(Boolean).length <= 2;
}
/** 目录 API 分批返回条目，读取到空批次后才结束，避免大文件夹丢失文件。 */
export async function readUploadEntries(entries: readonly FileSystemEntry[], recursive: boolean) {
  const files: { file: File; path: string }[] = [];
  async function visit(entry: FileSystemEntry, path: string, depth: number): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      files.push({ file, path });
    } else if (entry.isDirectory && (recursive || depth === 0)) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      while (true) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await visit(child, `${path}/${child.name}`, depth + 1);
      }
    }
  }
  for (const entry of entries) await visit(entry, entry.name, 0);
  return files;
}
