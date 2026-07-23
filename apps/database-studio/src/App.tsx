import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Icon,
  Modal,
  ToolPanel,
  applySiaTheme,
  message,
} from "@sia-ui/react";
import { ConnectionModal } from "./components/ConnectionModal";
import {
  ConnectionRail,
  type ConnectionMenuAction,
  type DatabaseMenuAction,
  type TableMenuAction,
  type TableMenuTarget,
} from "./components/ConnectionRail";
import { Inspector } from "./components/Inspector";
import { QueryWorkspace } from "./components/QueryWorkspace";
import { DEFAULT_SQL, DEMO_HISTORY, DEMO_RESULT } from "./data/demo";
import {
  SqlConfirmationRequiredError,
  connect,
  disconnect,
  executeSql,
  isDesktopRuntime,
  loadDatabaseSchema,
  loadExecutionHistory,
  loadSchema,
  updateResultCell,
} from "./services/databaseGateway";
import { loadPersistedProfiles, loadProfiles, saveProfiles } from "./services/profileRepository";
import { formatSql } from "./services/sqlFormatter";
import type { ConnectionProfile, DatabaseKind, ExecutionHistoryPage, QueryResult, SchemaSnapshot, SqlExecutionDetail, SqlSafetyOptions } from "./types";

const STUDIO_TOOL_PANELS_KEY = "sia-data-studio:tool-panels:v3";

interface StudioToolPanels {
  leftOpen: boolean;
  rightOpen: boolean;
  leftSize: number;
  rightSize: number;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function showError(title: string, error: unknown) {
  Modal.error({
    title,
    children: errorText(error),
    centered: true,
    width: 560,
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
  return { leftOpen: true, rightOpen: true, leftSize: 320, rightSize: 360 };
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
  const [schemaLoadingId, setSchemaLoadingId] = useState("");
  const [connectingId, setConnectingId] = useState("");
  const [selectedDatabases, setSelectedDatabases] = useState<Record<string, string>>(() =>
    Object.fromEntries(profiles.map((profile) => [profile.id, profile.database])));
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [result, setResult] = useState<QueryResult>(DEMO_RESULT);
  const [historyState, setHistoryState] = useState<ExecutionHistoryPage>({ items: DEMO_HISTORY, total: DEMO_HISTORY.length });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [newQueryRequest, setNewQueryRequest] = useState<{ id: number; sql?: string; label?: string }>({ id: 0 });
  const [toolPanels, setToolPanels] = useState(loadStudioToolPanels);

  const updateToolPanels = useCallback((patch: Partial<StudioToolPanels>) => {
    setToolPanels((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(STUDIO_TOOL_PANELS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeId) ?? profiles[0], [activeId, profiles]);
  const activeDatabase = useMemo(() => {
    if (!activeProfile) return "";
    const selected = selectedDatabases[activeProfile.id] || activeProfile.database;
    const databases = schemas[activeProfile.id]?.databases;
    return databases?.some((database) => database.name === selected) ? selected : activeProfile.database;
  }, [activeProfile, schemas, selectedDatabases]);
  const executionProfile = useMemo(
    () => activeProfile ? { ...activeProfile, database: activeDatabase } : undefined,
    [activeDatabase, activeProfile],
  );
  const databaseOptions = useMemo(() => {
    if (!activeProfile) return [];
    const names = [...new Set([
      activeDatabase || activeProfile.database,
      ...(schemas[activeProfile.id]?.databases.map((database) => database.name) ?? []),
    ])].filter(Boolean);
    return names.map((database) => ({ label: database, value: database }));
  }, [activeDatabase, activeProfile, schemas]);

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

  useEffect(() => {
    let cancelled = false;
    void loadPersistedProfiles().then((persisted) => {
      if (cancelled) return;
      setProfiles(persisted.map((profile) => ({
        ...profile,
        connected: isDesktopRuntime ? false : profile.connected,
      })));
      setSelectedDatabases((current) => ({
        ...Object.fromEntries(persisted.map((profile) => [profile.id, profile.database])),
        ...current,
      }));
      setActiveId((current) => persisted.some((profile) => profile.id === current) ? current : persisted[0]?.id ?? "");
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
    if (!activeProfile) return { items: [], total: 0 };
    const loaded = await loadExecutionHistory(activeProfile, pageSize, (page - 1) * pageSize);
    return {
      ...loaded,
      items: loaded.items.map((item) => ({ ...item, connectionName: activeProfile.name })),
    };
  }, [activeProfile]);

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

  const refreshSchema = useCallback(async () => {
    if (!activeProfile?.connected) return;
    setSchemaLoadingId(activeProfile.id);
    try {
      const nextSchema = await loadSchema(activeProfile);
      setSchemas((current) => ({ ...current, [activeProfile.id]: nextSchema }));
    } catch (schemaError) {
      showError("数据库对象加载失败", schemaError);
    } finally {
      setSchemaLoadingId("");
    }
  }, [activeProfile]);

  const loadDatabaseObjects = useCallback(async (profileId: string, databaseName: string, force = false) => {
    const profile = profiles.find((item) => item.id === profileId);
    const database = schemas[profileId]?.databases.find((item) => item.name === databaseName);
    if (!profile?.connected || (!force && database?.loaded)) return;
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
    }
  }, [profiles, schemas]);

  useEffect(() => {
    if (activeProfile?.connected) void refreshSchema();
  }, [activeProfile?.id, activeProfile?.connected, refreshSchema]);

  const runQuery = useCallback(async (statementSql = sql, safety: SqlSafetyOptions = {}) => {
    if (!executionProfile) return;
    if (!executionProfile.connected) {
      const messageText = "请先连接数据库。浏览器预览可直接使用演示连接。";
      setError(messageText);
      showError("SQL 执行失败", messageText);
      return;
    }
    if (!statementSql.trim()) {
      const messageText = "请输入要执行的 SQL。";
      setError(messageText);
      showError("SQL 执行失败", messageText);
      return;
    }
    setRunning(true);
    setError("");
    try {
      const nextResult = await executeSql(executionProfile, statementSql, safety);
      setResult(nextResult);
      recordExecution(nextResult.execution);
    } catch (queryError) {
      if (queryError instanceof SqlConfirmationRequiredError) {
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
      const text = queryError instanceof Error ? queryError.message : String(queryError);
      setError(text);
      showError("SQL 执行失败", text);
      void refreshExecutionHistory();
    } finally {
      setRunning(false);
    }
  }, [executionProfile, recordExecution, refreshExecutionHistory, sql]);

  const saveResultCell = useCallback(async (
    column: string,
    rowIndex: number,
    value: unknown,
    safety: SqlSafetyOptions = {},
  ): Promise<boolean> => {
    if (!executionProfile) return false;
    if (!executionProfile.connected) {
      showError("结果更新失败", "当前数据库连接已断开，请重新连接后再修改结果。");
      return false;
    }
    try {
      const updated = await updateResultCell(executionProfile, result, column, rowIndex, value, safety);
      setResult((current) => ({
        ...current,
        rows: updated.rows,
        execution: updated.execution,
        durationMs: updated.execution?.durationMs ?? current.durationMs,
        executedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        message: updated.execution?.backupSkipped
          ? "UPDATE 执行成功；用户已确认无备份执行。"
          : `UPDATE 执行成功；已备份 ${updated.execution?.backupRowCount ?? 0} 行。`,
      }));
      recordExecution(updated.execution);
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
      showError("结果更新失败", updateError);
      void refreshExecutionHistory();
      return false;
    }
  }, [executionProfile, recordExecution, refreshExecutionHistory, result]);

  async function saveAndConnect(profile: ConnectionProfile) {
    setConnectingId(profile.id);
    try {
      const duration = await connect(profile);
      const connectedProfile = { ...profile, connected: true };
      const exists = profiles.some((item) => item.id === profile.id);
      const next = exists ? profiles.map((item) => item.id === profile.id ? connectedProfile : item) : [...profiles, connectedProfile];
      await saveProfiles(next);
      setProfiles(next);
      setSelectedDatabases((current) => ({ ...current, [profile.id]: profile.database }));
      setActiveId(profile.id);
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
    setSchemaLoadingId(profile.id);
    try {
      const nextSchema = await loadSchema(profile);
      setSchemas((current) => ({ ...current, [profile.id]: nextSchema }));
      message.success(`${profile.name} 已刷新`);
    } catch (refreshError) {
      showError(`刷新 ${profile.name} 失败`, refreshError);
    } finally {
      setSchemaLoadingId("");
    }
  }

  function openNewConnection(kind: DatabaseKind = "postgres") {
    setEditingProfile(undefined);
    setNewConnectionKind(kind);
    setModalOpen(true);
  }

  async function formatCurrentSql() {
    try {
      setSql(await formatSql(sql, activeProfile.kind));
    } catch (formatError) {
      showError("SQL 格式化失败", formatError);
    }
  }

  function openQuery(initialSql = "-- 新查询\n\n", label?: string) {
    setNewQueryRequest((current) => ({ id: current.id + 1, sql: initialSql, label }));
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
          setSelectedDatabases((current) => {
            const next = { ...current };
            delete next[profile.id];
            return next;
          });
          if (activeId === profile.id) setActiveId(remaining[0]?.id ?? "");
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
      setSelectedDatabases((current) => ({ ...current, [duplicate.id]: duplicate.database }));
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
    setSelectedDatabases((current) => ({ ...current, [profileId]: databaseName }));
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
      openQuery(`CREATE DATABASE ${quoteIdentifier(profile.kind, "new_database")};\n`, "新建数据库");
      return;
    }
    if (action === "database-delete") {
      openQuery(`DROP DATABASE ${databaseIdentifier};\n`, `删除 ${databaseName}`);
      message.warning("已生成删除数据库语句，请检查后手动运行。");
      return;
    }
    if (action === "database-new-query") {
      openQuery(`-- ${databaseName}\n\n`, databaseName);
      return;
    }
    if (action === "database-refresh") void loadDatabaseObjects(profileId, databaseName, true);
  }

  function handleTableMenu(action: TableMenuAction, target: TableMenuTarget) {
    const profile = profiles.find((item) => item.id === target.profileId);
    if (!profile) return;
    setActiveId(profile.id);
    setSelectedDatabases((current) => ({ ...current, [profile.id]: target.databaseName }));
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
      void loadDatabaseObjects(target.profileId, target.databaseName, true);
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

  if (!activeProfile) return null;

  const connectionOptions = profiles.map((profile) => ({ label: profile.name, value: profile.id }));

  return (
    <div className="data-studio-shell" onContextMenu={(event) => event.preventDefault()}>
      <header className="app-bar">
        <div className="studio-brand"><Icon name="database" size={24} /><strong>Sia Data Studio</strong></div>
      </header>

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
              activeId={activeProfile.id}
              loadingId={schemaLoadingId}
              connectingId={connectingId}
              onSelect={setActiveId}
              onNew={() => openNewConnection()}
              onRefresh={() => void refreshSchema()}
              onConnect={connectProfile}
              onLoadDatabase={loadDatabaseObjects}
              onMenuAction={handleConnectionMenu}
              onDatabaseMenuAction={handleDatabaseMenu}
              onTableMenuAction={handleTableMenu}
            />
          </ToolPanel>
          <div className="studio-tool-layout__main">
            <QueryWorkspace
              sql={sql}
              result={result}
              running={running}
              error={error}
              connectionOptions={connectionOptions}
              databaseOptions={databaseOptions}
              activeConnectionId={activeProfile.id}
              activeDatabase={activeDatabase}
              activeConnectionConnected={Boolean(activeProfile.connected)}
              databaseLoading={schemaLoadingId === activeProfile.id}
              activeDatabaseKind={activeProfile.kind}
              windowTheme={windowTheme}
              onConnectionChange={setActiveId}
              onDatabaseChange={(database) => setSelectedDatabases((current) => ({ ...current, [activeProfile.id]: database }))}
              onSqlChange={setSql}
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
              profile={executionProfile ?? activeProfile}
              history={historyState.items}
              historyTotal={historyState.total}
              onLoadHistoryPage={loadHistoryPage}
            />
          </ToolPanel>
        </div>
      </div>

      <footer className="status-bar">
        <span>{activeProfile.kind === "postgres" ? "PostgreSQL" : activeProfile.kind === "mysql" ? "MySQL / MariaDB" : activeProfile.kind === "sqlserver" ? "SQL Server" : "SQLite"}</span>
        <span>UTF-8</span>
        <span className="status-autocommit"><i />自动提交</span>
        <span className="status-bar__spacer" />
        <span>{isDesktopRuntime ? "Tauri 数据库驱动" : "浏览器演示模式"}</span>
        <span>行 4, 列 18</span>
      </footer>

      <ConnectionModal open={modalOpen} initialProfile={editingProfile} defaultKind={newConnectionKind} onCancel={() => { setModalOpen(false); setEditingProfile(undefined); }} onSave={saveAndConnect} />
    </div>
  );
}
