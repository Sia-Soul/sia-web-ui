import { DEMO_PROFILES } from "../data/demo";
import type { ConnectionProfile } from "../types";
import { defaultDatabase } from "./connectionDefaults";

const STORAGE_KEY = "sia-data-studio:connections:v1";
const SESSION_PASSWORD_KEY = "sia-data-studio:session-passwords:v1";

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

function normalizeProfiles(profiles: readonly ConnectionProfile[]) {
  const passwords = sessionPasswords();
  return profiles.map((profile) => {
    const password = passwords[profile.id] ?? profile.password ?? "";
    return {
      ...profile,
      database: profile.database?.trim() || defaultDatabase(profile.kind),
      password,
      rememberPassword: Boolean(password),
      connected: false,
    };
  });
}

function persistedProfiles(profiles: readonly ConnectionProfile[]) {
  return profiles.map((profile) => ({
    ...profile,
    password: "",
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

  const persisted = persistedProfiles(profiles);
  const credentials = profiles.map((profile) => ({
    id: profile.id,
    password: profile.password,
    rememberPassword: profile.rememberPassword,
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
