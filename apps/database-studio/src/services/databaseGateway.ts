import type {
  ConnectionProfile,
  DatabaseObjectCategory,
  DatabaseUser,
  DatabaseUserInput,
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
  operation: "test" | "query" | "update-cell" | "audit-list" | "user-create" | "user-update" | "user-delete";
  profile: Pick<ConnectionProfile, "id" | "name" | "kind" | "connectionMode" | "mcp" | "host" | "port" | "database" | "username" | "password" | "sslMode">;
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
  userName?: string;
  userHost?: string;
  password?: string;
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
    connectionMode: profile.connectionMode ?? "direct",
    mcp: profile.mcp,
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

export async function disconnect(profileId: string) {
  // 直连服务按请求释放连接池；MCP 模式需要显式结束复用的 stdio 子进程。
  const invoke = window.__TAURI__?.core?.invoke;
  if (invoke) await invoke("disconnect_mcp_connection", { profileId });
}

function isReadStatement(sql: string) {
  // 查询页默认会保留说明注释，判断语句类型前先跳过开头的行注释和块注释。
  let normalized = sql.trimStart();
  while (normalized.startsWith("--") || normalized.startsWith("/*")) {
    if (normalized.startsWith("--")) {
      const lineEnd = normalized.indexOf("\n");
      normalized = lineEnd >= 0 ? normalized.slice(lineEnd + 1).trimStart() : "";
    } else {
      const commentEnd = normalized.indexOf("*/", 2);
      normalized = commentEnd >= 0 ? normalized.slice(commentEnd + 2).trimStart() : "";
    }
  }
  if (/^with\b/i.test(normalized) && /\b(update|delete|insert|merge)\b/i.test(normalized)) return false;
  return /^(select|with|show|describe|desc|explain|pragma)\b/i.test(normalized);
}

/**
 * 检查 MCP 查询是否只有一条语句。
 * 官方 PostgreSQL MCP 服务已停止维护，因此客户端额外阻止可绕过只读事务的堆叠语句。
 */
function isSingleMcpStatement(sql: string) {
  let quote = "";
  let dollarTag = "";
  let lineComment = false;
  let blockComment = false;
  let statementEnded = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = "";
      }
      continue;
    }
    if (quote) {
      if (character === quote) {
        if (next === quote && quote !== "]") index += 1;
        else quote = "";
      }
      continue;
    }
    if (character === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === "\"" || character === "`" || character === "[") {
      quote = character === "[" ? "]" : character;
      continue;
    }
    if (character === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        index += dollarTag.length - 1;
        continue;
      }
    }
    if (character === ";") {
      if (statementEnded) return false;
      statementEnded = true;
      continue;
    }
    if (statementEnded && !/\s/.test(character)) return false;
  }
  return true;
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
  const finishedAt = new Date();
  const durationMs = options.durationMs ?? 1;
  const startedAt = new Date(finishedAt.getTime() - durationMs).toISOString();
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
    finishedAt: finishedAt.toISOString(),
    durationMs,
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
  if (profile.connectionMode === "mcp" && !isReadStatement(sql)) {
    throw new Error("当前 MCP 数据库连接按只读模式运行，只允许执行查询语句。");
  }
  if (profile.connectionMode === "mcp" && !isSingleMcpStatement(sql)) {
    throw new Error("MCP 只读连接不允许一次执行多条 SQL，请只保留一条查询语句后重试。");
  }
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
  if (profile.connectionMode === "mcp") throw new Error("MCP 数据库连接为只读模式，不能直接编辑结果单元格。");
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
    // 审计记录读取不需要启动 MCP 服务器，避免把敏感启动参数传给 FreeSql sidecar。
    profile: { ...hostProfile(profile), mcp: undefined },
    limit,
    offset,
  });
}

type DatabaseRow = { database_name: string };
type ObjectRow = { schema_name?: string; table_name: string; object_type?: string };
type ColumnRow = { schema_name?: string; table_name: string; column_name: string };
type UserRow = { user_name: string; user_host?: string; user_type?: string; user_status?: string };
type DatabaseObjectCountRow = {
  table_count?: number | string;
  view_count?: number | string;
  function_count?: number | string;
  procedure_count?: number | string;
};
type ConnectionObjectCountRow = {
  database_count?: number | string;
  user_count?: number | string;
};

const demoUsersByProfile = new Map<string, DatabaseUser[]>();

function demoUsers(profile: ConnectionProfile) {
  const existing = demoUsersByProfile.get(profile.id);
  if (existing) return existing;
  const users: DatabaseUser[] = profile.kind === "sqlite" ? [] : profile.kind === "mysql"
    ? [
      { name: profile.username || "root", host: "%", type: "caching_sha2_password", status: "正常" },
      { name: "report_reader", host: "%", type: "mysql_native_password", status: "正常" },
    ]
    : profile.kind === "sqlserver"
      ? [
        { name: profile.username || "sa", type: "SQL_LOGIN", status: "正常" },
        { name: "report_reader", type: "SQL_LOGIN", status: "正常" },
      ]
      : [
        { name: profile.username || "postgres", type: "超级用户", status: "正常" },
        { name: "report_reader", type: "普通用户", status: "正常" },
      ];
  demoUsersByProfile.set(profile.id, users);
  return users;
}

export async function loadConnectionObjectSummary(profile: ConnectionProfile) {
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const defaultName = profile.database.trim() || defaultDatabase(profile.kind);
    return {
      databaseCount: new Set([defaultName, ...DEMO_SCHEMA.databases.map((database) => database.name)]).size,
      userCount: demoUsers(profile).length,
    };
  }

  // stdio MCP 服务器通常只绑定一个数据库，因此不枚举同一实例上的其他数据库。
  if (profile.connectionMode === "mcp") {
    if (profile.kind === "sqlite") return { databaseCount: 1, userCount: 0 };
    const userSql = profile.kind === "postgres"
      ? "SELECT COUNT(*) AS user_count FROM pg_catalog.pg_user"
      : profile.kind === "sqlserver"
        ? "SELECT COUNT(*) AS user_count FROM sys.server_principals WHERE type IN ('S', 'U', 'G', 'E', 'X') AND name NOT LIKE '##%'"
        : "SELECT COUNT(*) AS user_count FROM mysql.user";
    const [row] = await queryRows(profile, userSql) as ConnectionObjectCountRow[];
    return { databaseCount: 1, userCount: numericCount(row?.user_count) };
  }

  let sql: string;
  if (profile.kind === "sqlite") {
    return { databaseCount: 1, userCount: 0 };
  } else if (profile.kind === "postgres") {
    sql = `
      SELECT
        (SELECT COUNT(*) FROM pg_database WHERE datallowconn AND NOT datistemplate) AS database_count,
        (SELECT COUNT(*) FROM pg_catalog.pg_user) AS user_count
    `;
  } else if (profile.kind === "sqlserver") {
    sql = `
      SELECT
        (SELECT COUNT(*) FROM sys.databases WHERE state = 0 AND HAS_DBACCESS(name) = 1) AS database_count,
        (SELECT COUNT(*) FROM sys.server_principals
          WHERE type IN ('S', 'U', 'G', 'E', 'X') AND name NOT LIKE '##%') AS user_count
    `;
  } else {
    sql = `
      SELECT
        (SELECT COUNT(*) FROM information_schema.SCHEMATA) AS database_count,
        (SELECT COUNT(*) FROM mysql.user) AS user_count
    `;
  }

  const [row] = await queryRows(profile, sql) as ConnectionObjectCountRow[];
  return {
    databaseCount: numericCount(row?.database_count),
    userCount: numericCount(row?.user_count),
  };
}

export async function loadDatabaseUsers(profile: ConnectionProfile): Promise<DatabaseUser[]> {
  if (profile.kind === "sqlite") return [];
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    return demoUsers(profile).map((user) => ({ ...user }));
  }
  const sql = profile.kind === "postgres"
    ? "SELECT usename AS user_name, CASE WHEN usesuper THEN '超级用户' WHEN usecreatedb THEN '可创建数据库' ELSE '普通用户' END AS user_type, CASE WHEN valuntil IS NOT NULL AND valuntil < CURRENT_TIMESTAMP THEN '已过期' ELSE '正常' END AS user_status FROM pg_catalog.pg_user ORDER BY usename"
    : profile.kind === "sqlserver"
      ? "SELECT name AS user_name, type_desc AS user_type, CASE WHEN is_disabled = 1 THEN N'已禁用' ELSE N'正常' END AS user_status FROM sys.server_principals WHERE type IN ('S', 'U', 'G', 'E', 'X') AND name NOT LIKE '##%' ORDER BY name"
      : "SELECT User AS user_name, Host AS user_host, plugin AS user_type, '正常' AS user_status FROM mysql.user ORDER BY User, Host";
  const rows = await queryRows(profile, sql) as UserRow[];
  return rows.map((row) => ({
    name: String(row.user_name ?? ""),
    host: row.user_host ? String(row.user_host) : undefined,
    type: row.user_type ? String(row.user_type) : undefined,
    status: row.user_status ? String(row.user_status) : undefined,
  })).filter((user) => user.name);
}

async function manageDatabaseUser(
  operation: "user-create" | "user-update" | "user-delete",
  profile: ConnectionProfile,
  input: DatabaseUserInput,
  safety: SqlSafetyOptions = {},
) {
  if (profile.kind === "sqlite") throw new Error("SQLite 不支持数据库用户管理。");
  if (profile.connectionMode === "mcp") throw new Error("MCP 数据库连接为只读模式，不支持新建、编辑或删除用户。");
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    const users = demoUsers(profile);
    const index = users.findIndex((user) => user.name === input.name && (user.host ?? "") === (input.host ?? ""));
    if (operation === "user-create") {
      if (index >= 0) throw new Error(`用户 ${input.name} 已存在。`);
      users.push({
        name: input.name,
        host: profile.kind === "mysql" ? input.host || "%" : undefined,
        type: profile.kind === "postgres" ? "普通用户" : profile.kind === "sqlserver" ? "SQL_LOGIN" : "caching_sha2_password",
        status: "正常",
      });
    } else if (index < 0) {
      throw new Error(`用户 ${input.name} 不存在。`);
    } else if (operation === "user-delete") {
      users.splice(index, 1);
    }
    const action = operation === "user-create" ? "UserCreate" : operation === "user-update" ? "UserUpdate" : "UserDelete";
    return demoAudit(profile, action, `${action} ${input.name} PASSWORD '***'`, {
      highRisk: operation !== "user-create",
      affectedRows: 1,
      backupPath: operation === "user-create" ? undefined : `browser-demo://backups/user-${input.name}.json`,
      backupRowCount: operation === "user-create" ? undefined : 1,
      backupTable: operation === "user-create" ? undefined : `database-user:${input.name}`,
      backupSkipped: safety.allowWithoutBackup,
    });
  }
  const result = await requestDatabaseHost<HostQueryResult>({
    operation,
    profile: hostProfile(profile),
    userName: input.name,
    userHost: input.host,
    password: input.password,
    allowWithoutBackup: safety.allowWithoutBackup,
  });
  assertNoConfirmation(result);
  if (!result.audit) throw new Error("数据库用户操作没有返回执行日志。");
  return result.audit;
}

export function createDatabaseUser(profile: ConnectionProfile, input: DatabaseUserInput) {
  return manageDatabaseUser("user-create", profile, input);
}

export function updateDatabaseUser(
  profile: ConnectionProfile,
  input: DatabaseUserInput,
  safety: SqlSafetyOptions = {},
) {
  return manageDatabaseUser("user-update", profile, input, safety);
}

export function deleteDatabaseUser(
  profile: ConnectionProfile,
  user: DatabaseUser,
  safety: SqlSafetyOptions = {},
) {
  return manageDatabaseUser("user-delete", profile, {
    name: user.name,
    host: user.host,
    password: "",
  }, safety);
}

const CATEGORY_LABELS: Record<DatabaseObjectCategory, string> = {
  tables: "表",
  views: "视图",
  functions: "函数",
  procedures: "存储过程",
};

type DatabaseObjectCounts = Record<DatabaseObjectCategory, number>;

function databaseCategoryNodes(counts?: DatabaseObjectCounts) {
  return (Object.keys(CATEGORY_LABELS) as DatabaseObjectCategory[]).map((category) => ({
    key: category,
    title: counts ? `${CATEGORY_LABELS[category]} (${counts[category]})` : CATEGORY_LABELS[category],
    nodeType: "category",
    category,
    isLeaf: false,
    loaded: false,
  }));
}

function databaseSchemaShell(databaseName: string, counts?: DatabaseObjectCounts): DatabaseSchema {
  return {
    name: databaseName,
    loaded: true,
    nodes: databaseCategoryNodes(counts),
  };
}

function objectNodes(category: DatabaseObjectCategory, objects: ObjectRow[]) {
  const nodeType = category === "tables" ? "table"
    : category === "views" ? "view"
      : category === "functions" ? "function"
        : "procedure";
  return objects.map((item) => ({
    key: `${nodeType}-${item.schema_name ?? "default"}-${item.table_name}`,
    title: item.schema_name ? `${item.schema_name}.${item.table_name}` : item.table_name,
    nodeType,
    tableName: nodeType === "table" || nodeType === "view" ? item.table_name : undefined,
    routineName: nodeType === "function" || nodeType === "procedure" ? item.table_name : undefined,
    schemaName: item.schema_name,
    isLeaf: nodeType === "function" || nodeType === "procedure",
    loaded: nodeType === "function" || nodeType === "procedure",
  }));
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function numericCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function databaseObjectCounts(row: DatabaseObjectCountRow | undefined): DatabaseObjectCounts {
  return {
    tables: numericCount(row?.table_count),
    views: numericCount(row?.view_count),
    functions: numericCount(row?.function_count),
    procedures: numericCount(row?.procedure_count),
  };
}

export async function loadDatabaseSchema(profile: ConnectionProfile, databaseName: string): Promise<DatabaseSchema> {
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const database = DEMO_SCHEMA.databases.find((item) => item.name === databaseName);
    const count = (category: DatabaseObjectCategory) =>
      database?.nodes.find((node) => node.key === category)?.children?.length ?? 0;
    return databaseSchemaShell(databaseName, {
      tables: count("tables"),
      views: count("views"),
      functions: count("functions"),
      procedures: count("procedures"),
    });
  }

  const databaseProfile = { ...profile, database: databaseName };
  let sql: string;
  if (profile.kind === "sqlite") {
    sql = `
      SELECT
        SUM(CASE WHEN type = 'table' THEN 1 ELSE 0 END) AS table_count,
        SUM(CASE WHEN type = 'view' THEN 1 ELSE 0 END) AS view_count,
        0 AS function_count,
        0 AS procedure_count
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
    `;
  } else if (profile.kind === "postgres") {
    sql = `
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE') AS table_count,
        (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'VIEW') AS view_count,
        (SELECT COUNT(*) FROM information_schema.routines
          WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') AND routine_type = 'FUNCTION') AS function_count,
        (SELECT COUNT(*) FROM information_schema.routines
          WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') AND routine_type = 'PROCEDURE') AS procedure_count
    `;
  } else if (profile.kind === "sqlserver") {
    sql = `
      SELECT
        (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) AS table_count,
        (SELECT COUNT(*) FROM sys.views WHERE is_ms_shipped = 0) AS view_count,
        (SELECT COUNT(*) FROM sys.objects
          WHERE type IN ('FN', 'IF', 'TF', 'FS', 'FT') AND is_ms_shipped = 0) AS function_count,
        (SELECT COUNT(*) FROM sys.objects
          WHERE type IN ('P', 'PC') AND is_ms_shipped = 0) AS procedure_count
    `;
  } else {
    sql = `
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE') AS table_count,
        (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_type = 'VIEW') AS view_count,
        (SELECT COUNT(*) FROM information_schema.routines
          WHERE routine_schema = DATABASE() AND routine_type = 'FUNCTION') AS function_count,
        (SELECT COUNT(*) FROM information_schema.routines
          WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE') AS procedure_count
    `;
  }

  const [row] = await queryRows(databaseProfile, sql) as DatabaseObjectCountRow[];
  return databaseSchemaShell(databaseName, databaseObjectCounts(row));
}

export async function loadDatabaseCategory(
  profile: ConnectionProfile,
  databaseName: string,
  category: DatabaseObjectCategory,
) {
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const demo = DEMO_SCHEMA.databases.find((database) => database.name === databaseName);
    const source = demo?.nodes.find((node) => node.key === category)?.children ?? [];
    return {
      key: category,
      title: `${CATEGORY_LABELS[category]} (${source.length})`,
      nodeType: "category",
      category,
      isLeaf: false,
      loaded: true,
      children: source.map((node) => ({
        ...node,
        nodeType: category === "tables" ? "table"
          : category === "views" ? "view"
            : category === "functions" ? "function"
              : "procedure",
        tableName: String(node.title),
        isLeaf: category === "functions" || category === "procedures",
        loaded: category === "functions" || category === "procedures",
        children: undefined,
      })),
    };
  }

  const databaseProfile = { ...profile, database: databaseName };
  let sql: string;
  if (profile.kind === "sqlite") {
    if (category === "functions" || category === "procedures") {
      return { key: category, title: `${CATEGORY_LABELS[category]} (0)`, nodeType: "category", category, isLeaf: false, loaded: true, children: [] };
    }
    const sqliteType = category === "tables" ? "table" : "view";
    sql = `SELECT name AS table_name, type AS object_type FROM sqlite_master WHERE type = '${sqliteType}' AND name NOT LIKE 'sqlite_%' ORDER BY name`;
  } else if (profile.kind === "postgres") {
    if (category === "tables" || category === "views") {
      const tableType = category === "tables" ? "BASE TABLE" : "VIEW";
      sql = `SELECT table_schema AS schema_name, table_name, table_type AS object_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = '${tableType}' ORDER BY table_schema, table_name`;
    } else {
      const routineType = category === "functions" ? "FUNCTION" : "PROCEDURE";
      sql = `SELECT routine_schema AS schema_name, routine_name AS table_name, routine_type AS object_type FROM information_schema.routines WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') AND routine_type = '${routineType}' ORDER BY routine_schema, routine_name`;
    }
  } else if (profile.kind === "sqlserver") {
    if (category === "tables" || category === "views") {
      const tableType = category === "tables" ? "BASE TABLE" : "VIEW";
      sql = `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name, TABLE_TYPE AS object_type FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = '${tableType}' ORDER BY TABLE_SCHEMA, TABLE_NAME`;
    } else {
      const types = category === "procedures" ? "'P', 'PC'" : "'FN', 'IF', 'TF', 'FS', 'FT'";
      sql = `SELECT SCHEMA_NAME(schema_id) AS schema_name, name AS table_name, CASE WHEN type IN ('P', 'PC') THEN 'PROCEDURE' ELSE 'FUNCTION' END AS object_type FROM sys.objects WHERE type IN (${types}) ORDER BY schema_name, table_name`;
    }
  } else if (category === "tables" || category === "views") {
    const tableType = category === "tables" ? "BASE TABLE" : "VIEW";
    sql = `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name, TABLE_TYPE AS object_type FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_TYPE = '${tableType}' ORDER BY table_name`;
  } else {
    const routineType = category === "functions" ? "FUNCTION" : "PROCEDURE";
    sql = `SELECT ROUTINE_SCHEMA AS schema_name, ROUTINE_NAME AS table_name, ROUTINE_TYPE AS object_type FROM information_schema.routines WHERE routine_schema = DATABASE() AND ROUTINE_TYPE = '${routineType}' ORDER BY routine_name`;
  }

  const objects = await queryRows(databaseProfile, sql) as ObjectRow[];
  return {
    key: category,
    title: `${CATEGORY_LABELS[category]} (${objects.length})`,
    nodeType: "category",
    category,
    isLeaf: false,
    loaded: true,
    children: objectNodes(category, objects),
  };
}

export async function loadDatabaseObjectColumns(
  profile: ConnectionProfile,
  databaseName: string,
  tableName: string,
  schemaName?: string,
) {
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 140));
    return ["id", "name", "created_at"].map((columnName) => ({
      key: `column-${schemaName ?? "default"}-${tableName}-${columnName}`,
      title: columnName,
      nodeType: "column",
      isLeaf: true,
      loaded: true,
    }));
  }

  const databaseProfile = { ...profile, database: databaseName };
  let columns: ColumnRow[];
  if (profile.kind === "sqlite") {
    const escapedName = tableName.replaceAll('"', '""');
    const rows = await queryRows(databaseProfile, `PRAGMA table_info("${escapedName}")`) as Array<{ name: string }>;
    columns = rows.map((row) => ({ table_name: tableName, column_name: row.name }));
  } else {
    const schemaPredicate = schemaName ? ` AND TABLE_SCHEMA = ${sqlLiteral(schemaName)}` : "";
    columns = await queryRows(
      databaseProfile,
      `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ${sqlLiteral(tableName)}${schemaPredicate} ORDER BY ORDINAL_POSITION`,
    ) as ColumnRow[];
  }
  return columns.map((column) => ({
    key: `column-${column.schema_name ?? "default"}-${tableName}-${column.column_name}`,
    title: column.column_name,
    nodeType: "column",
    isLeaf: true,
    loaded: true,
  }));
}

export async function loadSchema(profile: ConnectionProfile): Promise<SchemaSnapshot> {
  const defaultName = profile.database.trim() || defaultDatabase(profile.kind);
  if (!isDesktopRuntime) {
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    const names = [...new Set([defaultName, ...DEMO_SCHEMA.databases.map((database) => database.name)])];
    return {
      database: defaultName,
      databases: names.map((name) => ({ name, nodes: [], loaded: false })),
      databaseCount: names.length,
      databasesLoaded: true,
    };
  }

  // 一个 stdio MCP 配置对应一个数据库，展开连接时只建立默认数据库节点。
  if (profile.connectionMode === "mcp") {
    return {
      database: defaultName,
      databases: [{ name: defaultName, nodes: [], loaded: false }],
      databaseCount: 1,
      databasesLoaded: true,
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
    databaseCount: names.length,
    databasesLoaded: true,
  };
}
