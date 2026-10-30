import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Icon,
  Modal,
  ThemeSwitch,
  ToolPanel,
  WindowFrame,
  WindowTitleBar,
  applySiaTheme,
  message,
  type TreeNode,
  type WindowAction,
} from "@sia.soul/sia-react-ui";
import { ConnectionModal } from "./components/ConnectionModal";
import { DatabaseUserModal } from "./components/DatabaseUserModal";
import {
  ConnectionRail,
  type ConnectionMenuAction,
  type DatabaseMenuAction,
  type TableMenuAction,
  type TableMenuTarget,
  type UserMenuAction,
  type UserMenuTarget,
} from "./components/ConnectionRail";
import { Inspector } from "./components/Inspector";
import { QueryWorkspace } from "./components/QueryWorkspace";
import { DEFAULT_SQL, DEMO_HISTORY } from "./data/demo";
import {
  SqlConfirmationRequiredError,
  connect,
  createDatabaseUser,
  deleteDatabaseUser,
  disconnect,
  executeSql,
  isDesktopRuntime,
  loadDatabaseUsers,
  loadDatabaseCategory,
  loadDatabaseObjectColumns,
  loadDatabaseSchema,
  loadConnectionObjectSummary,
  loadExecutionHistory,
  loadSchema,
  updateDatabaseUser,
  updateResultCell,
} from "./services/databaseGateway";
import { loadPersistedProfiles, loadProfiles, saveProfiles } from "./services/profileRepository";
import { defaultDatabase } from "./services/connectionDefaults";
import { formatSql } from "./services/sqlFormatter";
import type {
  ConnectionProfile,
  DatabaseKind,
  DatabaseObjectCategory,
  DatabaseUser,
  DatabaseUserInput,
  DatabaseUserSnapshot,
  ExecutionHistoryPage,
  QueryExecutionMessage,
  QueryResult,
  SchemaSnapshot,
  SqlExecutionDetail,
  SqlSafetyOptions,
} from "./types";

const STUDIO_TOOL_PANELS_KEY = "sia-data-studio:tool-panels:v4";
const QUERY_CONTEXT_KEY = "sia-data-studio:query-context:v1";

const EMPTY_QUERY_RESULT: QueryResult = {
  rows: [],
  durationMs: 0,
  executedAt: "",
  message: "尚未执行 SQL。",
};

interface StudioToolPanels {
  leftOpen: boolean;
  rightOpen: boolean;
  leftSize: number;
  rightSize: number;
}

interface DatabaseUserEditor {
  profileId: string;
  mode: "create" | "edit";
  user?: DatabaseUser;
}

interface QueryContext {
  connectionId: string;
  database: string;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createExecutionMessageId() {
  return `query-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function showError(title: string, error: unknown) {
  Modal.error({
    title,
    children: errorText(error),
    centered: true,
    width: 560,
  });
}

function findTreeNode(nodes: readonly TreeNode[], predicate: (node: TreeNode) => boolean): TreeNode | undefined {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const found = node.children ? findTreeNode(node.children, predicate) : undefined;
    if (found) return found;
  }
  return undefined;
}

function replaceTreeNode(
  nodes: readonly TreeNode[],
  predicate: (node: TreeNode) => boolean,
  replacement: TreeNode,
): TreeNode[] {
  return nodes.map((node) => {
    if (predicate(node)) return replacement;
    if (!node.children) return node;
    const children = replaceTreeNode(node.children, predicate, replacement);
    return children.some((child, index) => child !== node.children?.[index]) ? { ...node, children } : node;
  });
}

function loadStudioToolPanels(): StudioToolPanels {
  try {
    const value = JSON.parse(localStorage.getItem(STUDIO_TOOL_PANELS_KEY) ?? "null") as Partial<StudioToolPanels> | null;
    if (value
      && typeof value.leftOpen === "boolean"
      && typeof value.rightOpen === "boolean"
      && typeof value.leftSize === "number"
      && typeof value.rightSize === "number"
      && Number.isFinite(value.leftSize)
      && Number.isFinite(value.rightSize)) {
      return {
        leftOpen: value.leftOpen,
        rightOpen: value.rightOpen,
        leftSize: value.leftSize,
        rightSize: value.rightSize,
      };
    }
  } catch {
    // 使用默认工具面板状态。
  }
  return { leftOpen: true, rightOpen: false, leftSize: 320, rightSize: 360 };
}

function loadQueryContext(profiles: readonly ConnectionProfile[]): QueryContext {
  try {
    const value = JSON.parse(localStorage.getItem(QUERY_CONTEXT_KEY) ?? "null") as Partial<QueryContext> | null;
    const profile = profiles.find((item) => item.id === value?.connectionId);
    if (profile) {
      return {
        connectionId: profile.id,
        database: typeof value?.database === "string" && value.database.trim() ? value.database : profile.database,
      };
    }
  } catch {
    // 使用首个连接作为查询上下文。
  }
  const profile = profiles[0];
  return { connectionId: profile?.id ?? "", database: profile?.database ?? "" };
}

export default function App() {
  const [windowTheme, setWindowTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const [profiles, setProfiles] = useState<ConnectionProfile[]>(() => loadProfiles().map((profile) => ({ ...profile, connected: isDesktopRuntime ? false : profile.connected })));
  const [activeId, setActiveId] = useState(() => profiles[0]?.id ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | undefined>();
  const [newConnectionKind, setNewConnectionKind] = useState<DatabaseKind>("postgres");
  const [schemas, setSchemas] = useState<Record<string, SchemaSnapshot>>({});
  const [databaseUsers, setDatabaseUsers] = useState<Record<string, DatabaseUserSnapshot>>({});
  const [databaseUserEditor, setDatabaseUserEditor] = useState<DatabaseUserEditor>();
  const [schemaLoadingId, setSchemaLoadingId] = useState("");
  const [connectingId, setConnectingId] = useState("");
  const [queryContext, setQueryContext] = useState<QueryContext>(() => loadQueryContext(profiles));
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [result, setResult] = useState<QueryResult>(EMPTY_QUERY_RESULT);
  const [executionMessages, setExecutionMessages] = useState<QueryExecutionMessage[]>([]);
  const [historyState, setHistoryState] = useState<ExecutionHistoryPage>({ items: DEMO_HISTORY, total: DEMO_HISTORY.length });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [newQueryRequest, setNewQueryRequest] = useState<{ id: number; sql?: string; label?: string }>({ id: 0 });
  const [toolPanels, setToolPanels] = useState(loadStudioToolPanels);
  const databaseObjectLoadingRef = useRef(new Map<string, Promise<void>>());
  const completionColumnLoadingRef = useRef(new Map<string, Promise<readonly string[]>>());
  const [databaseObjectLoadingKeys, setDatabaseObjectLoadingKeys] = useState<Set<string>>(() => new Set());

  const updateToolPanels = useCallback((patch: Partial<StudioToolPanels>) => {
    setToolPanels((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(STUDIO_TOOL_PANELS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeId) ?? profiles[0], [activeId, profiles]);
  const queryProfile = useMemo(
    () => profiles.find((profile) => profile.id === queryContext.connectionId) ?? profiles[0],
    [profiles, queryContext.connectionId],
  );
  const activeDatabase = useMemo(() => {
    if (!queryProfile) return "";
    const selected = queryContext.database || queryProfile.database;
    const databases = schemas[queryProfile.id]?.databases;
    return databases?.some((database) => database.name === selected) ? selected : queryProfile.database;
  }, [queryContext.database, queryProfile, schemas]);
  const executionProfile = useMemo(
    () => queryProfile ? { ...queryProfile, database: activeDatabase } : undefined,
    [activeDatabase, queryProfile],
  );
  const databaseOptions = useMemo(() => {
    if (!queryProfile) return [];
    const names = [...new Set([
      activeDatabase || queryProfile.database,
      ...(schemas[queryProfile.id]?.databases.map((database) => database.name) ?? []),
    ])].filter(Boolean);
    return names.map((database) => ({ label: database, value: database }));
  }, [activeDatabase, queryProfile, schemas]);
  const activeDatabaseSchema = useMemo(
    () => queryProfile
      ? schemas[queryProfile.id]?.databases.find((database) => database.name === activeDatabase)
      : undefined,
    [activeDatabase, queryProfile, schemas],
  );
  const loadCompletionColumns = useCallback((tableName: string, schemaName?: string): Promise<readonly string[]> => {
    if (!queryProfile?.connected || !activeDatabase) return Promise.resolve([]);
    const predicate = (node: TreeNode) =>
      (node.nodeType === "table" || node.nodeType === "view")
      && node.tableName === tableName
      && (node.schemaName ?? "") === (schemaName ?? "");
    const cachedNode = activeDatabaseSchema ? findTreeNode(activeDatabaseSchema.nodes, predicate) : undefined;
    if (cachedNode?.loaded === true) {
      return Promise.resolve(cachedNode.children
        ?.map((node) => typeof node.title === "string" ? node.title : "")
        .filter(Boolean) ?? []);
    }

    const cacheKey = `${queryProfile.id}:${activeDatabase}:${schemaName ?? ""}:${tableName}`.toLowerCase();
    const pending = completionColumnLoadingRef.current.get(cacheKey);
    if (pending) return pending;
    const request = loadDatabaseObjectColumns(queryProfile, activeDatabase, tableName, schemaName)
      .then((nodes) => nodes
        .map((node) => typeof node.title === "string" ? node.title : "")
        .filter(Boolean))
      .catch(() => {
        completionColumnLoadingRef.current.delete(cacheKey);
        return [];
      });
    completionColumnLoadingRef.current.set(cacheKey, request);
    return request;
  }, [activeDatabase, activeDatabaseSchema, queryProfile]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const nextTheme = media.matches ? "dark" : "light";
      setWindowTheme(nextTheme);
      applySiaTheme(nextTheme);
    };
    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, []);

  const appendExecutionMessage = useCallback((entry: QueryExecutionMessage) => {
    setExecutionMessages((current) => [entry, ...current].slice(0, 200));
  }, []);

  useEffect(() => {
    localStorage.setItem(QUERY_CONTEXT_KEY, JSON.stringify(queryContext));
  }, [queryContext]);

  useEffect(() => {
    let cancelled = false;
    void loadPersistedProfiles().then((persisted) => {
      if (cancelled) return;
      setProfiles(persisted.map((profile) => ({
        ...profile,
        connected: isDesktopRuntime ? false : profile.connected,
      })));
      setActiveId((current) => persisted.some((profile) => profile.id === current) ? current : persisted[0]?.id ?? "");
      setQueryContext((current) => {
        const profile = persisted.find((item) => item.id === current.connectionId) ?? persisted[0];
        return {
          connectionId: profile?.id ?? "",
          database: profile?.id === current.connectionId && current.database ? current.database : profile?.database ?? "",
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordExecution = useCallback((execution?: SqlExecutionDetail) => {
    if (!execution) return;
    setHistoryState((current) => {
      const exists = current.items.some((item) => item.id === execution.id);
      return {
        items: [execution, ...current.items.filter((item) => item.id !== execution.id)].slice(0, 20),
        total: exists ? current.total : current.total + 1,
      };
    });
  }, []);

  const loadHistoryPage = useCallback(async (page: number, pageSize: number): Promise<ExecutionHistoryPage> => {
    if (!queryProfile) return { items: [], total: 0 };
    const loaded = await loadExecutionHistory(queryProfile, pageSize, (page - 1) * pageSize);
    return {
      ...loaded,
      items: loaded.items.map((item) => ({ ...item, connectionName: queryProfile.name })),
    };
  }, [queryProfile]);

  const refreshExecutionHistory = useCallback(async () => {
    try {
      setHistoryState(await loadHistoryPage(1, 20));
    } catch (historyError) {
      showError("执行日志加载失败", historyError);
    }
  }, [loadHistoryPage]);

  useEffect(() => {
    void refreshExecutionHistory();
  }, [refreshExecutionHistory]);

  const loadConnectionOverview = useCallback(async (profile: ConnectionProfile) => {
    setSchemaLoadingId(profile.id);
    try {
      const summary = await loadConnectionObjectSummary(profile);
      setSchemas((current) => ({
        ...current,
        [profile.id]: {
          database: profile.database.trim() || defaultDatabase(profile.kind),
          databases: [],
          databaseCount: summary.databaseCount,
          databasesLoaded: false,
        },
      }));
      setDatabaseUsers((current) => ({
        ...current,
        [profile.id]: {
          users: [],
          count: summary.userCount,
          loaded: false,
        },
      }));
    } finally {
      setSchemaLoadingId((current) => current === profile.id ? "" : current);
    }
  }, []);

  const loadConnectionNode = useCallback(async (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile?.connected) return;
    await loadConnectionOverview(profile);
  }, [loadConnectionOverview, profiles]);

  const refreshSchema = useCallback(async () => {
    if (!activeProfile?.connected) return;
    try {
      await loadConnectionOverview(activeProfile);
    } catch (schemaError) {
      showError("数据库对象加载失败", schemaError);
    }
  }, [activeProfile, loadConnectionOverview]);

  const loadDatabaseList = useCallback((profileId: string, force = false): Promise<void> => {
    const profile = profiles.find((item) => item.id === profileId);
    const snapshot = schemas[profileId];
    const loadingKey = `databases:${profileId}`;
    const pending = databaseObjectLoadingRef.current.get(loadingKey);
    if (pending) return pending;
    if (!profile?.connected || (!force && snapshot?.databasesLoaded)) return Promise.resolve();

    setDatabaseObjectLoadingKeys((current) => new Set(current).add(loadingKey));
    const request = (async () => {
      try {
        const nextSchema = await loadSchema(profile);
        setSchemas((current) => ({ ...current, [profileId]: nextSchema }));
      } catch (databaseError) {
        showError(`数据库列表加载失败 · ${profile.name}`, databaseError);
        throw databaseError;
      } finally {
        databaseObjectLoadingRef.current.delete(loadingKey);
        setDatabaseObjectLoadingKeys((current) => {
          const next = new Set(current);
          next.delete(loadingKey);
          return next;
        });
      }
    })();
    databaseObjectLoadingRef.current.set(loadingKey, request);
    return request;
  }, [profiles, schemas]);

  const loadDatabaseObjects = useCallback((profileId: string, databaseName: string, force = false): Promise<void> => {
    const profile = profiles.find((item) => item.id === profileId);
    const database = schemas[profileId]?.databases.find((item) => item.name === databaseName);
    const loadingKey = `database:${profileId}:${databaseName}`;
    const pending = databaseObjectLoadingRef.current.get(loadingKey);
    if (pending) return pending;
    if (!profile?.connected || (!force && database?.loaded)) return Promise.resolve();

    setDatabaseObjectLoadingKeys((current) => new Set(current).add(loadingKey));
    const request = (async () => {
      try {
        const nextDatabase = await loadDatabaseSchema(profile, databaseName);
        setSchemas((current) => {
          const snapshot = current[profileId];
          if (!snapshot) return current;
          return {
            ...current,
            [profileId]: {
              ...snapshot,
              databases: snapshot.databases.map((item) => item.name === databaseName ? nextDatabase : item),
            },
          };
        });
      } catch (databaseError) {
        const text = errorText(databaseError);
        setSchemas((current) => {
          const snapshot = current[profileId];
          if (!snapshot) return current;
          return {
            ...current,
            [profileId]: {
              ...snapshot,
              databases: snapshot.databases.map((item) => item.name === databaseName
                ? { ...item, loaded: true, error: text }
                : item),
            },
          };
        });
        showError(`数据库 ${databaseName} 加载失败`, text);
      } finally {
        databaseObjectLoadingRef.current.delete(loadingKey);
        setDatabaseObjectLoadingKeys((current) => {
          const next = new Set(current);
          next.delete(loadingKey);
          return next;
        });
      }
    })();
    databaseObjectLoadingRef.current.set(loadingKey, request);
    return request;
  }, [profiles, schemas]);

  const loadDatabaseCategoryObjects = useCallback((
    profileId: string,
    databaseName: string,
    category: DatabaseObjectCategory,
    force = false,
  ): Promise<void> => {
    const profile = profiles.find((item) => item.id === profileId);
    const database = schemas[profileId]?.databases.find((item) => item.name === databaseName);
    const currentCategory = database?.nodes.find((node) => node.key === category);
    const loadingKey = `category:${profileId}:${databaseName}:${category}`;
    const treeLoadingKey = `object:${profileId}:${databaseName}:${category}`;
    const pending = databaseObjectLoadingRef.current.get(loadingKey);
    if (pending) return pending;
    if (!profile?.connected || !database?.loaded || (!force && currentCategory?.loaded === true)) return Promise.resolve();

    setDatabaseObjectLoadingKeys((current) => new Set(current).add(treeLoadingKey));
    const request = (async () => {
      try {
        const nextCategory = await loadDatabaseCategory(profile, databaseName, category);
        setSchemas((current) => {
          const snapshot = current[profileId];
          if (!snapshot) return current;
          return {
            ...current,
            [profileId]: {
              ...snapshot,
              databases: snapshot.databases.map((item) => item.name === databaseName
                ? { ...item, nodes: replaceTreeNode(item.nodes, (node) => node.key === category, nextCategory) }
                : item),
            },
          };
        });
      } catch (categoryError) {
        showError(`${databaseName} · ${String(currentCategory?.title ?? category)} 加载失败`, categoryError);
      } finally {
        databaseObjectLoadingRef.current.delete(loadingKey);
        setDatabaseObjectLoadingKeys((current) => {
          const next = new Set(current);
          next.delete(treeLoadingKey);
          return next;
        });
      }
    })();
    databaseObjectLoadingRef.current.set(loadingKey, request);
    return request;
  }, [profiles, schemas]);

  const loadDatabaseObjectFields = useCallback((
    profileId: string,
    databaseName: string,
    tableName: string,
    schemaName?: string,
    force = false,
  ): Promise<void> => {
    const profile = profiles.find((item) => item.id === profileId);
    const database = schemas[profileId]?.databases.find((item) => item.name === databaseName);
    const predicate = (node: TreeNode) =>
      (node.nodeType === "table" || node.nodeType === "view")
      && node.tableName === tableName
      && (node.schemaName ?? "") === (schemaName ?? "");
    const currentObject = database ? findTreeNode(database.nodes, predicate) : undefined;
    const objectKey = currentObject?.key;
    const loadingKey = `fields:${profileId}:${databaseName}:${schemaName ?? ""}:${tableName}`;
    const treeLoadingKey = objectKey ? `object:${profileId}:${databaseName}:${objectKey}` : loadingKey;
    const pending = databaseObjectLoadingRef.current.get(loadingKey);
    if (pending) return pending;
    if (!profile?.connected || !currentObject || (!force && currentObject.loaded === true)) return Promise.resolve();

    setDatabaseObjectLoadingKeys((current) => new Set(current).add(treeLoadingKey));
    const request = (async () => {
      try {
        const columns = await loadDatabaseObjectColumns(profile, databaseName, tableName, schemaName);
        setSchemas((current) => {
          const snapshot = current[profileId];
          if (!snapshot) return current;
          return {
            ...current,
            [profileId]: {
              ...snapshot,
              databases: snapshot.databases.map((item) => {
                if (item.name !== databaseName) return item;
                const latestObject = findTreeNode(item.nodes, predicate) ?? currentObject;
                return {
                  ...item,
                  nodes: replaceTreeNode(item.nodes, predicate, {
                    ...latestObject,
                    children: columns,
                    loaded: true,
                  }),
                };
              }),
            },
          };
        });
      } catch (fieldError) {
        showError(`字段加载失败 · ${schemaName ? `${schemaName}.` : ""}${tableName}`, fieldError);
      } finally {
        databaseObjectLoadingRef.current.delete(loadingKey);
        setDatabaseObjectLoadingKeys((current) => {
          const next = new Set(current);
          next.delete(treeLoadingKey);
          return next;
        });
      }
    })();
    databaseObjectLoadingRef.current.set(loadingKey, request);
    return request;
  }, [profiles, schemas]);

  const loadUsers = useCallback(async (profileId: string, force = false) => {
    const profile = profiles.find((item) => item.id === profileId);
    const snapshot = databaseUsers[profileId];
    if (!profile?.connected || (!force && snapshot?.loaded)) return;
    setDatabaseUsers((current) => ({
      ...current,
      [profileId]: {
        users: current[profileId]?.users ?? [],
        count: current[profileId]?.count,
        loaded: false,
        loading: true,
      },
    }));
    try {
      const users = await loadDatabaseUsers(profile);
      setDatabaseUsers((current) => ({
        ...current,
        [profileId]: { users, count: users.length, loaded: true },
      }));
    } catch (userError) {
      const text = errorText(userError);
      setDatabaseUsers((current) => ({
        ...current,
        [profileId]: {
          users: current[profileId]?.users ?? [],
          count: current[profileId]?.count,
          loaded: true,
          error: text,
        },
      }));
      showError(`用户列表加载失败 · ${profile.name}`, text);
    }
  }, [databaseUsers, profiles]);

  useEffect(() => {
    if (activeProfile?.connected) void refreshSchema();
  }, [activeProfile?.id, activeProfile?.connected, refreshSchema]);

  const runQuery = useCallback(async (statementSql = sql, safety: SqlSafetyOptions = {}) => {
    if (!executionProfile) return;
    if (!statementSql.trim()) {
      const messageText = "请输入要执行的 SQL。";
      setError(messageText);
      showError("SQL 执行失败", messageText);
      return;
    }
    const attemptStartedAt = new Date().toISOString();
    let sqlStartedAt = attemptStartedAt;
    setRunning(true);
    setError("");
    let connectionMessage: ReturnType<typeof message.loading> | undefined;
    let queryExecutionProfile = executionProfile;
    try {
      if (!executionProfile.connected) {
        setConnectingId(executionProfile.id);
        connectionMessage = message.loading(
          `当前连接未建立，正在连接“${executionProfile.name}”；连接成功后将自动执行 SQL。`,
          0,
        );
        try {
          const duration = await connect(executionProfile);
          queryExecutionProfile = { ...executionProfile, connected: true };
          setProfiles((items) => items.map((item) =>
            item.id === executionProfile.id ? { ...item, connected: true } : item));
          connectionMessage.update({
            type: "loading",
            content: `连接成功（${duration} ms），正在执行 SQL…`,
            duration: 0,
          });
        } catch (connectionError) {
          const text = errorText(connectionError);
          const finishedAt = new Date().toISOString();
          setError(text);
          appendExecutionMessage({
            id: createExecutionMessageId(),
            startedAt: attemptStartedAt,
            finishedAt,
            durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(attemptStartedAt)),
            status: "error",
            result: `自动连接失败：${text}`,
            sql: statementSql,
          });
          connectionMessage.update({
            type: "error",
            content: `自动连接失败：${text}`,
            duration: 4,
          });
          showError(`自动连接 ${executionProfile.name} 失败`, text);
          return;
        } finally {
          setConnectingId((current) => current === executionProfile.id ? "" : current);
        }
      }

      sqlStartedAt = new Date().toISOString();
      const nextResult = await executeSql(queryExecutionProfile, statementSql, safety);
      setResult(nextResult);
      recordExecution(nextResult.execution);
      const execution = nextResult.execution;
      const finishedAt = execution?.finishedAt ?? new Date().toISOString();
      appendExecutionMessage({
        id: execution?.id ?? createExecutionMessageId(),
        startedAt: execution?.startedAt ?? sqlStartedAt,
        finishedAt,
        durationMs: execution?.durationMs
          ?? Math.max(0, Date.parse(finishedAt) - Date.parse(sqlStartedAt)),
        status: "success",
        result: nextResult.message,
        sql: statementSql,
      });
      connectionMessage?.update({
        type: "success",
        content: "连接成功，SQL 已执行完成。",
        duration: 2,
      });
    } catch (queryError) {
      if (queryError instanceof SqlConfirmationRequiredError) {
        connectionMessage?.close();
        recordExecution(queryError.execution);
        Modal.confirm({
          type: "warning",
          title: queryError.confirmation.title,
          children: queryError.confirmation.message,
          okText: queryError.confirmation.type === "backup-failed" ? "无备份执行" : "确认执行",
          cancelText: "取消",
          okButtonProps: { danger: true },
          onOk: () => runQuery(statementSql, {
            ...safety,
            confirmWithoutWhere: safety.confirmWithoutWhere || queryError.confirmation.type === "missing-where",
            allowWithoutBackup: safety.allowWithoutBackup || queryError.confirmation.type === "backup-failed",
          }),
        });
        return;
      }
      connectionMessage?.close();
      const text = queryError instanceof Error ? queryError.message : String(queryError);
      const finishedAt = new Date().toISOString();
      setError(text);
      appendExecutionMessage({
        id: createExecutionMessageId(),
        startedAt: sqlStartedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(sqlStartedAt)),
        status: "error",
        result: text,
        sql: statementSql,
      });
      showError("SQL 执行失败", text);
      void refreshExecutionHistory();
    } finally {
      setRunning(false);
    }
  }, [appendExecutionMessage, executionProfile, recordExecution, refreshExecutionHistory, sql]);

  const saveResultCell = useCallback(async (
    column: string,
    rowIndex: number,
    value: unknown,
    safety: SqlSafetyOptions = {},
  ): Promise<boolean> => {
    if (!executionProfile) return false;
    const attemptStartedAt = new Date().toISOString();
    if (!executionProfile.connected) {
      const text = "当前数据库连接已断开，请重新连接后再修改结果。";
      const finishedAt = new Date().toISOString();
      appendExecutionMessage({
        id: createExecutionMessageId(),
        startedAt: attemptStartedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(attemptStartedAt)),
        status: "error",
        result: text,
        sql: `-- 更新结果单元格：${column}`,
      });
      showError("结果更新失败", text);
      return false;
    }
    try {
      const updated = await updateResultCell(executionProfile, result, column, rowIndex, value, safety);
      const successMessage = updated.execution?.backupSkipped
        ? "UPDATE 执行成功；用户已确认无备份执行。"
        : `UPDATE 执行成功；已备份 ${updated.execution?.backupRowCount ?? 0} 行。`;
      setResult((current) => ({
        ...current,
        rows: updated.rows,
        execution: updated.execution,
        durationMs: updated.execution?.durationMs ?? current.durationMs,
        executedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        message: successMessage,
      }));
      recordExecution(updated.execution);
      const execution = updated.execution;
      const finishedAt = execution?.finishedAt ?? new Date().toISOString();
      appendExecutionMessage({
        id: execution?.id ?? createExecutionMessageId(),
        startedAt: execution?.startedAt ?? attemptStartedAt,
        finishedAt,
        durationMs: execution?.durationMs
          ?? Math.max(0, Date.parse(finishedAt) - Date.parse(attemptStartedAt)),
        status: "success",
        result: successMessage,
        sql: execution?.sql ?? `-- 更新结果单元格：${column}`,
      });
      if (updated.execution?.backupSkipped) message.warning("已按确认执行 UPDATE，本次没有备份。");
      else message.success(`已执行 UPDATE，并备份 ${updated.execution?.backupRowCount ?? 0} 行。`);
      return true;
    } catch (updateError) {
      if (updateError instanceof SqlConfirmationRequiredError) {
        recordExecution(updateError.execution);
        return new Promise<boolean>((resolve) => {
          Modal.confirm({
            type: "warning",
            title: updateError.confirmation.title,
            children: updateError.confirmation.message,
            okText: "无备份更新",
            cancelText: "取消更新",
            okButtonProps: { danger: true },
            onCancel: () => resolve(false),
            onOk: async () => {
              const saved = await saveResultCell(column, rowIndex, value, { ...safety, allowWithoutBackup: true });
              resolve(saved);
              return saved;
            },
          });
        });
      }
      const text = errorText(updateError);
      const finishedAt = new Date().toISOString();
      appendExecutionMessage({
        id: createExecutionMessageId(),
        startedAt: attemptStartedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(attemptStartedAt)),
        status: "error",
        result: text,
        sql: `-- 更新结果单元格：${column}`,
      });
      showError("结果更新失败", text);
      void refreshExecutionHistory();
      return false;
    }
  }, [appendExecutionMessage, executionProfile, recordExecution, refreshExecutionHistory, result]);

  async function saveAndConnect(profile: ConnectionProfile) {
    setConnectingId(profile.id);
    try {
      const duration = await connect(profile);
      const connectedProfile = { ...profile, connected: true };
      const exists = profiles.some((item) => item.id === profile.id);
      const next = exists ? profiles.map((item) => item.id === profile.id ? connectedProfile : item) : [...profiles, connectedProfile];
      await saveProfiles(next);
      setProfiles(next);
      setActiveId(profile.id);
      setQueryContext({ connectionId: profile.id, database: profile.database });
      setModalOpen(false);
      setEditingProfile(undefined);
      message.success(`已连接 ${profile.name} · ${duration} ms`);
    } finally {
      setConnectingId("");
    }
  }

  async function connectProfile(profile: ConnectionProfile) {
    setConnectingId(profile.id);
    try {
      const duration = await connect(profile);
      setProfiles((items) => items.map((item) => item.id === profile.id ? { ...item, connected: true } : item));
      message.success(`连接成功 · ${duration} ms`);
      return true;
    } catch (connectError) {
      showError(`连接 ${profile.name} 失败`, connectError);
      return false;
    } finally {
      setConnectingId("");
    }
  }

  async function refreshConnection(profile: ConnectionProfile) {
    if (!profile.connected) {
      message.warning("请先连接数据库。");
      return;
    }
    try {
      await loadConnectionOverview(profile);
      message.success(`${profile.name} 已刷新`);
    } catch (refreshError) {
      showError(`刷新 ${profile.name} 失败`, refreshError);
    }
  }

  function openNewConnection(kind: DatabaseKind = "postgres") {
    setEditingProfile(undefined);
    setNewConnectionKind(kind);
    setModalOpen(true);
  }

  async function formatCurrentSql() {
    if (!queryProfile) return;
    try {
      setSql(await formatSql(sql, queryProfile.kind));
    } catch (formatError) {
      showError("SQL 格式化失败", formatError);
    }
  }

  function openQuery(initialSql = "-- 新查询\n\n", label?: string) {
    setNewQueryRequest((current) => ({ id: current.id + 1, sql: initialSql, label }));
  }

  function selectQueryContext(profile: ConnectionProfile, database = profile.database) {
    setQueryContext({ connectionId: profile.id, database });
  }

  function quoteIdentifier(kind: DatabaseKind, identifier: string) {
    if (kind === "mysql") return `\`${identifier.replaceAll("`", "``")}\``;
    if (kind === "sqlserver") return `[${identifier.replaceAll("]", "]]")}]`;
    return `"${identifier.replaceAll('"', '""')}"`;
  }

  function qualifiedTable(profile: ConnectionProfile, target: TableMenuTarget) {
    const table = quoteIdentifier(profile.kind, target.tableName);
    return target.schemaName ? `${quoteIdentifier(profile.kind, target.schemaName)}.${table}` : table;
  }

  async function handleConnectionMenu(action: ConnectionMenuAction, profile: ConnectionProfile) {
    setActiveId(profile.id);
    if (action === "new-query") {
      selectQueryContext(profile);
      openQuery();
      return;
    }
    if (action.startsWith("new-")) {
      openNewConnection(action.slice(4) as DatabaseKind);
      return;
    }
    if (action === "open") {
      if (profile.connected) void refreshConnection(profile);
      else void connectProfile(profile);
      return;
    }
    if (action === "edit") {
      setEditingProfile(profile);
      setModalOpen(true);
      return;
    }
    if (action === "delete") {
      Modal.confirm({
        title: "删除连接",
        children: `确定删除“${profile.name}”吗？数据库本身不会被删除。`,
        okText: "删除",
        okButtonProps: { danger: true },
        onOk: async () => {
          await disconnect(profile.id);
          const remaining = profiles.filter((item) => item.id !== profile.id);
          await saveProfiles(remaining);
          setProfiles(remaining);
          setSchemas((current) => {
            const next = { ...current };
            delete next[profile.id];
            return next;
          });
          setDatabaseUsers((current) => {
            const next = { ...current };
            delete next[profile.id];
            return next;
          });
          if (activeId === profile.id) setActiveId(remaining[0]?.id ?? "");
          if (queryContext.connectionId === profile.id) {
            const nextQueryProfile = remaining[0];
            setQueryContext({
              connectionId: nextQueryProfile?.id ?? "",
              database: nextQueryProfile?.database ?? "",
            });
          }
          message.success("连接已删除");
        },
      });
      return;
    }
    if (action === "duplicate") {
      const duplicate: ConnectionProfile = {
        ...profile,
        id: `connection-${Date.now()}`,
        name: `${profile.name} 副本`,
        password: "",
        rememberPassword: false,
        connected: false,
      };
      const next = [...profiles, duplicate];
      await saveProfiles(next);
      setProfiles(next);
      setActiveId(duplicate.id);
      message.success("连接已复制");
      return;
    }
    if (action === "command-line") {
      message.info("命令行界面将在后续版本接入。");
      return;
    }
    if (action === "refresh") void refreshConnection(profile);
  }

  function handleDatabaseMenu(action: DatabaseMenuAction, profileId: string, databaseName: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    setActiveId(profileId);
    const databaseIdentifier = quoteIdentifier(profile.kind, databaseName);

    if (action === "database-open") {
      void loadDatabaseObjects(profileId, databaseName);
      return;
    }
    if (action === "database-edit") {
      message.info(`数据库“${databaseName}”的属性编辑界面正在接入。`);
      return;
    }
    if (action === "database-create") {
      selectQueryContext(profile, databaseName);
      openQuery(`CREATE DATABASE ${quoteIdentifier(profile.kind, "new_database")};\n`, "新建数据库");
      return;
    }
    if (action === "database-delete") {
      selectQueryContext(profile, databaseName);
      openQuery(`DROP DATABASE ${databaseIdentifier};\n`, `删除 ${databaseName}`);
      message.warning("已生成删除数据库语句，请检查后手动运行。");
      return;
    }
    if (action === "database-new-query") {
      selectQueryContext(profile, databaseName);
      openQuery(`-- ${databaseName}\n\n`, databaseName);
      return;
    }
    if (action === "database-refresh") {
      const cachePrefix = `${profileId}:${databaseName}:`.toLowerCase();
      [...completionColumnLoadingRef.current.keys()]
        .filter((key) => key.startsWith(cachePrefix))
        .forEach((key) => completionColumnLoadingRef.current.delete(key));
      void loadDatabaseObjects(profileId, databaseName, true);
    }
  }

  async function saveDatabaseUser(input: DatabaseUserInput, safety: SqlSafetyOptions = {}): Promise<void> {
    if (!databaseUserEditor) return;
    const profile = profiles.find((item) => item.id === databaseUserEditor.profileId);
    if (!profile?.connected) throw new Error("当前数据库连接已断开，请重新连接后再操作用户。");
    try {
      const execution = databaseUserEditor.mode === "create"
        ? await createDatabaseUser(profile, input)
        : await updateDatabaseUser(profile, input, safety);
      recordExecution(execution);
      setDatabaseUserEditor(undefined);
      await loadUsers(profile.id, true);
      void refreshExecutionHistory();
      message.success(databaseUserEditor.mode === "create" ? "用户已创建" : "用户已更新");
    } catch (userError) {
      if (userError instanceof SqlConfirmationRequiredError) {
        recordExecution(userError.execution);
        await new Promise<void>((resolve) => {
          Modal.confirm({
            type: "warning",
            title: userError.confirmation.title,
            children: userError.confirmation.message,
            okText: "无备份执行",
            cancelText: "取消",
            okButtonProps: { danger: true },
            onCancel: () => resolve(),
            onOk: async () => {
              await saveDatabaseUser(input, { ...safety, allowWithoutBackup: true });
              resolve();
            },
          });
        });
        return;
      }
      throw userError;
    }
  }

  async function removeDatabaseUser(
    profile: ConnectionProfile,
    user: DatabaseUser,
    safety: SqlSafetyOptions = {},
  ) {
    try {
      const execution = await deleteDatabaseUser(profile, user, safety);
      recordExecution(execution);
      await loadUsers(profile.id, true);
      void refreshExecutionHistory();
      message.success(`用户 ${user.name}${user.host ? `@${user.host}` : ""} 已删除`);
    } catch (userError) {
      if (userError instanceof SqlConfirmationRequiredError) {
        recordExecution(userError.execution);
        Modal.confirm({
          type: "warning",
          title: userError.confirmation.title,
          children: userError.confirmation.message,
          okText: "无备份删除",
          cancelText: "取消删除",
          okButtonProps: { danger: true },
          onOk: () => removeDatabaseUser(profile, user, { ...safety, allowWithoutBackup: true }),
        });
        return;
      }
      showError("删除用户失败", userError);
      void refreshExecutionHistory();
    }
  }

  function handleUserMenu(action: UserMenuAction, target: UserMenuTarget) {
    const profile = profiles.find((item) => item.id === target.profileId);
    if (!profile) return;
    setActiveId(profile.id);
    if (action === "user-new") {
      setDatabaseUserEditor({ profileId: profile.id, mode: "create" });
      return;
    }
    if (action === "user-edit" && target.user) {
      setDatabaseUserEditor({ profileId: profile.id, mode: "edit", user: target.user });
      return;
    }
    if (action === "user-delete" && target.user) {
      const displayName = `${target.user.name}${target.user.host ? `@${target.user.host}` : ""}`;
      Modal.confirm({
        type: "warning",
        title: "删除数据库用户",
        children: `确定删除用户“${displayName}”吗？删除前会自动备份可读取的用户元数据，删除当前登录用户可能导致连接失效。`,
        okText: "删除",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: () => removeDatabaseUser(profile, target.user!),
      });
    }
  }

  function handleTableMenu(action: TableMenuAction, target: TableMenuTarget) {
    const profile = profiles.find((item) => item.id === target.profileId);
    if (!profile) return;
    setActiveId(profile.id);
    if ([
      "table-open",
      "table-design",
      "table-create",
      "table-delete",
      "table-clear",
      "table-truncate",
      "table-copy-structure",
      "table-copy-data",
    ].includes(action)) {
      selectQueryContext(profile, target.databaseName);
    }
    const table = qualifiedTable(profile, target);
    const tableLabel = target.schemaName ? `${target.schemaName}.${target.tableName}` : target.tableName;

    if (action === "table-open") {
      const statement = profile.kind === "sqlserver"
        ? `SELECT TOP (1000) *\nFROM ${table};\n`
        : `SELECT *\nFROM ${table}\nLIMIT 1000;\n`;
      openQuery(statement, tableLabel);
      return;
    }
    if (action === "table-design") {
      const statement = profile.kind === "mysql"
        ? `SHOW CREATE TABLE ${table};\n`
        : profile.kind === "sqlserver"
          ? `EXEC sp_help N'${tableLabel.replaceAll("'", "''")}';\n`
          : `SELECT *\nFROM information_schema.columns\nWHERE table_name = '${target.tableName.replaceAll("'", "''")}'\nORDER BY ordinal_position;\n`;
      openQuery(statement, `设计 ${target.tableName}`);
      return;
    }
    if (action === "table-create") {
      openQuery(`CREATE TABLE ${quoteIdentifier(profile.kind, "new_table")} (\n    id INTEGER NOT NULL\n);\n`, "新建表");
      return;
    }
    if (action === "table-delete") {
      openQuery(`DROP TABLE ${table};\n`, `删除 ${target.tableName}`);
      message.warning("已生成删除表语句，请检查后手动运行。");
      return;
    }
    if (action === "table-clear") {
      openQuery(`DELETE FROM ${table};\n`, `清空 ${target.tableName}`);
      message.warning("该语句没有 WHERE 条件，运行时会再次要求确认。");
      return;
    }
    if (action === "table-truncate") {
      openQuery(`TRUNCATE TABLE ${table};\n`, `截断 ${target.tableName}`);
      return;
    }
    if (action === "table-copy-structure" || action === "table-copy-data") {
      const newTable = quoteIdentifier(profile.kind, `${target.tableName}_copy`);
      const includeData = action === "table-copy-data";
      const statement = profile.kind === "sqlserver"
        ? `SELECT TOP (${includeData ? "100" : "0"}) * INTO ${newTable}\nFROM ${table};\n`
        : profile.kind === "postgres" && !includeData
          ? `CREATE TABLE ${newTable} (LIKE ${table} INCLUDING ALL);\n`
          : `CREATE TABLE ${newTable} AS\nSELECT * FROM ${table}${includeData ? "" : "\nWHERE 1 = 0"};\n`;
      openQuery(statement, `复制 ${target.tableName}`);
      return;
    }
    if (action === "table-copy-name") {
      void navigator.clipboard.writeText(tableLabel).then(
        () => message.success("表名已复制"),
        (copyError) => showError("复制表名失败", copyError),
      );
      return;
    }
    if (action === "table-refresh") {
      completionColumnLoadingRef.current.delete(
        `${target.profileId}:${target.databaseName}:${target.schemaName ?? ""}:${target.tableName}`.toLowerCase(),
      );
      void loadDatabaseObjectFields(
        target.profileId,
        target.databaseName,
        target.tableName,
        target.schemaName,
        true,
      );
      return;
    }
    if (action === "table-info") {
      message.info(`表：${tableLabel} · 数据库：${target.databaseName} · 连接：${profile.name}`);
      return;
    }

    const labels: Partial<Record<TableMenuAction, string>> = {
      "table-permissions": "设置权限",
      "table-import": "导入向导",
      "table-export": "导出向导",
      "table-dump-structure": "转储表结构",
      "table-dump-data": "转储表结构和数据",
      "table-print": "打印表",
      "table-reverse-model": "逆向表到模型",
      "table-group-add": "添加到组",
      "table-group-create": "新建组",
      "table-rename": "重命名表",
      "table-create-shortcut": "创建快捷方式",
    };
    message.info(`${labels[action] ?? "该功能"}正在接入。`);
  }

  function runWindowAction(action: WindowAction) {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!isDesktopRuntime || !invoke) {
      message.info("窗口控制仅在桌面应用中可用。");
      return;
    }
    if (action === "toggle-maximize") setWindowMaximized((value) => !value);
    void invoke("data_studio_window_action", { action }).catch((windowError) => {
      if (action === "toggle-maximize") setWindowMaximized((value) => !value);
      message.error(errorText(windowError));
    });
  }

  function changeWindowTheme(dark: boolean) {
    const nextTheme = dark ? "dark" : "light";
    setWindowTheme(nextTheme);
    applySiaTheme(nextTheme);
  }

  if (!activeProfile || !queryProfile) return null;

  const connectionOptions = profiles.map((profile) => ({ label: profile.name, value: profile.id }));

  return (
    <WindowFrame
      className="data-studio-shell"
      onContextMenu={(event) => event.preventDefault()}
      titleBar={(
        <WindowTitleBar
          // 已有主题入口会同步宿主窗口，关闭重复的默认入口。
          showThemeSwitch={false}
          className="data-studio-titlebar"
          leading={(
            <div className="studio-brand" aria-label="Sia Database">
              <span className="studio-brand__mark" aria-hidden="true">
                <strong>Sia</strong>
                <small>database</small>
              </span>
            </div>
          )}
          aria-label="Sia Data Studio"
          actions={(
            <ThemeSwitch
              checked={windowTheme === "dark"}
              onCheckedChange={changeWindowTheme}
              lightLabel="切换到暗色主题"
              darkLabel="切换到亮色主题"
            />
          )}
          maximized={windowMaximized}
          onWindowAction={runWindowAction}
        >
          <span className="studio-window-title">Sia Data Studio</span>
        </WindowTitleBar>
      )}
    >
      <div className="studio-body">
        <div className="studio-tool-layout">
          <ToolPanel
            placement="left"
            title="连接与对象"
            icon={<Icon name="database" size={16} />}
            open={toolPanels.leftOpen}
            defaultSize={toolPanels.leftSize}
            minSize={240}
            maxSize={520}
            onOpenChange={(leftOpen) => updateToolPanels({ leftOpen })}
            onResizeEnd={(leftSize) => updateToolPanels({ leftSize })}
          >
            <ConnectionRail
              profiles={profiles}
              schemas={schemas}
              users={databaseUsers}
              activeId={activeProfile.id}
              loadingId={schemaLoadingId}
              databaseLoadingKeys={databaseObjectLoadingKeys}
              connectingId={connectingId}
              onSelect={setActiveId}
              onNew={() => openNewConnection()}
              onRefresh={() => void refreshSchema()}
              onConnect={connectProfile}
              onLoadConnection={loadConnectionNode}
              onLoadDatabases={loadDatabaseList}
              onLoadDatabase={loadDatabaseObjects}
              onLoadDatabaseCategory={loadDatabaseCategoryObjects}
              onLoadDatabaseObject={loadDatabaseObjectFields}
              onLoadUsers={loadUsers}
              onMenuAction={handleConnectionMenu}
              onDatabaseMenuAction={handleDatabaseMenu}
              onTableMenuAction={handleTableMenu}
              onUserMenuAction={handleUserMenu}
            />
          </ToolPanel>
          <div className="studio-tool-layout__main">
            <QueryWorkspace
              sql={sql}
              result={result}
              executionMessages={executionMessages}
              running={running}
              error={error}
              connectionOptions={connectionOptions}
              databaseOptions={databaseOptions}
              databaseSchema={activeDatabaseSchema}
              activeConnectionId={queryProfile.id}
              activeDatabase={activeDatabase}
              activeConnectionConnected={Boolean(queryProfile.connected)}
              activeConnectionConnecting={connectingId === queryProfile.id}
              databaseLoading={schemaLoadingId === queryProfile.id}
              activeDatabaseKind={queryProfile.kind}
              windowTheme={windowTheme}
              onConnectionChange={(connectionId) => {
                const profile = profiles.find((item) => item.id === connectionId);
                if (profile) selectQueryContext(profile);
              }}
              onDatabaseChange={(database) => setQueryContext((current) => ({ ...current, database }))}
              onSqlChange={setSql}
              onLoadTableColumns={loadCompletionColumns}
              onRun={(statementSql) => void runQuery(statementSql)}
              onFormat={formatCurrentSql}
              onCellUpdate={saveResultCell}
              newQueryRequest={newQueryRequest}
            />
          </div>
          <ToolPanel
            placement="right"
            title="数据库日志"
            icon={<Icon name="info" size={16} />}
            open={toolPanels.rightOpen}
            defaultSize={toolPanels.rightSize}
            minSize={280}
            maxSize={620}
            onOpenChange={(rightOpen) => updateToolPanels({ rightOpen })}
            onResizeEnd={(rightSize) => updateToolPanels({ rightSize })}
          >
            <Inspector
              profile={executionProfile ?? queryProfile}
              history={historyState.items}
              historyTotal={historyState.total}
              onLoadHistoryPage={loadHistoryPage}
            />
          </ToolPanel>
        </div>
      </div>

      <footer className="status-bar">
        <span>{queryProfile.kind === "postgres" ? "PostgreSQL" : queryProfile.kind === "mysql" ? "MySQL / MariaDB" : queryProfile.kind === "sqlserver" ? "SQL Server" : "SQLite"}</span>
        <span>UTF-8</span>
        <span className="status-autocommit"><i />自动提交</span>
        <span className="status-bar__spacer" />
        <span>{isDesktopRuntime ? "Tauri 数据库驱动" : "浏览器演示模式"}</span>
        <span>行 4, 列 18</span>
      </footer>

      <ConnectionModal open={modalOpen} initialProfile={editingProfile} defaultKind={newConnectionKind} onCancel={() => { setModalOpen(false); setEditingProfile(undefined); }} onSave={saveAndConnect} />
      <DatabaseUserModal
        open={Boolean(databaseUserEditor)}
        mode={databaseUserEditor?.mode ?? "create"}
        kind={profiles.find((profile) => profile.id === databaseUserEditor?.profileId)?.kind ?? activeProfile.kind}
        user={databaseUserEditor?.user}
        onCancel={() => setDatabaseUserEditor(undefined)}
        onSave={saveDatabaseUser}
      />
    </WindowFrame>
  );
}
