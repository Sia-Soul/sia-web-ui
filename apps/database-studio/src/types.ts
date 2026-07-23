import type { TreeNode } from "@sia-ui/react";

export type DatabaseKind = "postgres" | "mysql" | "sqlserver" | "sqlite";

export interface ConnectionProfile {
  id: string;
  name: string;
  kind: DatabaseKind;
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

export interface SchemaSnapshot {
  database: string;
  databases: DatabaseSchema[];
}
