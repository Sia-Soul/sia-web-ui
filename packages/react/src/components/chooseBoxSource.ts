/** ChooseBox 中的文件或目录；id 在同一数据源中必须稳定且唯一。 */
export interface ChooseBoxEntry {
  /** 数据源内的唯一标识，选择去重与目录缓存均使用此值。 */
  id: string;
  /** 不含父目录的显示名称。 */
  name: string;
  /** file 为文件，directory 为目录。 */
  kind: "file" | "directory";
  /** 显示路径；桌面源为绝对路径，网页源为授权目录名及相对路径，不能视为本机绝对路径。 */
  path: string;
  /** 浏览器授权句柄；仅浏览器源提供，不应通过 JSON 序列化保存。 */
  handle?: FileSystemHandle;
  /** 延后读取文件内容；仅浏览器文件项提供，调用时权限失效或文件已删除会拒绝 Promise。 */
  getFile?: () => Promise<File>;
}

/** ChooseBox 只读目录数据源；错误应拒绝 Promise，由组件展示并调用 onError。 */
export interface ChooseBoxSource {
  /** 获取可浏览的根目录，返回的条目必须为 directory；不会隐式弹出授权窗口。 */
  getRoots: () => Promise<readonly ChooseBoxEntry[]>;
  /** 读取指定目录的直接子项，不递归读取文件内容；条目必须使用稳定 id。 */
  readDirectory: (directory: ChooseBoxEntry) => Promise<readonly ChooseBoxEntry[]>;
  /** 可选的增加授权目录入口；只在用户点击时调用。取消返回 null，不改变已有授权或选中值。 */
  authorize?: () => Promise<ChooseBoxEntry | null>;
}

/** 创建网页端只读目录源。需支持 showDirectoryPicker 的安全上下文；用户逐次授权多个根目录后可跨目录多选，支持空文件夹。返回句柄可由业务继续读取，组件不会上传或写入文件。 */
export function createBrowserChooseBoxSource(): ChooseBoxSource {
  type Directory = FileSystemDirectoryHandle & { values(): AsyncIterableIterator<FileSystemFileHandle | Directory> };
  const roots: ChooseBoxEntry[] = [];
  const directories = new Map<string, Directory>();
  return {
    getRoots: async () => [...roots],
    authorize: async () => {
      const picker = (window as Window & { showDirectoryPicker?: (options: { mode: "read" }) => Promise<Directory> }).showDirectoryPicker;
      if (!picker) throw new Error("当前浏览器不支持目录授权，请使用 HTTPS 或 localhost 下的 Chrome / Edge，或接入桌面目录源。");
      try {
        // 必须直接由点击调用，不在 effect 或先等待其他异步请求后请求授权。
        const handle = await picker.call(window, { mode: "read" });
        for (const root of roots) if (await handle.isSameEntry(directories.get(root.id)!)) return root;
        const root: ChooseBoxEntry = { id: `browser-root-${roots.length + 1}`, name: handle.name, kind: "directory", path: handle.name, handle };
        directories.set(root.id, handle); roots.push(root);
        return root;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return null;
        throw error;
      }
    },
    readDirectory: async directory => {
      const handle = directories.get(directory.id);
      if (!handle) throw new Error("目录尚未授权，请重新添加目录。");
      const result: ChooseBoxEntry[] = [];
      for await (const child of handle.values()) {
        const id = `${directory.id}/${encodeURIComponent(child.name)}`;
        if (child.kind === "directory") directories.set(id, child);
        result.push({ id, name: child.name, kind: child.kind, path: `${directory.path}/${child.name}`, handle: child,
          ...(child.kind === "file" ? { getFile: () => child.getFile() } : {}) });
      }
      return result;
    },
  };
}

/** Tauri 命令调用器；框架不依赖 Tauri 包，宿主自行传入 core.invoke。 */
export type ChooseBoxInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** 创建桌面只读目录源；宿主须注册 choose_box_roots 与 choose_box_read_directory 命令，返回 ChooseBoxEntry 数组。目录读取以 path 传参，权限和允许访问范围由宿主校验；命令失败原样拒绝 Promise。 */
export function createTauriChooseBoxSource(invoke: ChooseBoxInvoke): ChooseBoxSource {
  return {
    getRoots: () => invoke<ChooseBoxEntry[]>("choose_box_roots"),
    readDirectory: directory => invoke<ChooseBoxEntry[]>("choose_box_read_directory", { path: directory.path }),
  };
}
