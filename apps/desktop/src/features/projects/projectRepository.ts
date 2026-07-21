export type ProjectStatus = "planning" | "active" | "paused" | "completed";
export type ProjectPriority = "low" | "medium" | "high" | "urgent";

export interface ProjectRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  companyId: string | null;
  companyName: string | null;
  startDate: string | null;
  dueDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProjectInput {
  id: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  companyId: string | null;
  companyName: string | null;
  startDate: string | null;
  dueDate: string | null;
}

interface BrowserProjectStore {
  version: 1;
  projects: ProjectRecord[];
}

const BROWSER_STORE_KEY = "sia-workbench.projects.v1";

function isDesktopRuntime() {
  return Boolean(window.__TAURI__?.core.invoke);
}

function readBrowserStore(): BrowserProjectStore {
  try {
    const value = window.localStorage.getItem(BROWSER_STORE_KEY);
    if (!value) return { version: 1, projects: [] };
    const parsed = JSON.parse(value) as Partial<BrowserProjectStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.projects)) {
      return { version: 1, projects: [] };
    }
    return { version: 1, projects: parsed.projects };
  } catch {
    return { version: 1, projects: [] };
  }
}

function writeBrowserProjects(projects: ProjectRecord[]) {
  const store: BrowserProjectStore = { version: 1, projects };
  window.localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(store));
}

export async function listProjects(includeArchived = true): Promise<ProjectRecord[]> {
  if (isDesktopRuntime()) {
    return window.__TAURI__!.core.invoke<ProjectRecord[]>("list_projects", { includeArchived });
  }

  return readBrowserStore().projects
    .filter((project) => includeArchived || !project.archivedAt)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveProject(input: SaveProjectInput): Promise<ProjectRecord> {
  if (isDesktopRuntime()) {
    return window.__TAURI__!.core.invoke<ProjectRecord>("save_project", { input });
  }

  const store = readBrowserStore();
  const existing = store.projects.find((project) => project.id === input.id);
  const timestamp = new Date().toISOString();
  const project: ProjectRecord = {
    ...input,
    archivedAt: existing?.archivedAt ?? null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const projects = existing
    ? store.projects.map((item) => item.id === project.id ? project : item)
    : [project, ...store.projects];
  writeBrowserProjects(projects);
  return project;
}

export async function archiveProject(projectId: string, archived: boolean): Promise<ProjectRecord> {
  if (isDesktopRuntime()) {
    return window.__TAURI__!.core.invoke<ProjectRecord>("archive_project", {
      projectId,
      archived,
    });
  }

  const store = readBrowserStore();
  const existing = store.projects.find((project) => project.id === projectId);
  if (!existing) throw new Error("没有找到要归档的项目");
  const updated: ProjectRecord = {
    ...existing,
    archivedAt: archived ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };
  writeBrowserProjects(store.projects.map((project) => project.id === projectId ? updated : project));
  return updated;
}
