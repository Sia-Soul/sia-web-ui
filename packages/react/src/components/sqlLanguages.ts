import type * as Monaco from "monaco-editor";

/** 代码编辑器支持的 SQL 方言名称。 */
export type SqlDialectLanguage = "sql-postgresql" | "sql-mysql" | "sql-sqlserver" | "sql-sqlite";

const COMMON_KEYWORDS = [
  "add", "all", "alter", "and", "any", "as", "asc", "begin", "between", "by", "call", "cascade",
  "case", "cast", "check", "collate", "column", "commit", "constraint", "create", "cross",
  "current_date", "current_time", "current_timestamp", "database", "default", "delete", "desc",
  "distinct", "drop", "else", "end", "escape", "except", "exists", "explain", "false", "fetch",
  "first", "following", "for", "foreign", "from", "full", "generated", "grant", "group", "groups",
  "having", "in", "index", "inner", "insert", "intersect", "interval", "into", "is", "join", "key",
  "last", "left", "like", "localtime", "localtimestamp", "natural", "next", "not", "null",
  "nulls", "offset", "on", "only", "or", "order", "outer", "over", "partition", "preceding",
  "primary", "range", "recursive", "references", "rename", "restrict", "revoke", "right", "rollback",
  "row", "rows", "schema", "select", "sequence", "set", "table", "then", "ties", "to",
  "transaction", "trigger", "true", "truncate", "unbounded", "union", "unique", "update", "using",
  "values", "view", "when", "where", "window", "with",
];

const DIALECT_KEYWORDS: Record<SqlDialectLanguage, readonly string[]> = {
  "sql-postgresql": [
    "analyze", "array", "concurrently", "conflict", "do", "ilike", "language", "lateral",
    "materialized", "returning", "serial", "tablespace", "unlogged", "vacuum", "verbose",
  ],
  "sql-mysql": [
    "auto_increment", "delimiter", "describe", "engine", "fulltext", "ignore", "lock", "optimize",
    "replace", "show", "straight_join", "unsigned", "use", "zerofill",
  ],
  "sql-sqlserver": [
    "apply", "catch", "clustered", "exec", "execute", "go", "identity", "merge", "nocheck",
    "nonclustered", "nolock", "output", "pivot", "procedure", "raiserror", "throw", "top", "try",
    "try_convert", "unpivot",
  ],
  "sql-sqlite": [
    "attach", "autoincrement", "conflict", "detach", "pragma", "reindex", "replace", "rowid",
    "strict", "vacuum", "virtual", "without",
  ],
};

const DIALECT_BUILTINS: Record<SqlDialectLanguage, readonly string[]> = {
  "sql-postgresql": [
    "bigserial", "boolean", "bytea", "date", "double", "generate_series", "inet", "integer",
    "json", "jsonb", "numeric", "real", "smallserial", "text", "time", "timestamp", "uuid", "varchar",
  ],
  "sql-mysql": [
    "bigint", "binary", "blob", "char", "date", "datetime", "decimal", "double", "enum", "float",
    "int", "json", "longblob", "mediumint", "set", "smallint", "text", "time", "timestamp", "tinyint",
    "varchar", "year",
  ],
  "sql-sqlserver": [
    "bigint", "binary", "bit", "char", "date", "datetime", "datetime2", "decimal", "float", "image",
    "int", "money", "nchar", "ntext", "numeric", "nvarchar", "real", "smallint", "text", "time",
    "uniqueidentifier", "varbinary", "varchar", "xml",
  ],
  "sql-sqlite": [
    "blob", "integer", "null", "real", "text",
  ],
};

let registered = false;

function dialectTokenizer(language: SqlDialectLanguage): Monaco.languages.IMonarchLanguage {
  const identifierRules: Monaco.languages.IMonarchLanguageRule[] = [];
  if (language === "sql-mysql") identifierRules.push([/`/, { token: "identifier.quote", next: "@backtickIdentifier" }]);
  if (language === "sql-sqlserver") identifierRules.push([/\[/, { token: "identifier.quote", next: "@bracketIdentifier" }]);

  return {
    defaultToken: "",
    ignoreCase: true,
    tokenPostfix: `.${language}`,
    keywords: [...COMMON_KEYWORDS, ...DIALECT_KEYWORDS[language]],
    builtins: DIALECT_BUILTINS[language],
    operators: ["=", ">", "<", "!", "~", "?", ":", "==", "<=", ">=", "!=", "<>", "+", "-", "*", "/", "%", "||", "&&"],
    brackets: [
      { open: "(", close: ")", token: "delimiter.parenthesis" },
      { open: "[", close: "]", token: "delimiter.square" },
    ],
    tokenizer: {
      root: [
        { include: "@whitespace" },
        ...identifierRules,
        [/[a-zA-Z_@$#][\w@$#]*/, {
          cases: {
            "@keywords": "keyword",
            "@builtins": "type",
            "@default": "identifier",
          },
        }],
        [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
        [/\d+([eE][-+]?\d+)?/, "number"],
        [/[;,.]/, "delimiter"],
        [/[()]/, "@brackets"],
        [/[=><!~?:&|+\-*/%^]+/, "operator"],
        [/'/, { token: "string.quote", next: "@string" }],
        [/"/, { token: "identifier.quote", next: "@quotedIdentifier" }],
      ],
      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/--.*$/, "comment"],
        [/\/\*/, { token: "comment.quote", next: "@comment" }],
      ],
      comment: [
        [/[^*/]+/, "comment"],
        [/\*\//, { token: "comment.quote", next: "@pop" }],
        [/[*/]/, "comment"],
      ],
      string: [
        [/[^']+/, "string"],
        [/''/, "string.escape"],
        [/'/, { token: "string.quote", next: "@pop" }],
      ],
      quotedIdentifier: [
        [/[^"]+/, "identifier"],
        [/""/, "identifier.escape"],
        [/"/, { token: "identifier.quote", next: "@pop" }],
      ],
      backtickIdentifier: [
        [/[^`]+/, "identifier"],
        [/``/, "identifier.escape"],
        [/`/, { token: "identifier.quote", next: "@pop" }],
      ],
      bracketIdentifier: [
        [/[^\]]+/, "identifier"],
        [/]]/, "identifier.escape"],
        [/]/, { token: "identifier.quote", next: "@pop" }],
      ],
    },
  };
}

export function registerSqlLanguages(monaco: {
  languages: Pick<typeof Monaco.languages, "register" | "setLanguageConfiguration" | "setMonarchTokensProvider">;
}) {
  if (registered) return;
  registered = true;
  (Object.keys(DIALECT_KEYWORDS) as SqlDialectLanguage[]).forEach((language) => {
    monaco.languages.register({ id: language });
    monaco.languages.setMonarchTokensProvider(language, dialectTokenizer(language));
    monaco.languages.setLanguageConfiguration(language, {
      comments: { lineComment: "--", blockComment: ["/*", "*/"] },
      brackets: [["(", ")"], ["[", "]"]],
      autoClosingPairs: [
        { open: "'", close: "'" },
        { open: "\"", close: "\"" },
        { open: "(", close: ")" },
      ],
      surroundingPairs: [
        { open: "'", close: "'" },
        { open: "\"", close: "\"" },
        { open: "(", close: ")" },
      ],
    });
  });
}
