import type { Plugin } from "prettier";
import { LANGUAGE_OPTIONS, type NoteLanguage } from "./languages";

export const FORMATTABLE_LANGUAGES: ReadonlySet<NoteLanguage> = new Set(
  LANGUAGE_OPTIONS.map(({ key }) => key),
);

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

export async function formatText(language: NoteLanguage, source: string, filePath?: string): Promise<string> {
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
