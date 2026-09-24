import type { TreeNode } from "@sia.soul/sia-react-ui";

export type DatabaseKind = "postgres" | "mysql" | "sqlserver" | "sqlite";

/** 数据库连接所使用的传输方式。 */
export type ConnectionMode = "direct" | "mcp";

/** stdio MCP 服务器的本地启动配置。 */
export interface McpStdioConfig {
  /** MCP 服务器启动命令，例如 `npx`。 */
  command: string;
  /** 传递给启动命令的参数；连接 URI 等敏感信息会随整份配置保存到系统安全凭据存储。 */
  args: string[];
  /** 启动 MCP 服务器时附加的环境变量。 */
  env?: Record<string, string>;
  /** 执行 SQL 时调用的 MCP 工具名称，默认为 `query`。 */
  toolName?: string;
}

export interface ConnectionProfile {
  id: string;
  name: string;
  kind: DatabaseKind;
  /** 连接传输方式；旧配置未提供时按 `direct` 处理。 */
  connectionMode?: ConnectionMode;
  /** `connectionMode` 为 `mcp` 时使用的 stdio MCP 启动配置。 */
  mcp?: McpStdioConfig;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode: "prefer" | "require" | "disable";
  rememberPassword: boolean;
  connected?: boolean;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  affectedRows?: number;
  durationMs: number;
  executedAt: string;
  message: string;
  editable?: QueryEditMetadata;
  execution?: SqlExecutionDetail;
}

export interface QueryExecutionMessage extends Record<string, unknown> {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "success" | "error";
  result: string;
  sql: string;
}

export interface QueryEditMetadata {
  table: string;
  primaryKeys: string[];
  columns: string[];
}

export interface SqlExecutionDetail extends Record<string, unknown> {
  id: string;
  operation: string;
  connectionId: string;
  connectionName: string;
  databaseKind: DatabaseKind;
  host: string;
  port: number;
  database: string;
  username: string;
  sql: string;
  parameters?: Record<string, unknown>;
  highRisk: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  success: boolean;
  affectedRows?: number;
  returnedRows?: number;
  error?: string;
  backupPath?: string;
  backupRowCount?: number;
  backupTable?: string;
  backupSkipped?: boolean;
  backupError?: string;
  confirmedWithoutWhere?: boolean;
}

export type QueryHistoryItem = SqlExecutionDetail;

export interface ExecutionHistoryPage {
  items: QueryHistoryItem[];
  total: number;
}

export interface SqlSafetyOptions {
  confirmWithoutWhere?: boolean;
  allowWithoutBackup?: boolean;
}

export interface SqlConfirmation {
  type: "missing-where" | "backup-failed";
  title: string;
  message: string;
}

export interface DatabaseSchema {
  name: string;
  nodes: TreeNode[];
  loaded: boolean;
  error?: string;
}

export type DatabaseObjectCategory = "tables" | "views" | "functions" | "procedures";

export interface SchemaSnapshot {
  database: string;
  databases: DatabaseSchema[];
  databaseCount?: number;
  databasesLoaded?: boolean;
}

export interface DatabaseUser {
  name: string;
  host?: string;
  type?: string;
  status?: string;
}

export interface DatabaseUserSnapshot {
  users: DatabaseUser[];
  loaded: boolean;
  count?: number;
  loading?: boolean;
  error?: string;
}

export interface DatabaseUserInput {
  name: string;
  host?: string;
  password: string;
}
