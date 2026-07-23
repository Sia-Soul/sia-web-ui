/// <reference types="vite/client" />

interface TauriEvent<T> {
  event: string;
  id: number;
  payload: T;
}

interface Window {
  __TAURI__?: {
    core: {
      invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    };
    event: {
      listen<T>(event: string, handler: (event: TauriEvent<T>) => void): Promise<() => void>;
    };
  };
}
