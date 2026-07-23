import type { DatabaseKind } from "../types";

export function defaultDatabase(kind: DatabaseKind) {
  if (kind === "postgres") return "postgres";
  if (kind === "mysql") return "mysql";
  if (kind === "sqlserver") return "master";
  return "data/database.sqlite3";
}
