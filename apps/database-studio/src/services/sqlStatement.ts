import type { EditorRange } from "@sia.soul/sia-react-ui";

export interface SqlStatement {
  range: EditorRange;
  startOffset: number;
  endOffset: number;
  text: string;
}

interface StatementSegment {
  rawStart: number;
  rawEnd: number;
  statement: SqlStatement;
}

const STATEMENT_STARTERS = new Set([
  "alter",
  "attach",
  "begin",
  "call",
  "commit",
  "create",
  "delete",
  "detach",
  "do",
  "drop",
  "exec",
  "execute",
  "explain",
  "insert",
  "merge",
  "pragma",
  "replace",
  "rollback",
  "select",
  "show",
  "truncate",
  "update",
  "use",
  "vacuum",
  "with",
]);

const DATA_STATEMENT_STARTERS = new Set(["delete", "insert", "merge", "select", "update"]);

function positionAt(sql: string, offset: number) {
  const prefix = sql.slice(0, Math.max(0, Math.min(offset, sql.length)));
  const lines = prefix.split("\n");
  return {
    lineNumber: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function createSegment(sql: string, rawStart: number, rawEnd: number): StatementSegment | null {
  let startOffset = rawStart;
  let endOffset = rawEnd;
  while (startOffset < endOffset && /\s/.test(sql[startOffset])) startOffset += 1;
  while (endOffset > startOffset && /\s/.test(sql[endOffset - 1])) endOffset -= 1;
  if (startOffset >= endOffset) return null;
  const start = positionAt(sql, startOffset);
  const end = positionAt(sql, endOffset);
  return {
    rawStart,
    rawEnd,
    statement: {
      startOffset,
      endOffset,
      text: sql.slice(startOffset, endOffset),
      range: {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      },
    },
  };
}

function nextLineStarter(sql: string, newlineOffset: number) {
  const match = sql.slice(newlineOffset + 1).match(/^[ \t]*([a-zA-Z_][\w$]*)\b/);
  const keyword = match?.[1].toLowerCase() ?? "";
  return STATEMENT_STARTERS.has(keyword) ? keyword : "";
}

function isImplicitBoundary(
  sql: string,
  statementStart: number,
  newlineOffset: number,
  rootKeyword: string,
  withMainStatementSeen: boolean,
  nextKeyword: string,
) {
  if (!nextKeyword) return false;
  const currentText = sql.slice(statementStart, newlineOffset).trim();
  if (!currentText || !rootKeyword) return false;
  if (rootKeyword === "with" && !withMainStatementSeen) return false;
  if (rootKeyword === "insert" && ["select", "values", "with"].includes(nextKeyword)) return false;
  if (["alter", "create", "replace"].includes(rootKeyword) && ["begin", "select", "with"].includes(nextKeyword)) return false;
  if (rootKeyword === "explain" && DATA_STATEMENT_STARTERS.has(nextKeyword)) return false;
  if (["begin", "declare"].includes(rootKeyword)) return false;
  if (/(?:\bunion(?:\s+all)?|\bintersect|\bexcept|\bas|\bthen|\belse|[,(=+\-*/%])\s*$/i.test(currentText)) return false;
  return true;
}

function sqlSegments(sql: string) {
  const segments: StatementSegment[] = [];
  let statementStart = 0;
  let quote: "'" | "\"" | "`" | "]" | null = null;
  let lineComment = false;
  let blockComment = false;
  let dollarQuote = "";
  let parenthesisDepth = 0;
  let rootKeyword = "";
  let withMainStatementSeen = false;

  function resetStatementState() {
    parenthesisDepth = 0;
    rootKeyword = "";
    withMainStatementSeen = false;
  }

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1] ?? "";

    if (lineComment) {
      if (char !== "\n") continue;
      lineComment = false;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = "";
      }
      continue;
    }
    if (quote) {
      if (quote === "]") {
        if (char === "]" && next === "]") index += 1;
        else if (char === "]") quote = null;
        continue;
      }
      if (char === "\\" && quote !== "\"") {
        index += 1;
        continue;
      }
      if (char === quote && next === quote) {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") {
      quote = "]";
      continue;
    }
    if (char === "$") {
      const match = sql.slice(index).match(/^\$[a-zA-Z_][\w]*\$|^\$\$/);
      if (match) {
        dollarQuote = match[0];
        index += dollarQuote.length - 1;
        continue;
      }
    }
    if (char === "(") {
      parenthesisDepth += 1;
      continue;
    }
    if (char === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      continue;
    }
    if (parenthesisDepth === 0 && /[a-zA-Z_]/.test(char) && !/[\w$]/.test(sql[index - 1] ?? "")) {
      const word = sql.slice(index).match(/^[a-zA-Z_][\w$]*/)?.[0].toLowerCase() ?? "";
      if (!rootKeyword) rootKeyword = word;
      else if (rootKeyword === "with" && !withMainStatementSeen && DATA_STATEMENT_STARTERS.has(word)) {
        withMainStatementSeen = true;
      }
    }
    if (char === "\n" && parenthesisDepth === 0) {
      const nextKeyword = nextLineStarter(sql, index);
      if (isImplicitBoundary(sql, statementStart, index, rootKeyword, withMainStatementSeen, nextKeyword)) {
        const segment = createSegment(sql, statementStart, index + 1);
        if (segment) segments.push(segment);
        statementStart = index + 1;
        resetStatementState();
      }
      continue;
    }
    if (char !== ";" || parenthesisDepth > 0) continue;

    const segment = createSegment(sql, statementStart, index + 1);
    if (segment) segments.push(segment);
    statementStart = index + 1;
    resetStatementState();
  }

  const finalSegment = createSegment(sql, statementStart, sql.length);
  if (finalSegment) segments.push(finalSegment);
  return segments;
}

export function currentSqlStatement(sql: string, cursorOffset: number): SqlStatement | null {
  const segments = sqlSegments(sql);
  if (segments.length === 0) return null;
  const offset = Math.max(0, Math.min(cursorOffset, sql.length));
  const containing = segments.find((segment) => offset >= segment.rawStart && offset <= segment.rawEnd);
  if (containing) return containing.statement;
  return segments.reduce((nearest, segment) => {
    const nearestDistance = Math.min(Math.abs(offset - nearest.rawStart), Math.abs(offset - nearest.rawEnd));
    const segmentDistance = Math.min(Math.abs(offset - segment.rawStart), Math.abs(offset - segment.rawEnd));
    return segmentDistance < nearestDistance ? segment : nearest;
  }).statement;
}

export function sqlStatements(sql: string) {
  return sqlSegments(sql).map((segment) => segment.statement);
}
