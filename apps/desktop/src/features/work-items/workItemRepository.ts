export type WorkItemType = "task" | "bug";
export type WorkItemStatus = "backlog" | "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type WorkItemPriority = "low" | "medium" | "high" | "urgent";

export type WorkItemRecord = {
  id: string;
  title: string;
  itemType: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  projectId: string | null;
  projectName: string | null;
  dueDate: string | null;
  description: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface SaveWorkItemInput {
  id: string;
  title: string;
  itemType: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  projectId: string | null;
  dueDate: string | null;
  description: string;
}

interface BrowserWorkItemStore {
  version: 1;
  items: WorkItemRecord[];
}

const BROWSER_STORE_KEY = "sia-workbench.work-items.v1";

function isDesktopRuntime() {
  return Boolean(window.__TAURI__?.core.invoke);
}

function readBrowserStore(): BrowserWorkItemStore {
  try {
    const value = window.localStorage.getItem(BROWSER_STORE_KEY);
    if (!value) return { version: 1, items: [] };
    const parsed = JSON.parse(value) as Partial<BrowserWorkItemStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return { version: 1, items: [] };
    }
    return { version: 1, items: parsed.items };
  } catch {
    return { version: 1, items: [] };
  }
}

function writeBrowserItems(items: WorkItemRecord[]) {
  const store: BrowserWorkItemStore = { version: 1, items };
  window.localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(store));
}

export async function listWorkItems(): Promise<WorkItemRecord[]> {
  if (isDesktopRuntime()) {
    return window.__TAURI__!.core.invoke<WorkItemRecord[]>("list_work_items");
  }
  return [...readBrowserStore().items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveWorkItem(
  input: SaveWorkItemInput,
  projectName: string | null = null,
): Promise<WorkItemRecord> {
  if (isDesktopRuntime()) {
    return window.__TAURI__!.core.invoke<WorkItemRecord>("save_work_item", { input });
  }

  const store = readBrowserStore();
  const existing = store.items.find((item) => item.id === input.id);
  const timestamp = new Date().toISOString();
  const completedAt = input.status === "done"
    ? existing?.completedAt ?? timestamp
    : null;
  const item: WorkItemRecord = {
    ...input,
    projectName,
    completedAt,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const items = existing
    ? store.items.map((current) => current.id === item.id ? item : current)
    : [item, ...store.items];
  writeBrowserItems(items);
  return item;
}

export async function deleteWorkItem(workItemId: string): Promise<boolean> {
  if (isDesktopRuntime()) {
    return window.__TAURI__!.core.invoke<boolean>("delete_work_item", { workItemId });
  }

  const store = readBrowserStore();
  const exists = store.items.some((item) => item.id === workItemId);
  if (!exists) return false;
  writeBrowserItems(store.items.filter((item) => item.id !== workItemId));
  return true;
}
