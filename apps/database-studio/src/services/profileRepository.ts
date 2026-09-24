import { DEMO_PROFILES } from "../data/demo";
import type { ConnectionProfile } from "../types";
import { defaultDatabase } from "./connectionDefaults";

const STORAGE_KEY = "sia-data-studio:connections:v1";
const SESSION_PASSWORD_KEY = "sia-data-studio:session-passwords:v1";
const SESSION_MCP_CONFIG_KEY = "sia-data-studio:session-mcp-configs:v1";

type TauriWindow = Window & {
  __TAURI__?: {
    core?: {
      invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    };
  };
};

let desktopSaveQueue: Promise<void> = Promise.resolve();

function isDesktopRuntime() {
  return Boolean((window as TauriWindow).__TAURI__?.core?.invoke);
}

function sessionPasswords() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_PASSWORD_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** 读取仅在当前窗口会话中保留的 MCP 启动配置。 */
function sessionMcpConfigs() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_MCP_CONFIG_KEY) ?? "{}") as Record<string, ConnectionProfile["mcp"]>;
  } catch {
    return {};
  }
}

function normalizeProfiles(profiles: readonly ConnectionProfile[]) {
  const passwords = sessionPasswords();
  const mcpConfigs = sessionMcpConfigs();
  return profiles.map((profile) => {
    const password = passwords[profile.id] ?? profile.password ?? "";
    const connectionMode: ConnectionProfile["connectionMode"] = profile.connectionMode === "mcp" ? "mcp" : "direct";
    const mcp = mcpConfigs[profile.id] ?? profile.mcp;
    return {
      ...profile,
      connectionMode,
      mcp,
      database: profile.database?.trim() || defaultDatabase(profile.kind),
      password,
      // MCP 配置与直连密码共用“安全保存”开关，但分别写入独立的系统凭据项。
      rememberPassword: connectionMode === "mcp" ? Boolean(mcp) : Boolean(password),
      connected: false,
    };
  });
}

function persistedProfiles(profiles: readonly ConnectionProfile[]) {
  return profiles.map((profile) => ({
    ...profile,
    password: "",
    // MCP 参数可能包含完整数据库 URI，禁止写入 localStorage 或 connections.json。
    mcp: undefined,
    rememberPassword: profile.rememberPassword,
    connected: false,
  }));
}

export function loadProfiles(): ConnectionProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeProfiles(DEMO_PROFILES);
    const profiles = JSON.parse(raw) as ConnectionProfile[];
    return normalizeProfiles(profiles);
  } catch {
    return normalizeProfiles(DEMO_PROFILES);
  }
}

export async function loadPersistedProfiles(): Promise<ConnectionProfile[]> {
  const fallback = loadProfiles();
  if (!isDesktopRuntime()) return fallback;

  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
  if (!invoke) return fallback;

  try {
    const profiles = await invoke<ConnectionProfile[] | null>("load_connection_profiles");
    if (profiles !== null) {
      const normalized = normalizeProfiles(profiles);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedProfiles(normalized)));
      return normalized;
    }

    await saveProfiles(fallback);
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveProfiles(profiles: readonly ConnectionProfile[]): Promise<void> {
  const passwords = Object.fromEntries(
    profiles
      .filter((profile) => profile.rememberPassword && profile.password)
      .map((profile) => [profile.id, profile.password]),
  );
  sessionStorage.setItem(SESSION_PASSWORD_KEY, JSON.stringify(passwords));
  const mcpConfigs = Object.fromEntries(
    profiles
      .filter((profile) => profile.connectionMode === "mcp" && profile.rememberPassword && profile.mcp)
      .map((profile) => [profile.id, profile.mcp]),
  );
  sessionStorage.setItem(SESSION_MCP_CONFIG_KEY, JSON.stringify(mcpConfigs));

  const persisted = persistedProfiles(profiles);
  const credentials = profiles.map((profile) => ({
    id: profile.id,
    password: profile.password,
    rememberPassword: profile.rememberPassword,
    // 整份 MCP 配置交由 Tauri 写入系统安全凭据存储，避免连接 URI 明文落盘。
    mcpConfig: profile.mcp ? JSON.stringify(profile.mcp) : "",
    rememberMcpConfig: profile.connectionMode === "mcp" && profile.rememberPassword,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

  if (!isDesktopRuntime()) return Promise.resolve();
  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
  if (!invoke) return Promise.resolve();

  desktopSaveQueue = desktopSaveQueue
    .catch(() => undefined)
    .then(() => invoke<void>("save_connection_profiles", { profiles: persisted, credentials }));
  return desktopSaveQueue;
}
