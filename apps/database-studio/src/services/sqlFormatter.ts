import type { SqlLanguage } from "sql-formatter";
import type { DatabaseKind } from "../types";
import { sqlStatements } from "./sqlStatement";

const FORMATTER_LANGUAGE: Record<DatabaseKind, SqlLanguage> = {
  postgres: "postgresql",
  mysql: "mysql",
  sqlserver: "tsql",
  sqlite: "sqlite",
};

export async function formatSql(sql: string, databaseKind: DatabaseKind) {
  const { format } = await import("sql-formatter");
  const options = {
    language: FORMATTER_LANGUAGE[databaseKind],
    tabWidth: 4,
    useTabs: false,
    keywordCase: "upper",
    dataTypeCase: "upper",
    functionCase: "upper",
    logicalOperatorNewline: "before",
    expressionWidth: 88,
    linesBetweenQueries: 1,
    denseOperators: false,
    newlineBeforeSemicolon: false,
  } as const;
  const statements = sqlStatements(sql);
  if (statements.length === 0) return "";
  return statements
    .map((statement) => format(statement.text, options).trim())
    .join("\n\n");
}
