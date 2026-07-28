/// <reference types="vite/client" />

interface TauriEvent<T> {
  event: string;
  id: number;
  payload: T;
}

interface Window {
  __SIA_WINDOW_MODE__?: "browser-overlay" | "browser-menu" | "browser-tab-panel";
  __TAURI__?: {
    core: {
      invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    };
    event: {
      listen<T>(event: string, handler: (event: TauriEvent<T>) => void): Promise<() => void>;
    };
    window?: {
      getCurrentWindow(): {
        label: string;
      };
    };
  };
}
