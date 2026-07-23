const STORAGE_KEY = "sia-data-studio:query-workspace:v1";

export interface QueryDocument {
  key: string;
  label: string;
  sql: string;
}

export interface QueryWorkspaceSnapshot {
  version: 1;
  activeQueryKey: string;
  queries: QueryDocument[];
}

type TauriWindow = Window & {
  __TAURI__?: {
    core?: {
      invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    };
  };
};

let desktopSaveQueue: Promise<void> = Promise.resolve();

function isSnapshot(value: unknown): value is QueryWorkspaceSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<QueryWorkspaceSnapshot>;
  return snapshot.version === 1
    && typeof snapshot.activeQueryKey === "string"
    && Array.isArray(snapshot.queries)
    && snapshot.queries.every((query) => (
      query
      && typeof query.key === "string"
      && typeof query.label === "string"
      && typeof query.sql === "string"
    ));
}

function loadBrowserSnapshot(): QueryWorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadQueryWorkspace(): Promise<QueryWorkspaceSnapshot | null> {
  const fallback = loadBrowserSnapshot();
  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
  if (!invoke) return fallback;

  try {
    const persisted = await invoke<unknown>("load_query_workspace");
    if (!isSnapshot(persisted)) return fallback;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    return persisted;
  } catch {
    return fallback;
  }
}

export function saveQueryWorkspace(snapshot: QueryWorkspaceSnapshot): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
  if (!invoke) return Promise.resolve();

  desktopSaveQueue = desktopSaveQueue
    .catch(() => undefined)
    .then(() => invoke<void>("save_query_workspace", { workspace: snapshot }));
  return desktopSaveQueue;
}
