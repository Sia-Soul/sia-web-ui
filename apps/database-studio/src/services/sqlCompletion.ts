import type {
  EditorCompletionContext,
  EditorCompletionItem,
  EditorCompletionProvider,
  TreeNode,
} from "@sia.soul/sia-react-ui";
import type { DatabaseKind, DatabaseSchema } from "../types";
import { currentSqlStatement } from "./sqlStatement";

interface SqlCompletionOptions {
  kind: DatabaseKind;
  databaseNames: readonly string[];
  schema?: DatabaseSchema;
  loadTableColumns?: (tableName: string, schemaName?: string) => Promise<readonly string[]>;
}

interface SqlObject {
  name: string;
  schema?: string;
  qualifiedName: string;
  type: "table" | "view" | "function" | "procedure";
  columns: string[];
  loaded: boolean;
}

interface SqlTableReference {
  name: string;
  schema?: string;
  qualifiedName: string;
  alias?: string;
}

const COMMON_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN",
  "ON", "AS", "DISTINCT", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "UNION",
  "UNION ALL", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE", "ALTER",
  "DROP", "TABLE", "VIEW", "INDEX", "DATABASE", "WITH", "CASE", "WHEN", "THEN", "ELSE", "END",
  "AND", "OR", "NOT", "NULL", "IS NULL", "IS NOT NULL", "IN", "EXISTS", "BETWEEN", "LIKE",
  "INTERVAL", "ASC", "DESC", "PRIMARY KEY", "FOREIGN KEY", "REFERENCES", "BEGIN", "COMMIT", "ROLLBACK",
] as const;

const DIALECT_KEYWORDS: Record<DatabaseKind, readonly string[]> = {
  postgres: ["RETURNING", "ILIKE", "LATERAL", "VACUUM", "ANALYZE", "DO", "LANGUAGE", "SERIAL"],
  mysql: ["SHOW", "DESCRIBE", "EXPLAIN", "REPLACE", "USE", "ENGINE", "AUTO_INCREMENT", "DELIMITER"],
  sqlserver: ["TOP", "EXEC", "GO", "MERGE", "OUTPUT", "IDENTITY", "NOLOCK", "TRY_CONVERT", "THROW"],
  sqlite: ["PRAGMA", "ATTACH", "DETACH", "AUTOINCREMENT", "CONFLICT", "REINDEX", "VACUUM", "ROWID"],
};

const COMMON_FUNCTIONS = [
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST", "CONCAT", "LOWER", "UPPER",
  "TRIM", "SUBSTRING", "ROUND",
] as const;

const COMMON_CONSTANTS = [
  "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "LOCALTIME", "LOCALTIMESTAMP",
] as const;

const DIALECT_FUNCTIONS: Record<DatabaseKind, readonly string[]> = {
  postgres: ["NOW", "DATE_TRUNC", "STRING_AGG", "JSONB_BUILD_OBJECT", "GENERATE_SERIES"],
  mysql: ["NOW", "DATE_FORMAT", "GROUP_CONCAT", "IFNULL", "JSON_EXTRACT"],
  sqlserver: ["GETDATE", "SYSDATETIME", "STRING_AGG", "ISNULL", "DATEADD", "DATEDIFF", "NEWID"],
  sqlite: ["DATE", "DATETIME", "STRFTIME", "IFNULL", "GROUP_CONCAT", "RANDOM"],
};

const ALIAS_STOP_WORDS = new Set([
  ...COMMON_KEYWORDS.flatMap((keyword) => keyword.split(/\s+/)),
  "CROSS", "OUTER", "LIMIT", "OFFSET", "FETCH",
]);

function nodeText(node: TreeNode) {
  return typeof node.title === "string" || typeof node.title === "number" ? String(node.title) : "";
}

function quoteIdentifier(kind: DatabaseKind, name: string) {
  if (/^[A-Za-z_][\w$#@]*$/.test(name)) return name;
  if (kind === "mysql") return `\`${name.replaceAll("`", "``")}\``;
  if (kind === "sqlserver") return `[${name.replaceAll("]", "]]")}]`;
  return `"${name.replaceAll("\"", "\"\"")}"`;
}

function qualifiedIdentifier(kind: DatabaseKind, schema: string | undefined, name: string) {
  return schema
    ? `${quoteIdentifier(kind, schema)}.${quoteIdentifier(kind, name)}`
    : quoteIdentifier(kind, name);
}

function collectObjects(kind: DatabaseKind, schema?: DatabaseSchema) {
  const objects: SqlObject[] = [];
  schema?.nodes.forEach((category) => {
    category.children?.forEach((node) => {
      const type = node.nodeType;
      if (type !== "table" && type !== "view" && type !== "function" && type !== "procedure") return;
      const name = typeof node.tableName === "string"
        ? node.tableName
        : typeof node.routineName === "string"
          ? node.routineName
          : nodeText(node);
      if (!name) return;
      const schemaName = typeof node.schemaName === "string" ? node.schemaName : undefined;
      objects.push({
        name,
        schema: schemaName,
        qualifiedName: qualifiedIdentifier(kind, schemaName, name),
        type,
        columns: node.children?.map(nodeText).filter(Boolean) ?? [],
        loaded: node.loaded === true,
      });
    });
  });
  return objects;
}

function unquoteIdentifier(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("[") && trimmed.endsWith("]"))
    || (trimmed.startsWith("`") && trimmed.endsWith("`"))
    || (trimmed.startsWith("\"") && trimmed.endsWith("\""))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function identifierParts(value: string) {
  return value.split(".").map(unquoteIdentifier).filter(Boolean);
}

function tableReferences(kind: DatabaseKind, text: string): SqlTableReference[] {
  const result: SqlTableReference[] = [];
  const pattern = /\b(?:FROM|JOIN|UPDATE|INTO)\s+((?:\[[^\]]+]|`[^`]+`|"[^"]+"|[\w$#@]+)(?:\s*\.\s*(?:\[[^\]]+]|`[^`]+`|"[^"]+"|[\w$#@]+)){0,2})(?:\s+(?:AS\s+)?([\w$#@]+))?/gi;
  for (const match of text.matchAll(pattern)) {
    const parts = identifierParts(match[1]);
    const name = parts.at(-1);
    if (!name) continue;
    const schema = parts.length > 1 ? parts.at(-2) : undefined;
    const alias = match[2] && !ALIAS_STOP_WORDS.has(match[2].toUpperCase()) ? match[2] : undefined;
    result.push({
      name,
      schema,
      qualifiedName: qualifiedIdentifier(kind, schema, name),
      alias,
    });
  }
  return result;
}

function referencedObjects(kind: DatabaseKind, text: string, objects: readonly SqlObject[]) {
  const references = new Map<string, SqlObject>();
  for (const reference of tableReferences(kind, text)) {
    const tableName = reference.name.toLowerCase();
    const schemaName = reference.schema?.toLowerCase();
    const object = objects.find((candidate) =>
      candidate.name.toLowerCase() === tableName
      && (!schemaName || candidate.schema?.toLowerCase() === schemaName));
    if (!object) continue;
    references.set(object.name.toLowerCase(), object);
    references.set(object.qualifiedName.toLowerCase(), object);
    if (reference.alias) references.set(reference.alias.toLowerCase(), object);
  }
  return references;
}

function completion(
  label: string,
  kind: EditorCompletionItem["kind"],
  detail: string,
  insertText = label,
  sortGroup = "4",
): EditorCompletionItem {
  return {
    label,
    kind,
    detail,
    insertText,
    filterText: `${label} ${insertText}`,
    sortText: `${sortGroup}-${label.toLowerCase()}`,
  };
}

function snippet(label: string, detail: string, insertText: string): EditorCompletionItem {
  return {
    ...completion(label, "snippet", detail, insertText, "0"),
    insertTextFormat: "snippet",
  };
}

function snippets(kind: DatabaseKind): EditorCompletionItem[] {
  const selectLimit = kind === "sqlserver"
    ? "SELECT TOP (${1:100}) ${2:*}\nFROM ${3:table};"
    : "SELECT ${1:*}\nFROM ${2:table}\nLIMIT ${3:100};";
  return [
    snippet("SELECT 查询", "SQL 片段", selectLimit),
    snippet("SELECT WHERE", "SQL 片段", "SELECT ${1:*}\nFROM ${2:table}\nWHERE ${3:condition};"),
    snippet("INSERT INTO", "SQL 片段", "INSERT INTO ${1:table} (${2:columns})\nVALUES (${3:values});"),
    snippet("UPDATE WHERE", "SQL 片段", "UPDATE ${1:table}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};"),
    snippet("DELETE WHERE", "SQL 片段", "DELETE FROM ${1:table}\nWHERE ${2:condition};"),
    snippet("CREATE TABLE", "SQL 片段", "CREATE TABLE ${1:table_name} (\n    ${2:id} INTEGER NOT NULL,\n    PRIMARY KEY (${2:id})\n);"),
  ];
}

function filterAndLimit(items: readonly EditorCompletionItem[], word: string) {
  const query = word.trim().toLowerCase();
  const unique = new Map<string, EditorCompletionItem>();
  items.forEach((item) => {
    const searchable = `${item.label} ${item.filterText ?? ""}`.toLowerCase();
    if (query && !searchable.includes(query)) return;
    const key = `${item.kind}:${item.label}:${item.insertText ?? ""}`;
    if (!unique.has(key)) unique.set(key, item);
  });
  return [...unique.values()].slice(0, 500);
}

export function createSqlCompletionProvider({
  kind,
  databaseNames,
  schema,
  loadTableColumns,
}: SqlCompletionOptions): EditorCompletionProvider {
  const objects = collectObjects(kind, schema);
  const schemas = [...new Set(objects.map((object) => object.schema).filter((name): name is string => Boolean(name)))];
  const relations = objects.filter((object) => object.type === "table" || object.type === "view");
  const routines = objects.filter((object) => object.type === "function" || object.type === "procedure");
  const keywordItems = [...COMMON_KEYWORDS, ...DIALECT_KEYWORDS[kind]]
    .map((keyword) => completion(keyword, "keyword", `${kind} 关键字`, keyword, "3"));
  const functionItems = [...COMMON_FUNCTIONS, ...DIALECT_FUNCTIONS[kind]]
    .map((name) => completion(name, "function", "内置函数", `${name}($1)`, "2"))
    .map((item) => ({ ...item, insertTextFormat: "snippet" as const }));
  const constantItems = COMMON_CONSTANTS
    .map((name) => completion(name, "keyword", "内置时间常量", name, "2"));
  const databaseItems = databaseNames.map((name) =>
    completion(name, "database", "数据库", quoteIdentifier(kind, name), "1"));
  const schemaItems = schemas.map((name) =>
    completion(name, "schema", "模式", quoteIdentifier(kind, name), "1"));
  const objectItems = objects.map((object) =>
    completion(
      object.schema ? `${object.schema}.${object.name}` : object.name,
      object.type,
      object.type === "table" ? "表" : object.type === "view" ? "视图" : object.type === "function" ? "函数" : "存储过程",
      object.type === "function" ? `${object.qualifiedName}($1)` : object.qualifiedName,
      object.type === "table" || object.type === "view" ? "1" : "2",
    )).map((item) => item.kind === "function" ? { ...item, insertTextFormat: "snippet" as const } : item);

  return async (context: EditorCompletionContext) => {
    const currentStatement = currentSqlStatement(context.value, context.position.offset);
    const statement = currentStatement?.text ?? context.textBeforeCursor;
    const statementBeforeCursor = currentStatement
      ? context.value.slice(currentStatement.startOffset, Math.min(context.position.offset, currentStatement.endOffset))
      : context.textBeforeCursor;
    const references = referencedObjects(kind, statement, objects);
    const parsedReferences = tableReferences(kind, statement);
    const lineBeforeCursor = context.lineTextBeforeCursor;
    const dotMatch = /(?:^|[^\w$#@\]`"])(\[[^\]]+]|`[^`]+`|"[^"]+"|[\w$#@]+)\.([\w$#@]*)$/.exec(lineBeforeCursor);
    const shouldResolveColumns = Boolean(dotMatch)
      || /\b(?:WHERE|ON|HAVING|SET|GROUP\s+BY|ORDER\s+BY)\b/i.test(statementBeforeCursor);
    const dynamicReferences = shouldResolveColumns && loadTableColumns
      ? await Promise.all(parsedReferences.slice(-8).map(async (reference) => {
          const known = relations.find((object) =>
            object.name.toLowerCase() === reference.name.toLowerCase()
            && (!reference.schema || object.schema?.toLowerCase() === reference.schema.toLowerCase()));
          const columns = known?.loaded
            ? known.columns
            : [...await loadTableColumns(reference.name, reference.schema)];
          return { ...reference, columns };
        }))
      : [];
    const dynamicByQualifier = new Map<string, (typeof dynamicReferences)[number]>();
    dynamicReferences.forEach((reference) => {
      dynamicByQualifier.set(reference.name.toLowerCase(), reference);
      dynamicByQualifier.set(reference.qualifiedName.toLowerCase(), reference);
      if (reference.alias) dynamicByQualifier.set(reference.alias.toLowerCase(), reference);
    });

    if (dotMatch) {
      const qualifier = unquoteIdentifier(dotMatch[1]).toLowerCase();
      const partial = dotMatch[2];
      const referenced = references.get(qualifier)
        ?? relations.find((object) => object.name.toLowerCase() === qualifier);
      if (referenced?.loaded) {
        return filterAndLimit(referenced.columns.map((column) =>
          completion(column, "column", `${referenced.qualifiedName} 字段`, quoteIdentifier(kind, column), "0")), partial);
      }
      const dynamicReference = dynamicByQualifier.get(qualifier);
      if (dynamicReference) {
        return filterAndLimit(dynamicReference.columns.map((column) =>
          completion(column, "column", `${dynamicReference.qualifiedName} 字段`, quoteIdentifier(kind, column), "0")), partial);
      }
      if (referenced) {
        return filterAndLimit(referenced.columns.map((column) =>
          completion(column, "column", `${referenced.qualifiedName} 字段`, quoteIdentifier(kind, column), "0")), partial);
      }
      if (databaseNames.some((database) => database.toLowerCase() === qualifier)) {
        return filterAndLimit(schemaItems, partial);
      }
      const schemaRelations = relations.filter((object) => object.schema?.toLowerCase() === qualifier);
      if (schemaRelations.length > 0) {
        return filterAndLimit(schemaRelations.map((object) =>
          completion(object.name, object.type, object.type === "table" ? "表" : "视图", quoteIdentifier(kind, object.name), "0")), partial);
      }
    }

    const withoutWord = statementBeforeCursor.slice(0, Math.max(0, statementBeforeCursor.length - context.word.length));
    if (/\b(?:FROM|JOIN|UPDATE|INTO)\s*$/i.test(withoutWord)) {
      return filterAndLimit(objectItems.filter((item) => item.kind === "table" || item.kind === "view"), context.word);
    }
    if (/\b(?:EXEC|CALL)\s*$/i.test(withoutWord)) {
      return filterAndLimit(objectItems.filter((item) => item.kind === "procedure" || item.kind === "function"), context.word);
    }

    const columnSources = new Map<string, { qualifiedName: string; columns: readonly string[] }>();
    [...new Set(references.values())].forEach((object) => {
      columnSources.set(object.qualifiedName.toLowerCase(), object);
    });
    dynamicReferences.forEach((reference) => {
      columnSources.set(reference.qualifiedName.toLowerCase(), reference);
    });
    const referencedColumns = [...columnSources.values()].flatMap((object) =>
      object.columns.map((column) =>
        completion(column, "column", `${object.qualifiedName} 字段`, quoteIdentifier(kind, column), "0")));
    const clauseWantsColumns = /\b(?:SELECT|WHERE|ON|HAVING|SET|GROUP\s+BY|ORDER\s+BY)\b/i.test(statementBeforeCursor);
    return filterAndLimit([
      ...(clauseWantsColumns ? referencedColumns : []),
      ...snippets(kind),
      ...keywordItems,
      ...constantItems,
      ...functionItems,
      ...databaseItems,
      ...schemaItems,
      ...objectItems,
    ], context.word);
  };
}
