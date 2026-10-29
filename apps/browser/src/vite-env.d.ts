/// <reference types="vite/client" />

interface TauriEvent<T> {
  event: string;
  id: number;
  payload: T;
}

interface Window {
  /** 原生独立窗口注入的恢复标识，用于交接前保持已有数据空间存活。 */
  __SIA_DETACHED_WINDOW__?: boolean;
  /** 当前窗口接收的是仍在运行的网页实例，初始化时禁止重新导航。 */
  __SIA_LIVE_TRANSFER__?: boolean;
  __SIA_WINDOW_MODE__?: "browser-overlay" | "browser-menu" | "browser-tab-panel";
  __TAURI__?: {
    core: {
      invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    };
    event: {
      listen<T>(event: string, handler: (event: TauriEvent<T>) => void, options?: { target: { kind: "Webview" | "Window"; label: string } }): Promise<() => void>;
    };
    webview?: { getCurrentWebview(): { label: string } };
    window?: {
      getCurrentWindow(): {
        label: string;
      };
    };
  };
}
