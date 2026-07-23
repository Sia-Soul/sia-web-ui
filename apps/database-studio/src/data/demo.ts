import type { ConnectionProfile, QueryHistoryItem, QueryResult, SchemaSnapshot } from "../types";

export const DEFAULT_SQL = `SELECT id, email, created_at, status
FROM users
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;`;

export const DEMO_PROFILES: ConnectionProfile[] = [
  {
    id: "production-postgres",
    name: "生产 PostgreSQL",
    kind: "postgres",
    host: "127.0.0.1",
    port: 5432,
    database: "commerce",
    username: "postgres",
    password: "",
    sslMode: "prefer",
    rememberPassword: false,
    connected: true,
  },
  {
    id: "local-mysql",
    name: "本地 MySQL",
    kind: "mysql",
    host: "127.0.0.1",
    port: 3306,
    database: "commerce_dev",
    username: "root",
    password: "",
    sslMode: "disable",
    rememberPassword: false,
  },
  {
    id: "orders-sqlite",
    name: "订单 SQLite",
    kind: "sqlite",
    host: "",
    port: 0,
    database: "orders.sqlite3",
    username: "",
    password: "",
    sslMode: "disable",
    rememberPassword: false,
  },
];

const emails = [
  "alice@example.com",
  "bob@example.com",
  "carol@example.com",
  "dave@example.com",
  "eve@example.com",
  "frank@example.com",
  "grace@example.com",
  "henry@example.com",
];

export const DEMO_RESULT: QueryResult = {
  rows: Array.from({ length: 24 }, (_, index) => ({
    id: index + 1,
    email: emails[index % emails.length],
    created_at: `2026-07-${String(22 - Math.floor(index / 4)).padStart(2, "0")} ${String(14 - index % 5).padStart(2, "0")}:${String(23 + index).slice(-2)}:11`,
    status: index % 5 === 3 ? "inactive" : "active",
  })),
  durationMs: 186,
  executedAt: "2026-07-22 14:23:11",
  message: "查询成功，返回 24 行。",
  editable: { table: "users", primaryKeys: ["id"], columns: ["id", "email", "created_at", "status"] },
};

export const DEMO_HISTORY: QueryHistoryItem[] = [
  {
    id: "history-1", operation: "Select", connectionId: "production-postgres", connectionName: "生产 PostgreSQL",
    databaseKind: "postgres", host: "127.0.0.1", port: 5432, database: "commerce", username: "postgres",
    sql: "SELECT id, email, created_at, status FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'",
    highRisk: false, startedAt: "2026-07-22T14:23:11+08:00", finishedAt: "2026-07-22T14:23:11.186+08:00",
    durationMs: 186, success: true, returnedRows: 24,
  },
  {
    id: "history-2", operation: "Select", connectionId: "production-postgres", connectionName: "生产 PostgreSQL",
    databaseKind: "postgres", host: "127.0.0.1", port: 5432, database: "commerce", username: "postgres",
    sql: "SELECT * FROM orders WHERE status = 'pending'", highRisk: false,
    startedAt: "2026-07-22T14:18:45+08:00", finishedAt: "2026-07-22T14:18:45.320+08:00",
    durationMs: 320, success: true, returnedRows: 8,
  },
  {
    id: "history-3", operation: "Update", connectionId: "production-postgres", connectionName: "生产 PostgreSQL",
    databaseKind: "postgres", host: "127.0.0.1", port: 5432, database: "commerce", username: "postgres",
    sql: "UPDATE orders SET status = 'closed' WHERE id = 1001", highRisk: true,
    startedAt: "2026-07-22T14:10:02+08:00", finishedAt: "2026-07-22T14:10:02.512+08:00",
    durationMs: 512, success: true, affectedRows: 1, backupPath: "browser-demo://backups/orders.json",
    backupRowCount: 1, backupTable: "orders",
  },
];

export const DEMO_SCHEMA: SchemaSnapshot = {
  database: "commerce",
  databases: [
    {
      name: "commerce",
      loaded: true,
      nodes: [
        {
          key: "tables",
          title: "表 (3)",
          children: [
            {
              key: "table-users",
              title: "users",
              children: [
                { key: "users-id", title: "id", isLeaf: true },
                { key: "users-email", title: "email", isLeaf: true },
                { key: "users-created-at", title: "created_at", isLeaf: true },
                { key: "users-status", title: "status", isLeaf: true },
              ],
            },
            { key: "table-orders", title: "orders", children: [{ key: "orders-id", title: "id", isLeaf: true }, { key: "orders-status", title: "status", isLeaf: true }] },
            { key: "table-order-items", title: "order_items", children: [{ key: "order-items-id", title: "id", isLeaf: true }, { key: "order-items-order-id", title: "order_id", isLeaf: true }] },
          ],
        },
        {
          key: "views",
          title: "视图 (1)",
          children: [{ key: "view-daily-sales", title: "daily_sales", isLeaf: true }],
        },
      ],
    },
    { name: "analytics", loaded: false, nodes: [] },
    { name: "postgres", loaded: false, nodes: [] },
  ],
};
