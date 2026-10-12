import type * as Monaco from "monaco-editor";

/** SQL 方言名称；sql-sqlserver 支持 T-SQL 保留字、常用内置函数、类型、变量和 Unicode 字符串着色，不执行语法有效性检查。 */
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
    "backup", "break", "bulk", "checkpoint", "close", "continue", "cursor", "dbcc", "deallocate",
    "declare", "deny", "disk", "distributed", "dump", "errlvl", "external", "file", "fillfactor",
    "function", "goto", "holdlock", "identity_insert", "identitycol", "if", "kill", "lineno", "load",
    "national", "nocount", "off", "open", "opendatasource", "openquery", "openrowset", "openxml",
    "option", "percent", "plan", "print", "proc", "public", "read", "readtext", "reconfigure",
    "replication", "restore", "return", "revert", "rowcount", "rowguidcol", "rule", "save",
    "securityaudit", "session_user", "shutdown", "statistics", "system_user", "textsize", "tran",
    "tsequal", "updatetext", "use", "user", "varying", "waitfor", "while", "within", "writetext",
  ],
  "sql-sqlite": [
    "attach", "autoincrement", "conflict", "detach", "pragma", "reindex", "replace", "rowid",
    "strict", "vacuum", "virtual", "without",
  ],
};

// 聚合函数独立于保留字；否则 COUNT 等常用函数会被当成普通表名显示。
const COMMON_FUNCTIONS = ["abs", "avg", "coalesce", "count", "max", "min", "nullif", "round", "sum", "upper", "lower", "substring"];
// SQL Server 的常用内置函数不混入其他方言，也不将任意用户函数当作系统函数。
const SQLSERVER_FUNCTIONS = [
  "approx_count_distinct", "count_big", "grouping", "grouping_id", "checksum_agg", "stdev", "stdevp", "var", "varp",
  "string_agg", "isnull", "iif", "choose", "convert", "try_cast", "parse", "try_parse", "isnumeric",
  "getdate", "getutcdate", "sysdatetime", "sysdatetimeoffset", "sysutcdatetime", "dateadd", "datediff", "datediff_big",
  "datename", "datepart", "datefromparts", "datetimefromparts", "eomonth", "year", "month", "day", "isdate",
  "row_number", "rank", "dense_rank", "ntile", "lag", "lead", "first_value", "last_value", "percent_rank", "cume_dist",
  "len", "datalength", "concat", "concat_ws", "charindex", "patindex", "left", "right", "ltrim", "rtrim", "trim",
  "replace", "replicate", "reverse", "space", "stuff", "str", "string_split", "translate", "unicode", "quotename",
  "ceiling", "floor", "power", "sqrt", "square", "sign", "rand", "exp", "log", "log10",
  "json_value", "json_query", "json_modify", "isjson", "openjson", "newid", "newsequentialid",
  "object_id", "object_name", "schema_name", "db_name", "db_id", "col_name", "col_length", "type_name",
  "scope_identity", "ident_current", "ident_seed", "ident_incr", "error_number", "error_message", "error_line",
  "error_procedure", "error_severity", "error_state", "xact_state", "suser_sname", "user_name", "host_name", "app_name",
];

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
    functions: [...COMMON_FUNCTIONS, ...(language === "sql-sqlserver" ? SQLSERVER_FUNCTIONS : [])],
    operators: ["=", ">", "<", "!", "~", "?", ":", "==", "<=", ">=", "!=", "<>", "+", "-", "*", "/", "%", "||", "&&"],
    brackets: [
      { open: "(", close: ")", token: "delimiter.parenthesis" },
      { open: "[", close: "]", token: "delimiter.square" },
    ],
    tokenizer: {
      root: [
        { include: "@whitespace" },
        ...identifierRules,
        // T-SQL Unicode 字符串、局部/系统变量及参数占位符单独着色，不能吞掉后续语句。
        ...(language === "sql-sqlserver" ? [
          [/N'/i, { token: "string.quote", next: "@string" }],
          // Monarch 将 @ 视作词法宏前缀，使用字符编码避免 @@? 被展开成可选 @。
          [/\x40{1,2}[\w$#]+/, "variable"],
          [/0x[\da-f]+/i, "number.hex"],
        ] as Monaco.languages.IMonarchLanguageRule[] : []),
        [/[a-zA-Z_@$#][\w@$#]*/, {
          cases: {
            "@keywords": "keyword",
            "@builtins": "type",
            // Monaco 内置明暗主题为 predefined.sql 配色，保留此前缀才能让函数实际显示高亮。
            "@functions": "predefined.sql",
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

/** 为 Monaco 注册 SQL 方言的词法着色与括号、注释配置；重复调用不重复注册。 */
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
