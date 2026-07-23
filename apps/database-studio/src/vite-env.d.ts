/// <reference types="vite/client" />

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
      };
      sql?: {
        load(connection: string): Promise<{
          select<T>(query: string, bindValues?: unknown[]): Promise<T>;
          execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
          close(): Promise<boolean>;
        }>;
      };
    };
    __TAURI_INTERNALS__?: unknown;
  }
}

export {};
