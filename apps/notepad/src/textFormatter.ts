import type { Plugin } from "prettier";
import { LANGUAGE_OPTIONS, type NoteLanguage } from "./languages";

export const FORMATTABLE_LANGUAGES: ReadonlySet<NoteLanguage> = new Set(
  LANGUAGE_OPTIONS.map(({ key }) => key),
);

export interface FormatTextResult {
  content: string;
  partial: boolean;
  errorDetail?: string;
  diagnostics: FormatTextDiagnostic[];
  formattedAs?: NoteLanguage;
}

export interface FormatTextDiagnostic {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
}

const PRETTIER_PARSERS: Partial<Record<NoteLanguage, string>> = {
  json: "json",
  jsonc: "json",
  markdown: "markdown",
  juliamarkdown: "markdown",
  javascript: "babel",
  javascriptreact: "babel",
  typescript: "typescript",
  typescriptreact: "typescript",
  html: "html",
  css: "css",
  less: "less",
  scss: "scss",
  graphql: "graphql",
  handlebars: "glimmer",
  vue: "vue",
  xml: "xml",
  xaml: "xml",
  xsl: "xml",
  yaml: "yaml",
  dockercompose: "yaml",
};

let clangInitialization: Promise<void> | null = null;

function modulePlugin(module: { default: Plugin }): Plugin {
  return module.default;
}

async function formatWithPrettier(language: NoteLanguage, source: string, filePath?: string): Promise<string> {
  const parser = PRETTIER_PARSERS[language];
  if (!parser) throw new Error("当前语言没有可用的 Prettier 解析器");

  const [prettier, babel, estree, typescript, html, postcss, markdown, graphql, glimmer, yaml, xml] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
    import("prettier/plugins/typescript"),
    import("prettier/plugins/html"),
    import("prettier/plugins/postcss"),
    import("prettier/plugins/markdown"),
    import("prettier/plugins/graphql"),
    import("prettier/plugins/glimmer"),
    import("prettier/plugins/yaml"),
    import("@prettier/plugin-xml"),
  ]);

  return prettier.format(source, {
    parser,
    filepath: filePath,
    plugins: [
      modulePlugin(babel),
      modulePlugin(estree),
      modulePlugin(typescript),
      modulePlugin(html),
      modulePlugin(postcss),
      modulePlugin(markdown),
      modulePlugin(graphql),
      modulePlugin(glimmer),
      modulePlugin(yaml),
      modulePlugin(xml),
    ],
    endOfLine: "lf",
    printWidth: 120,
    tabWidth: 2,
    useTabs: false,
  });
}

const CLANG_EXTENSIONS: Partial<Record<NoteLanguage, string>> = {
  c: "c",
  cpp: "cpp",
  cuda: "cu",
  csharp: "cs",
  hlsl: "hlsl",
  idl: "idl",
  objectivec: "m",
  objectivecpp: "mm",
  java: "java",
  protobuf: "proto",
  rc: "rc",
  shaderlab: "shader",
  solidity: "sol",
  verilog: "sv",
};

async function formatWithClang(language: NoteLanguage, source: string, filePath?: string): Promise<string> {
  const clang = await import("@wasm-fmt/clang-format/vite");
  clangInitialization ??= clang.default();
  await clangInitialization;
  const extension = CLANG_EXTENSIONS[language] ?? "txt";
  const path = filePath?.toLocaleLowerCase("en-US").endsWith(`.${extension}`)
    ? filePath
    : `document.${extension}`;
  const style = JSON.stringify({
    BasedOnStyle: language === "csharp" ? "Microsoft" : language === "java" ? "Google" : "LLVM",
    ColumnLimit: 120,
    IndentWidth: language === "csharp" ? 4 : 2,
    TabWidth: language === "csharp" ? 4 : 2,
    UseTab: "Never",
  });
  return clang.format(source, path, style);
}

function formatJsonLines(source: string): string {
  const trailingNewline = source.endsWith("\n");
  const lines = source.split(/\r?\n/);
  if (trailingNewline) lines.pop();
  const formatted = lines.map((line, index) => {
    if (!line.trim()) return "";
    try {
      return JSON.stringify(JSON.parse(line));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`第 ${index + 1} 行不是有效的 JSON：${detail}`);
    }
  }).join("\n");
  return trailingNewline ? `${formatted}\n` : formatted;
}

const SERVER_TEMPLATE_LANGUAGES: ReadonlySet<NoteLanguage> = new Set(["asp", "aspx", "jsp"]);

async function formatServerTemplate(source: string, filePath?: string): Promise<string> {
  const serverBlocks: string[] = [];
  let tokenPrefix = "SIAWEBFORMSBLOCK";
  while (source.includes(tokenPrefix)) tokenPrefix += "X";
  const protectedSource = source.replace(/<%[\s\S]*?%>/g, (block) => {
    const token = `${tokenPrefix}${serverBlocks.length.toString().padStart(6, "0")}PLACEHOLDER`;
    serverBlocks.push(block);
    return token;
  });
  const formatted = await formatWithPrettier("html", protectedSource, filePath);
  return serverBlocks.reduce(
    (result, block, index) => result.replace(
      `${tokenPrefix}${index.toString().padStart(6, "0")}PLACEHOLDER`,
      block,
    ),
    formatted,
  );
}

async function formatSql(source: string): Promise<string> {
  const { format } = await import("sql-formatter");
  return format(source, {
    language: "sql",
    tabWidth: 2,
    useTabs: false,
    keywordCase: "upper",
    dataTypeCase: "upper",
    functionCase: "upper",
    logicalOperatorNewline: "before",
    expressionWidth: 120,
    linesBetweenQueries: 1,
    denseOperators: false,
    newlineBeforeSemicolon: false,
  });
}

function formatConservatively(source: string): string {
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

async function formatTextStrict(language: NoteLanguage, source: string, filePath?: string): Promise<string> {
  if (!FORMATTABLE_LANGUAGES.has(language)) {
    throw new Error("当前语言暂不支持格式化");
  }
  if (!source.trim()) return source;
  if (language === "jsonl") return formatJsonLines(source);
  if (language in CLANG_EXTENSIONS) return formatWithClang(language, source, filePath);
  if (SERVER_TEMPLATE_LANGUAGES.has(language)) return formatServerTemplate(source, filePath);
  if (language === "sql") return formatSql(source);
  if (language in PRETTIER_PARSERS) return formatWithPrettier(language, source, filePath);
  return formatConservatively(source);
}

function nextNonWhitespaceCharacter(source: string, start: number): string {
  for (let index = start; index < source.length; index += 1) {
    if (!/\s/u.test(source[index])) return source[index];
  }
  return "";
}

function formatJsonTolerantly(source: string, diagnostics: FormatTextDiagnostic[] = []): string {
  const trailingNewline = /\r?\n$/u.test(source);
  let output = "";
  let index = 0;
  let indent = 0;
  let lineStart = true;
  let lastKind: "none" | "open" | "close" | "comma" | "colon" | "value" | "comment" = "none";
  let whitespaceHadNewline = false;
  let outputLine = 1;
  let lastValueEnd: { line: number; column: number } | null = null;
  const openStack: Array<{ character: string; expanded: boolean }> = [];

  const trimLineEnd = () => {
    output = output.replace(/[ \t]+$/u, "");
  };
  const write = (value: string) => {
    if (lineStart) {
      output += "  ".repeat(indent);
      lineStart = false;
    }
    output += value;
  };
  const newline = () => {
    trimLineEnd();
    if (!output.endsWith("\n")) {
      output += "\n";
      outputLine += 1;
    }
    lineStart = true;
  };
  const outputColumn = () => output.length - output.lastIndexOf("\n");
  const previousTokenIsValue = () => lastKind === "value" || lastKind === "close";
  const writeValue = (value: string, propertyKey = false) => {
    const container = openStack[openStack.length - 1]?.character;
    const missingPropertySeparator = previousTokenIsValue() && propertyKey && container === "{";
    if (missingPropertySeparator && lastValueEnd) {
      diagnostics.push({
        startLineNumber: lastValueEnd.line,
        startColumn: lastValueEnd.column,
        endLineNumber: lastValueEnd.line,
        endColumn: lastValueEnd.column + 1,
        message: "此值后缺少英文逗号“,”",
      });
    }
    if (previousTokenIsValue() && (propertyKey || whitespaceHadNewline || container === "[")) newline();
    else if (!lineStart && lastKind !== "open" && lastKind !== "colon" && lastKind !== "comma") write(" ");
    write(value);
    lastValueEnd = { line: outputLine, column: Math.max(1, outputColumn() - 1) };
    lastKind = "value";
    whitespaceHadNewline = false;
  };

  while (index < source.length) {
    const character = source[index];
    if (/\s/u.test(character)) {
      whitespaceHadNewline ||= character === "\n" || character === "\r";
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      const quote = character;
      let end = index + 1;
      let escaped = false;
      while (end < source.length) {
        const current = source[end];
        end += 1;
        if (escaped) escaped = false;
        else if (current === "\\") escaped = true;
        else if (current === quote) break;
      }
      const propertyKey = openStack[openStack.length - 1]?.character === "{"
        && nextNonWhitespaceCharacter(source, end) === ":";
      writeValue(source.slice(index, end), propertyKey);
      index = end;
      continue;
    }

    if (character === "/" && source[index + 1] === "/") {
      const end = source.indexOf("\n", index);
      if (!lineStart && lastKind !== "open" && lastKind !== "comma") write(" ");
      write(source.slice(index, end < 0 ? source.length : end).trimEnd());
      lastKind = "comment";
      newline();
      index = end < 0 ? source.length : end + 1;
      whitespaceHadNewline = false;
      continue;
    }

    if (character === "/" && source[index + 1] === "*") {
      const closing = source.indexOf("*/", index + 2);
      const end = closing < 0 ? source.length : closing + 2;
      if (!lineStart && lastKind !== "open" && lastKind !== "comma") write(" ");
      write(source.slice(index, end));
      lastKind = "comment";
      newline();
      index = end;
      whitespaceHadNewline = false;
      continue;
    }

    if (character === "{" || character === "[") {
      if (previousTokenIsValue() && whitespaceHadNewline) newline();
      else if (!lineStart && lastKind !== "colon" && lastKind !== "comma" && lastKind !== "open") write(" ");
      write(character);
      const expectedClose = character === "{" ? "}" : "]";
      const expanded = nextNonWhitespaceCharacter(source, index + 1) !== expectedClose;
      openStack.push({ character, expanded });
      if (expanded) {
        indent += 1;
        newline();
      }
      lastKind = "open";
      whitespaceHadNewline = false;
      index += 1;
      continue;
    }

    if (character === "}" || character === "]") {
      const opened = openStack.pop();
      if (opened?.expanded) {
        indent = Math.max(0, indent - 1);
        if (!lineStart) newline();
      }
      write(character);
      lastValueEnd = { line: outputLine, column: Math.max(1, outputColumn() - 1) };
      lastKind = "close";
      whitespaceHadNewline = false;
      index += 1;
      continue;
    }

    if (character === ",") {
      trimLineEnd();
      write(",");
      lastKind = "comma";
      newline();
      whitespaceHadNewline = false;
      index += 1;
      continue;
    }

    if (character === ":") {
      trimLineEnd();
      write(": ");
      lastKind = "colon";
      whitespaceHadNewline = false;
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < source.length && !/[\s{}\[\],:'"/]/u.test(source[end])) end += 1;
    writeValue(source.slice(index, end));
    index = end;
  }

  trimLineEnd();
  const formatted = output.replace(/\n{3,}/gu, "\n\n");
  return trailingNewline && !formatted.endsWith("\n") ? `${formatted}\n` : formatted;
}

function looksLikeJavaScriptObjectLiteral(source: string) {
  return /(?:^|[,{]\s*)[A-Za-z_$][\w$]*\s*:/mu.test(source)
    || /=>|\b(?:undefined|NaN|Infinity)\b/u.test(source)
    || /'(?:[^'\\]|\\.)*'/u.test(source);
}

interface TopLevelArrayParts {
  items: string[];
  trailingComma: boolean;
  trailingSemicolon: boolean;
  trailingNewline: boolean;
}

function splitTopLevelArrayItems(source: string): TopLevelArrayParts | null {
  const trimmedStart = source.search(/\S/u);
  if (trimmedStart < 0 || source[trimmedStart] !== "[") return null;
  const closingIndex = source.lastIndexOf("]");
  if (closingIndex <= trimmedStart) return null;
  const suffix = source.slice(closingIndex + 1).trim();
  if (suffix && suffix !== ";") return null;

  const bodyStart = trimmedStart + 1;
  const body = source.slice(bodyStart, closingIndex);
  const items: string[] = [];
  let itemStart = 0;
  let curlyDepth = 0;
  let squareDepth = 0;
  let parenthesisDepth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    const next = body[index + 1];
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
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") curlyDepth += 1;
    else if (character === "}") curlyDepth = Math.max(0, curlyDepth - 1);
    else if (character === "[") squareDepth += 1;
    else if (character === "]") squareDepth = Math.max(0, squareDepth - 1);
    else if (character === "(") parenthesisDepth += 1;
    else if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    else if (character === "," && curlyDepth === 0 && squareDepth === 0 && parenthesisDepth === 0) {
      const item = body.slice(itemStart, index).trim();
      if (item) items.push(item);
      itemStart = index + 1;
    }
  }

  const finalItem = body.slice(itemStart).trim();
  if (finalItem) items.push(finalItem);
  const trailingComma = /,\s*$/u.test(body);
  return {
    items,
    trailingComma,
    trailingSemicolon: suffix === ";",
    trailingNewline: /\r?\n$/u.test(source),
  };
}

function indentPreservedArrayItem(source: string) {
  const lines = source.replace(/\r\n?/gu, "\n").trim().split("\n");
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^[ \t]*/u)?.[0].length ?? 0);
  const commonIndent = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => `  ${line.slice(commonIndent).trimEnd()}`).join("\n");
}

function unwrapFormattedArrayItem(source: string) {
  const openingIndex = source.indexOf("[");
  const closingIndex = source.lastIndexOf("]");
  if (openingIndex < 0 || closingIndex <= openingIndex) return "";
  return source
    .slice(openingIndex + 1, closingIndex)
    .replace(/^\s*\n/u, "")
    .replace(/\n\s*$/u, "")
    .replace(/,\s*$/u, "");
}

async function formatJavaScriptLikeArrayPartially(
  source: string,
  filePath?: string,
): Promise<PartialFormatResult | null> {
  const parts = splitTopLevelArrayItems(source);
  if (!parts?.items.length) return null;
  const results = await Promise.all(parts.items.map(async (item) => {
    try {
      const wrapped = await formatWithPrettier("typescript", `[${item}]`, filePath);
      const body = unwrapFormattedArrayItem(wrapped);
      return { body, error: null as unknown };
    } catch (error) {
      return { body: indentPreservedArrayItem(item), error };
    }
  }));
  const formattedCount = results.filter(({ error }) => error === null).length;
  if (formattedCount === 0) return null;

  const diagnostics: FormatTextDiagnostic[] = [];
  let outputLine = 2;
  const bodies = results.map(({ body, error }, index) => {
    const withComma = `${body.replace(/,\s*$/u, "")}${index < results.length - 1 || parts.trailingComma ? "," : ""}`;
    if (error !== null) {
      const parsed = diagnosticFromFormatError(error);
      const lines = withComma.split("\n");
      const relativeLine = Math.min(lines.length, Math.max(1, parsed?.startLineNumber ?? 1));
      const lineText = lines[relativeLine - 1] ?? "";
      const startColumn = Math.min(Math.max(1, parsed?.startColumn ?? 3), Math.max(1, lineText.length));
      diagnostics.push({
        startLineNumber: outputLine + relativeLine - 1,
        startColumn,
        endLineNumber: outputLine + relativeLine - 1,
        endColumn: startColumn + 1,
        message: parsed?.message ?? "此 TypeScript 片段存在语法错误，已保留原文",
      });
    }
    outputLine += withComma.split("\n").length;
    return withComma;
  });
  const suffix = `${parts.trailingSemicolon ? ";" : ""}${parts.trailingNewline ? "\n" : ""}`;
  return { content: `[\n${bodies.join("\n")}\n]${suffix}`, diagnostics };
}

async function formatByIndependentSections(
  language: NoteLanguage,
  source: string,
  filePath?: string,
): Promise<string> {
  const sections = source.split(/(\r?\n[ \t]*\r?\n+)/u);
  const formattedSections = await Promise.all(sections.map(async (section, index) => {
    if (index % 2 === 1 || !section.trim()) return section.replace(/\r\n?/gu, "\n");
    const leading = section.match(/^\s*/u)?.[0] ?? "";
    const trailing = section.match(/\s*$/u)?.[0] ?? "";
    const body = section.slice(leading.length, section.length - trailing.length);
    try {
      const formatted = await formatTextStrict(language, body, filePath);
      return `${leading.replace(/\r\n?/gu, "\n")}${formatted.trimEnd()}${trailing.replace(/\r\n?/gu, "\n")}`;
    } catch {
      return formatConservatively(section);
    }
  }));
  return formattedSections.join("");
}

interface PartialFormatResult {
  content: string;
  diagnostics: FormatTextDiagnostic[];
}

function diagnosticFromFormatError(error: unknown): FormatTextDiagnostic | null {
  const detail = error instanceof Error ? error.message : String(error);
  const position = detail.match(/\((\d+):(\d+)\)/u) ?? detail.match(/(?:^|\s)(\d+):(\d+)(?:\s|$)/u);
  const location = (error as {
    loc?: { start?: { line?: number; column?: number }; line?: number; column?: number };
  } | null)?.loc;
  const line = position ? Number(position[1]) : location?.start?.line ?? location?.line;
  const column = position ? Number(position[2]) : location?.start?.column ?? location?.column;
  if (!line || column === undefined) return null;
  const startColumn = Math.max(1, column);
  return {
    startLineNumber: Math.max(1, line),
    startColumn,
    endLineNumber: Math.max(1, line),
    endColumn: startColumn + 1,
    message: detail.split(/\r?\n/u)[0].replace(/\s*\(\d+:\d+\)\s*$/u, ""),
  };
}

async function formatTextPartially(
  language: NoteLanguage,
  source: string,
  filePath?: string,
): Promise<PartialFormatResult> {
  if (language === "json" || language === "jsonc") {
    const diagnostics: FormatTextDiagnostic[] = [];
    return { content: formatJsonTolerantly(source, diagnostics), diagnostics };
  }
  if (language === "jsonl") {
    const trailingNewline = source.endsWith("\n");
    const lines = source.split(/\r?\n/u);
    const diagnostics: FormatTextDiagnostic[] = [];
    if (trailingNewline) lines.pop();
    const formatted = lines.map((line, index) => {
      if (!line.trim()) return "";
      try {
        return JSON.stringify(JSON.parse(line));
      } catch (error) {
        const diagnostic = diagnosticFromFormatError(error);
        diagnostics.push({
          startLineNumber: index + 1,
          startColumn: diagnostic?.startColumn ?? 1,
          endLineNumber: index + 1,
          endColumn: diagnostic?.endColumn ?? Math.max(2, line.length + 1),
          message: diagnostic?.message ?? "此行不是有效的 JSON",
        });
        return formatJsonTolerantly(line);
      }
    }).join("\n");
    return { content: trailingNewline ? `${formatted}\n` : formatted, diagnostics };
  }
  if (language in PRETTIER_PARSERS || SERVER_TEMPLATE_LANGUAGES.has(language)) {
    return { content: await formatByIndependentSections(language, source, filePath), diagnostics: [] };
  }
  return { content: formatConservatively(source), diagnostics: [] };
}

export async function formatText(
  language: NoteLanguage,
  source: string,
  filePath?: string,
): Promise<FormatTextResult> {
  try {
    return { content: await formatTextStrict(language, source, filePath), partial: false, diagnostics: [] };
  } catch (error) {
    let errorDetail = error instanceof Error ? error.message : String(error);
    if ((language === "json" || language === "jsonc") && looksLikeJavaScriptObjectLiteral(source)) {
      try {
        return {
          content: await formatWithPrettier("typescript", source, filePath),
          partial: false,
          diagnostics: [],
          formattedAs: "typescript",
        };
      } catch (typescriptError) {
        errorDetail = typescriptError instanceof Error ? typescriptError.message : String(typescriptError);
        const partialTypeScriptResult = await formatJavaScriptLikeArrayPartially(source, filePath);
        if (partialTypeScriptResult) {
          return {
            ...partialTypeScriptResult,
            partial: true,
            errorDetail,
            formattedAs: "typescript",
          };
        }
      }
    }
    const partialResult = await formatTextPartially(language, source, filePath);
    const primaryDiagnostic = diagnosticFromFormatError(error);
    return {
      content: partialResult.content,
      partial: true,
      errorDetail,
      diagnostics: partialResult.diagnostics.length
        ? partialResult.diagnostics
        : primaryDiagnostic ? [primaryDiagnostic] : [],
    };
  }
}
