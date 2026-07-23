type TauriWindow = Window & {
  __TAURI__?: {
    core?: {
      invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    };
  };
};

interface FileSystemWritableFileStream {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  name: string;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

type SaveFilePicker = (options: {
  suggestedName: string;
  types: readonly {
    description: string;
    accept: Record<string, readonly string[]>;
  }[];
}) => Promise<FileSystemFileHandle>;

type FilePickerWindow = Window & {
  showSaveFilePicker?: SaveFilePicker;
};

function normalizedCsvName(fileName: string) {
  return fileName.toLowerCase().endsWith(".csv") ? fileName : `${fileName}.csv`;
}

export async function saveCsvFile(fileName: string, csv: string): Promise<string | null> {
  const suggestedName = normalizedCsvName(fileName);
  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
  if (invoke) {
    return invoke<string | null>("save_csv_file", { suggestedName, csv });
  }

  const showSaveFilePicker = (window as FilePickerWindow).showSaveFilePicker;
  if (!showSaveFilePicker) {
    throw new Error("当前浏览器不支持选择文件保存路径，请在 Sia Data Studio 桌面版中导出。");
  }

  try {
    const handle = await showSaveFilePicker({
      suggestedName,
      types: [{
        description: "CSV 文件",
        accept: { "text/csv": [".csv"] },
      }],
    });
    const writable = await handle.createWritable();
    await writable.write(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    await writable.close();
    return handle.name;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}
