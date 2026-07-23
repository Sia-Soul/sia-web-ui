import type {
  ConnectionProfile,
  DatabaseSchema,
  ExecutionHistoryPage,
  QueryEditMetadata,
  QueryResult,
  SchemaSnapshot,
  SqlConfirmation,
  SqlExecutionDetail,
  SqlSafetyOptions,
} from "../types";
import { DEMO_HISTORY, DEMO_RESULT, DEMO_SCHEMA } from "../data/demo";
import { defaultDatabase } from "./connectionDefaults";

type HostQueryResult = {
  rows: Record<string, unknown>[];
  affectedRows?: number | null;
  editable?: QueryEditMetadata;
  audit?: SqlExecutionDetail;
  confirmation?: SqlConfirmation;
};

type DatabaseHostRequest = {
  operation: "test" | "query" | "update-cell" | "audit-list";
  profile: Pick<ConnectionProfile, "id" | "name" | "kind" | "host" | "port" | "database" | "username" | "password" | "sslMode">;
  sql?: string;
  parameters?: Record<string, unknown>;
  table?: string;
  column?: string;
  value?: unknown;
  primaryKeyValues?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  confirmWithoutWhere?: boolean;
  allowWithoutBackup?: boolean;
};

export const isDesktopRuntime = Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);

export class SqlConfirmationRequiredError extends Error {
  constructor(
    readonly confirmation: SqlConfirmation,
    readonly execution?: SqlExecutionDetail,
  ) {
    super(confirmation.message);
    this.name = "SqlConfirmationRequiredError";
  }
}

async function requestDatabaseHost<T>(request: DatabaseHostRequest): Promise<T> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error("FreeSql 数据库服务尚未就绪，请通过 pnpm database:dev 启动桌面应用。");
  return invoke<T>("database_request", { request });
}

function hostProfile(profile: ConnectionProfile): DatabaseHostRequest["profile"] {
  return {
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    host: profile.host,
    port: profile.port,
    database: profile.database,
    username: profile.username,
    password: profile.password,
    sslMode: profile.sslMode,
  };
}

export async function testConnection(profile: ConnectionProfile) {
  const startedAt = performance.now();
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    return Math.max(1, Math.round(performance.now() - startedAt));
  }
  await requestDatabaseHost({ operation: "test", profile: hostProfile(profile) });
  return Math.max(1, Math.round(performance.now() - startedAt));
}

export async function connect(profile: ConnectionProfile) {
  return testConnection(profile);
}

export async function disconnect(_profileId: string) {
  // FreeSql sidecar 按请求创建并释放连接池，不在 Tauri 进程内保留密码或数据库会话。
}

function isReadStatement(sql: string) {
  const normalized = sql.trim();
  if (/^with\b/i.test(normalized) && /\b(update|delete|insert|merge)\b/i.test(normalized)) return false;
  return /^(select|with|show|describe|desc|explain|pragma)\b/i.test(normalized);
}

async function queryRows(profile: ConnectionProfile, sql: string) {
  const result = await requestDatabaseHost<HostQueryResult>({
    operation: "query",
    profile: hostProfile(profile),
    sql,
  });
  return result.rows;
}

function demoAudit(
  profile: ConnectionProfile,
  operation: string,
  sql: string,
  options: Partial<SqlExecutionDetail> = {},
): SqlExecutionDetail {
  const startedAt = new Date().toISOString();
  return {
    id: `demo-audit-${Date.now()}`,
    operation,
    connectionId: profile.id,
    connectionName: profile.name,
    databaseKind: profile.kind,
    host: profile.host,
    port: profile.port,
    database: profile.database,
    username: profile.username,
    sql,
    highRisk: false,
    startedAt,
    finishedAt: startedAt,
    durationMs: 1,
    success: true,
    ...options,
  };
}

function highRiskOperation(sql: string) {
  const normalized = sql.trim();
  if (/^update\b/i.test(normalized)) return "Update";
  if (/^delete\b/i.test(normalized)) return "Delete";
  if (/^truncate\b/i.test(normalized)) return "Truncate";
  if (/^drop\s+table\b/i.test(normalized)) return "DropTable";
  if (/^alter\s+table\b/i.test(normalized)) return "AlterTable";
  if (/^merge\b/i.test(normalized)) return "Merge";
  return "";
}

function assertNoConfirmation(result: HostQueryResult) {
  if (result.confirmation) throw new SqlConfirmationRequiredError(result.confirmation, result.audit);
}

export async function executeSql(
  profile: ConnectionProfile,
  sql: string,
  safety: SqlSafetyOptions = {},
): Promise<QueryResult> {
  const startedAt = performance.now();
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    const highRisk = highRiskOperation(sql);
    if ((highRisk === "Update" || highRisk === "Delete") && !/\bwhere\b/i.test(sql) && !safety.confirmWithoutWhere) {
      throw new SqlConfirmationRequiredError({
        type: "missing-where",
        title: "高危 SQL 缺少 WHERE 条件",
        message: `${highRisk} 语句没有检测到 WHERE 条件，可能影响整张表。是否确认继续执行？`,
      });
    }
    const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
    const execution = demoAudit(profile, isReadStatement(sql) ? "Select" : highRisk || "Execute", sql, {
      durationMs,
      returnedRows: isReadStatement(sql) ? DEMO_RESULT.rows.length : undefined,
      affectedRows: isReadStatement(sql) ? undefined : 1,
      highRisk: Boolean(highRisk),
      confirmedWithoutWhere: safety.confirmWithoutWhere,
      backupPath: highRisk ? "browser-demo://backups/users.json" : undefined,
      backupRowCount: highRisk ? 1 : undefined,
      backupTable: highRisk ? "users" : undefined,
    });
    if (!isReadStatement(sql)) {
      return {
        rows: [],
        affectedRows: 1,
        durationMs,
        executedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        message: "执行成功，影响 1 行；执行前备份已完成。",
        execution,
      };
    }
    return {
      ...DEMO_RESULT,
      editable: { table: "users", primaryKeys: ["id"], columns: ["id", "email", "created_at", "status"] },
      durationMs,
      executedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      execution,
    };
  }

  const result = await requestDatabaseHost<HostQueryResult>({
    operation: "query",
    profile: hostProfile(profile),
    sql,
    ...safety,
  });
  assertNoConfirmation(result);
  const durationMs = result.audit?.durationMs ?? Math.max(1, Math.round(performance.now() - startedAt));
  const executedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  if (result.audit?.operation === "Select" || result.audit?.operation === "Metadata" || isReadStatement(sql)) {
    return {
      rows: result.rows,
      durationMs,
      executedAt,
      message: `查询成功，返回 ${result.rows.length} 行。`,
      editable: result.editable,
      execution: result.audit,
    };
  }

  const affectedRows = result.affectedRows ?? 0;
  return {
    rows: [],
    affectedRows,
    durationMs,
    executedAt,
    message: result.audit?.backupPath
      ? `执行成功，影响 ${affectedRows} 行；已自动备份 ${result.audit.backupRowCount ?? 0} 行。`
      : result.audit?.backupSkipped
        ? `执行成功，影响 ${affectedRows} 行；用户已确认无备份执行。`
        : `执行成功，影响 ${affectedRows} 行。`,
    execution: result.audit,
  };
}

export async function updateResultCell(
  profile: ConnectionProfile,
  result: QueryResult,
  column: string,
  rowIndex: number,
  value: unknown,
  safety: SqlSafetyOptions = {},
) {
  const editable = result.editable;
  const row = result.rows[rowIndex];
  if (!editable || !row) throw new Error("当前结果无法安全定位到数据库表。");
  if (editable.primaryKeys.some((key) => key.toLowerCase() === column.toLowerCase()))
    throw new Error("主键列不允许修改。");
  if (!editable.columns.some((key) => key.toLowerCase() === column.toLowerCase()))
    throw new Error(`列 ${column} 不是来源表中的可更新列。`);
  const primaryKeyValues = Object.fromEntries(editable.primaryKeys.map((key) => [key, row[key]]));
  if (editable.primaryKeys.some((key) => primaryKeyValues[key] === undefined))
    throw new Error("结果行缺少主键值，无法安全更新。");

  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    const nextRows = result.rows.map((item, index) => index === rowIndex ? { ...item, [column]: value } : item);
    const sql = `UPDATE ${editable.table} SET ${column} = @value WHERE ${editable.primaryKeys.map((key, index) => `${key} = @pk${index}`).join(" AND ")}`;
    const execution = demoAudit(profile, "CellUpdate", sql, {
      parameters: { value, ...primaryKeyValues },
      highRisk: true,
      affectedRows: 1,
      backupPath: safety.allowWithoutBackup ? undefined : "browser-demo://backups/users-row.json",
      backupRowCount: safety.allowWithoutBackup ? undefined : 1,
      backupTable: editable.table,
      backupSkipped: safety.allowWithoutBackup,
    });
    return { rows: nextRows, execution };
  }

  const hostResult = await requestDatabaseHost<HostQueryResult>({
    operation: "update-cell",
    profile: hostProfile(profile),
    table: editable.table,
    column,
    value,
    primaryKeyValues,
    ...safety,
  });
  assertNoConfirmation(hostResult);
  return {
    rows: result.rows.map((item, index) => index === rowIndex ? { ...item, [column]: value } : item),
    execution: hostResult.audit,
  };
}

export async function loadExecutionHistory(profile: ConnectionProfile, limit = 20, offset = 0): Promise<ExecutionHistoryPage> {
  if (!isDesktopRuntime) {
    const items = DEMO_HISTORY.filter((item) => item.connectionId === profile.id);
    return { items: items.slice(offset, offset + limit), total: items.length };
  }
  return requestDatabaseHost<ExecutionHistoryPage>({
    operation: "audit-list",
    profile: hostProfile(profile),
    limit,
    offset,
  });
}

type DatabaseRow = { database_name: string };
type ObjectRow = { schema_name?: string; table_name: string; object_type?: string };
type ColumnRow = { schema_name?: string; table_name: string; column_name: string };

function objectIdentity(item: { schema_name?: string; table_name: string }) {
  return `${item.schema_name ?? ""}.${item.table_name}`;
}

function buildDatabaseSchema(databaseName: string, objects: ObjectRow[], columns: ColumnRow[]): DatabaseSchema {
  const columnMap = new Map<string, ColumnRow[]>();
  columns.forEach((column) => {
    const key = objectIdentity(column);
    columnMap.set(key, [...(columnMap.get(key) ?? []), column]);
  });
  const typeOf = (item: ObjectRow) => String(item.object_type).toLowerCase();
  const functions = objects.filter((item) => typeOf(item).includes("function"));
  const procedures = objects.filter((item) => typeOf(item).includes("procedure"));
  const views = objects.filter((item) => typeOf(item).includes("view"));
  const tables = objects.filter((item) => !functions.includes(item) && !procedures.includes(item) && !views.includes(item));
  const children = (items: ObjectRow[], prefix: string, nodeType: "table" | "view") => items.map((item) => ({
    key: `${prefix}-${item.schema_name ?? "default"}-${item.table_name}`,
    title: item.schema_name ? `${item.schema_name}.${item.table_name}` : item.table_name,
    nodeType,
    tableName: item.table_name,
    schemaName: item.schema_name,
    children: (columnMap.get(objectIdentity(item)) ?? []).map((column) => ({
      key: `${prefix}-${column.schema_name ?? "default"}-${item.table_name}-${column.column_name}`,
      title: column.column_name,
      isLeaf: true,
    })),
  }));
  const routines = (items: ObjectRow[], prefix: string, nodeType: "function" | "procedure") => items.map((item) => ({
    key: `${prefix}-${item.schema_name ?? "default"}-${item.table_name}`,
    title: item.schema_name ? `${item.schema_name}.${item.table_name}` : item.table_name,
    nodeType,
    routineName: item.table_name,
    schemaName: item.schema_name,
    isLeaf: true,
  }));
  return {
    name: databaseName,
    loaded: true,
    nodes: [
      { key: "tables", title: `表 (${tables.length})`, nodeType: "category", children: children(tables, "table", "table") },
      { key: "views", title: `视图 (${views.length})`, nodeType: "category", children: children(views, "view", "view") },
      { key: "functions", title: `函数 (${functions.length})`, nodeType: "category", children: routines(functions, "function", "function") },
      { key: "procedures", title: `存储过程 (${procedures.length})`, nodeType: "category", children: routines(procedures, "procedure", "procedure") },
    ],
  };
}

function demoDatabaseSchema(databaseName: string): DatabaseSchema {
  const existing = DEMO_SCHEMA.databases.find((database) => database.name === databaseName);
  if (existing?.nodes.length) {
    const nodes = existing.nodes.map((node) => {
      const nodeType = node.key === "tables" ? "table" : node.key === "views" ? "view" : undefined;
      return {
        ...node,
        nodeType: "category",
        children: node.children?.map((child) => ({
          ...child,
          nodeType,
          tableName: String(child.title),
          schemaName: undefined,
        })),
      };
    });
    return {
      ...existing,
      loaded: true,
      nodes: [
        ...nodes,
        { key: "functions", title: "函数 (0)", nodeType: "category", children: [] },
        { key: "procedures", title: "存储过程 (0)", nodeType: "category", children: [] },
      ],
    };
  }
  return {
    name: databaseName,
    loaded: true,
    nodes: [
      {
        key: "tables",
        title: "表 (2)",
        nodeType: "category",
        children: [
          { key: "table-events", title: "events", nodeType: "table", tableName: "events", children: [{ key: "events-id", title: "id", isLeaf: true }, { key: "events-created-at", title: "created_at", isLeaf: true }] },
          { key: "table-metrics", title: "metrics", nodeType: "table", tableName: "metrics", children: [{ key: "metrics-id", title: "id", isLeaf: true }, { key: "metrics-value", title: "value", isLeaf: true }] },
        ],
      },
      { key: "views", title: "视图 (0)", nodeType: "category", children: [] },
      { key: "functions", title: "函数 (0)", nodeType: "category", children: [] },
      { key: "procedures", title: "存储过程 (0)", nodeType: "category", children: [] },
    ],
  };
}

export async function loadDatabaseSchema(profile: ConnectionProfile, databaseName: string): Promise<DatabaseSchema> {
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    return demoDatabaseSchema(databaseName);
  }

  const databaseProfile = { ...profile, database: databaseName };
  if (databaseProfile.kind === "sqlite") {
    const objects = await queryRows(databaseProfile, "SELECT name AS table_name, type AS object_type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name") as ObjectRow[];
    const columnGroups = await Promise.all(objects.map(async (item) => {
      const escapedName = item.table_name.replaceAll('"', '""');
      const rows = await queryRows(databaseProfile, `PRAGMA table_info("${escapedName}")`) as Array<{ name: string }>;
      return rows.map((row) => ({ table_name: item.table_name, column_name: row.name }));
    }));
    return buildDatabaseSchema(databaseName, objects, columnGroups.flat());
  }

  if (databaseProfile.kind === "postgres") {
    const [objects, columns, routines] = await Promise.all([
      queryRows(databaseProfile, "SELECT table_schema AS schema_name, table_name, table_type AS object_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name") as Promise<ObjectRow[]>,
      queryRows(databaseProfile, "SELECT table_schema AS schema_name, table_name, column_name FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name, ordinal_position") as Promise<ColumnRow[]>,
      queryRows(databaseProfile, "SELECT routine_schema AS schema_name, routine_name AS table_name, routine_type AS object_type FROM information_schema.routines WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY routine_schema, routine_name") as Promise<ObjectRow[]>,
    ]);
    return buildDatabaseSchema(databaseName, [...objects, ...routines], columns);
  }

  if (databaseProfile.kind === "sqlserver") {
    const [objects, columns, routines] = await Promise.all([
      queryRows(databaseProfile, "SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name, TABLE_TYPE AS object_type FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_SCHEMA, TABLE_NAME") as Promise<ObjectRow[]>,
      queryRows(databaseProfile, "SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION") as Promise<ColumnRow[]>,
      queryRows(databaseProfile, "SELECT SCHEMA_NAME(schema_id) AS schema_name, name AS table_name, CASE WHEN type IN ('P', 'PC') THEN 'PROCEDURE' ELSE 'FUNCTION' END AS object_type FROM sys.objects WHERE type IN ('P', 'PC', 'FN', 'IF', 'TF', 'FS', 'FT') ORDER BY schema_name, table_name") as Promise<ObjectRow[]>,
    ]);
    return buildDatabaseSchema(databaseName, [...objects, ...routines], columns);
  }

  const [objects, columns, routines] = await Promise.all([
    queryRows(databaseProfile, "SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name, TABLE_TYPE AS object_type FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name") as Promise<ObjectRow[]>,
    queryRows(databaseProfile, "SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position") as Promise<ColumnRow[]>,
    queryRows(databaseProfile, "SELECT ROUTINE_SCHEMA AS schema_name, ROUTINE_NAME AS table_name, ROUTINE_TYPE AS object_type FROM information_schema.routines WHERE routine_schema = DATABASE() ORDER BY routine_name") as Promise<ObjectRow[]>,
  ]);
  return buildDatabaseSchema(databaseName, [...objects, ...routines], columns);
}

export async function loadSchema(profile: ConnectionProfile): Promise<SchemaSnapshot> {
  const defaultName = profile.database.trim() || defaultDatabase(profile.kind);
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    const names = [...new Set([defaultName, ...DEMO_SCHEMA.databases.map((database) => database.name)])];
    return {
      database: defaultName,
      databases: names.map((name) => ({ name, nodes: [], loaded: false })),
    };
  }

  let databaseNames: string[];
  if (profile.kind === "sqlite") {
    databaseNames = [defaultName];
  } else {
    const sql = profile.kind === "postgres"
      ? "SELECT datname AS database_name FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname"
      : profile.kind === "sqlserver"
        ? "SELECT name AS database_name FROM sys.databases WHERE state = 0 AND HAS_DBACCESS(name) = 1 ORDER BY name"
        : "SELECT SCHEMA_NAME AS database_name FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME";
    const rows = await queryRows({ ...profile, database: defaultName }, sql) as DatabaseRow[];
    databaseNames = rows.map((row) => String(row.database_name)).filter(Boolean);
  }

  const names = [...new Set([defaultName, ...databaseNames])].sort((left, right) => {
    if (left === defaultName) return -1;
    if (right === defaultName) return 1;
    return left.localeCompare(right, "zh-CN");
  });
  return {
    database: defaultName,
    databases: names.map((name) => ({ name, nodes: [], loaded: false })),
  };
}
