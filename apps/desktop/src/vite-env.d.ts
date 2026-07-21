/// <reference types="vite/client" />

declare module "monaco-editor/editor/contrib/clipboard/browser/clipboard.js";
declare module "monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js";

interface Window {
  __TAURI__?: {
    core: {
      invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    };
  };
}
