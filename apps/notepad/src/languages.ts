export const LANGUAGE_OPTIONS = [
  { key: "plaintext", label: "纯文本", monaco: "plaintext", defaultExtension: "txt", extensions: ["txt"] },
  { key: "apdl", label: "APDL", monaco: "plaintext", defaultExtension: "apdl", extensions: ["apdl", "ans", "mac"] },
  { key: "asp", label: "ASP", monaco: "html", defaultExtension: "asp", extensions: ["asp"] },
  { key: "aspx", label: "ASP.NET Web Forms (ASPX)", monaco: "html", defaultExtension: "aspx", extensions: ["aspx", "ascx", "master", "asmx", "ashx"] },
  { key: "razor", label: "ASP.NET Razor / Razor", monaco: "razor", defaultExtension: "cshtml", extensions: ["cshtml", "razor"] },
  { key: "assembly", label: "Assembly", monaco: "mips", defaultExtension: "asm", extensions: ["asm", "s"] },
  { key: "bat", label: "Batch", monaco: "bat", defaultExtension: "bat", extensions: ["bat", "cmd"] },
  { key: "shell", label: "Bash / Shell", monaco: "shell", defaultExtension: "sh", extensions: ["sh", "bash", "zsh", "ksh"] },
  { key: "bibtex", label: "BibTeX", monaco: "plaintext", defaultExtension: "bib", extensions: ["bib"] },
  { key: "c", label: "C", monaco: "c", defaultExtension: "c", extensions: ["c", "h"] },
  { key: "csharp", label: "C#", monaco: "csharp", defaultExtension: "cs", extensions: ["cs"] },
  { key: "cpp", label: "C++", monaco: "cpp", defaultExtension: "cpp", extensions: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"] },
  { key: "clojure", label: "Clojure", monaco: "clojure", defaultExtension: "clj", extensions: ["clj", "cljs", "cljc", "edn"] },
  { key: "cmake", label: "CMake", monaco: "shell", defaultExtension: "cmake", extensions: ["cmake"], filenames: ["cmakelists.txt"] },
  { key: "coffeescript", label: "CoffeeScript", monaco: "coffeescript", defaultExtension: "coffee", extensions: ["coffee"] },
  { key: "css", label: "CSS", monaco: "css", defaultExtension: "css", extensions: ["css"] },
  { key: "cuda", label: "CUDA C++", monaco: "cpp", defaultExtension: "cu", extensions: ["cu", "cuh"] },
  { key: "d", label: "D", monaco: "cpp", defaultExtension: "d", extensions: ["d"] },
  { key: "dart", label: "Dart", monaco: "dart", defaultExtension: "dart", extensions: ["dart"] },
  { key: "diff", label: "Diff", monaco: "plaintext", defaultExtension: "diff", extensions: ["diff", "patch"] },
  { key: "dockerfile", label: "Dockerfile", monaco: "dockerfile", defaultExtension: "dockerfile", extensions: ["dockerfile"], filenames: ["dockerfile"] },
  { key: "dockercompose", label: "Docker Compose", monaco: "yaml", defaultExtension: "yaml", extensions: [], filenames: ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"] },
  { key: "dotenv", label: "Dotenv", monaco: "ini", defaultExtension: "env", extensions: ["env"] },
  { key: "edifact", label: "EDIFACT", monaco: "plaintext", defaultExtension: "edi", extensions: ["edi", "edifact"] },
  { key: "fsharp", label: "F#", monaco: "fsharp", defaultExtension: "fs", extensions: ["fs", "fsi", "fsx", "fsscript"] },
  { key: "fortran", label: "Fortran", monaco: "plaintext", defaultExtension: "f90", extensions: ["f", "for", "f90", "f95", "f03", "f08"] },
  { key: "fortran77", label: "Fortran 77", monaco: "plaintext", defaultExtension: "f77", extensions: ["f77"] },
  { key: "gcode", label: "G-code", monaco: "plaintext", defaultExtension: "gcode", extensions: ["gcode", "nc", "tap"] },
  { key: "go", label: "Go", monaco: "go", defaultExtension: "go", extensions: ["go"] },
  { key: "graphql", label: "GraphQL", monaco: "graphql", defaultExtension: "graphql", extensions: ["graphql", "gql"] },
  { key: "groovy", label: "Groovy", monaco: "java", defaultExtension: "groovy", extensions: ["groovy", "gradle"] },
  { key: "handlebars", label: "Handlebars", monaco: "handlebars", defaultExtension: "hbs", extensions: ["hbs", "handlebars"] },
  { key: "hlsl", label: "HLSL", monaco: "cpp", defaultExtension: "hlsl", extensions: ["hlsl", "fx", "fxh"] },
  { key: "html", label: "HTML", monaco: "html", defaultExtension: "html", extensions: ["html", "htm"] },
  { key: "idl", label: "IDL", monaco: "c", defaultExtension: "idl", extensions: ["idl"] },
  { key: "ini", label: "INI", monaco: "ini", defaultExtension: "ini", extensions: ["ini"] },
  { key: "intelhex", label: "Intel HEX", monaco: "plaintext", defaultExtension: "hex", extensions: ["hex", "ihex"] },
  { key: "java", label: "Java", monaco: "java", defaultExtension: "java", extensions: ["java", "jav"] },
  { key: "javascript", label: "JavaScript", monaco: "javascript", defaultExtension: "js", extensions: ["js", "mjs", "cjs"] },
  { key: "javascriptreact", label: "JavaScript JSX", monaco: "javascript", defaultExtension: "jsx", extensions: ["jsx"] },
  { key: "json", label: "JSON", monaco: "json", defaultExtension: "json", extensions: ["json"] },
  { key: "jsonl", label: "JSON Lines", monaco: "json", defaultExtension: "jsonl", extensions: ["jsonl", "ndjson"] },
  { key: "jsonc", label: "JSON with Comments", monaco: "json", defaultExtension: "jsonc", extensions: ["jsonc"] },
  { key: "jsp", label: "JSP", monaco: "html", defaultExtension: "jsp", extensions: ["jsp", "jspx"] },
  { key: "julia", label: "Julia", monaco: "julia", defaultExtension: "jl", extensions: ["jl"] },
  { key: "juliamarkdown", label: "Julia Markdown", monaco: "markdown", defaultExtension: "jmd", extensions: ["jmd"] },
  { key: "kotlin", label: "Kotlin", monaco: "kotlin", defaultExtension: "kt", extensions: ["kt", "kts"] },
  { key: "latex", label: "LaTeX / TeX", monaco: "plaintext", defaultExtension: "tex", extensions: ["tex", "latex"] },
  { key: "less", label: "Less", monaco: "less", defaultExtension: "less", extensions: ["less"] },
  { key: "lisp", label: "Lisp", monaco: "clojure", defaultExtension: "lisp", extensions: ["lisp", "lsp", "cl"] },
  { key: "log", label: "Log", monaco: "plaintext", defaultExtension: "log", extensions: ["log"] },
  { key: "lua", label: "Lua", monaco: "lua", defaultExtension: "lua", extensions: ["lua"] },
  { key: "makefile", label: "Makefile", monaco: "shell", defaultExtension: "makefile", extensions: ["mk", "mak"], filenames: ["makefile", "gnumakefile"] },
  { key: "markdown", label: "Markdown", monaco: "markdown", defaultExtension: "md", extensions: ["md", "markdown"] },
  { key: "matlab", label: "MATLAB", monaco: "plaintext", defaultExtension: "m", extensions: ["m"] },
  { key: "nsis", label: "NSIS", monaco: "shell", defaultExtension: "nsi", extensions: ["nsi", "nsh"] },
  { key: "objectivec", label: "Objective-C", monaco: "objective-c", defaultExtension: "m", extensions: [] },
  { key: "objectivecpp", label: "Objective-C++", monaco: "cpp", defaultExtension: "mm", extensions: ["mm"] },
  { key: "octave", label: "Octave", monaco: "plaintext", defaultExtension: "m", extensions: [] },
  { key: "pascal", label: "Pascal", monaco: "pascal", defaultExtension: "pas", extensions: ["pas", "p", "pp"] },
  { key: "perl", label: "Perl", monaco: "perl", defaultExtension: "pl", extensions: ["pl", "pm"] },
  { key: "php", label: "PHP", monaco: "php", defaultExtension: "php", extensions: ["php", "phtml"] },
  { key: "po", label: "PO", monaco: "plaintext", defaultExtension: "po", extensions: ["po", "pot"] },
  { key: "postscript", label: "PostScript", monaco: "plaintext", defaultExtension: "ps", extensions: ["ps", "eps"] },
  { key: "povray", label: "POV-Ray", monaco: "plaintext", defaultExtension: "pov", extensions: ["pov"] },
  { key: "powershell", label: "PowerShell", monaco: "powershell", defaultExtension: "ps1", extensions: ["ps1", "psm1", "psd1"] },
  { key: "properties", label: "Properties", monaco: "ini", defaultExtension: "properties", extensions: ["properties"] },
  { key: "protobuf", label: "Protocol Buffers", monaco: "protobuf", defaultExtension: "proto", extensions: ["proto"] },
  { key: "pug", label: "Pug", monaco: "pug", defaultExtension: "pug", extensions: ["pug", "jade"] },
  { key: "python", label: "Python", monaco: "python", defaultExtension: "py", extensions: ["py", "pyw"] },
  { key: "r", label: "R", monaco: "r", defaultExtension: "r", extensions: ["r", "rprofile", "rhistory"] },
  { key: "raku", label: "Raku", monaco: "perl", defaultExtension: "raku", extensions: ["raku", "rakumod", "p6", "pm6"] },
  { key: "rc", label: "RC", monaco: "cpp", defaultExtension: "rc", extensions: ["rc"] },
  { key: "restructuredtext", label: "reStructuredText", monaco: "restructuredtext", defaultExtension: "rst", extensions: ["rst"] },
  { key: "ruby", label: "Ruby", monaco: "ruby", defaultExtension: "rb", extensions: ["rb"] },
  { key: "rust", label: "Rust", monaco: "rust", defaultExtension: "rs", extensions: ["rs"] },
  { key: "scala", label: "Scala", monaco: "scala", defaultExtension: "scala", extensions: ["scala", "sc"] },
  { key: "scss", label: "SCSS", monaco: "scss", defaultExtension: "scss", extensions: ["scss"] },
  { key: "shaderlab", label: "ShaderLab", monaco: "csharp", defaultExtension: "shader", extensions: ["shader"] },
  { key: "solidity", label: "Solidity", monaco: "solidity", defaultExtension: "sol", extensions: ["sol"] },
  { key: "spice", label: "SPICE", monaco: "plaintext", defaultExtension: "spice", extensions: ["spice", "cir"] },
  { key: "sql", label: "SQL", monaco: "sql", defaultExtension: "sql", extensions: ["sql"] },
  { key: "swift", label: "Swift", monaco: "swift", defaultExtension: "swift", extensions: ["swift"] },
  { key: "tcl", label: "Tcl", monaco: "tcl", defaultExtension: "tcl", extensions: ["tcl"] },
  { key: "toml", label: "TOML", monaco: "ini", defaultExtension: "toml", extensions: ["toml"] },
  { key: "typescript", label: "TypeScript", monaco: "typescript", defaultExtension: "ts", extensions: ["ts"] },
  { key: "typescriptreact", label: "TypeScript JSX", monaco: "typescript", defaultExtension: "tsx", extensions: ["tsx"] },
  { key: "vb", label: "Visual Basic", monaco: "vb", defaultExtension: "vb", extensions: ["vb", "vbs"] },
  { key: "vhdl", label: "VHDL", monaco: "plaintext", defaultExtension: "vhd", extensions: ["vhd", "vhdl"] },
  { key: "verilog", label: "Verilog / SystemVerilog", monaco: "verilog", defaultExtension: "v", extensions: ["v", "vh", "sv", "svh"] },
  { key: "vue", label: "Vue", monaco: "html", defaultExtension: "vue", extensions: ["vue"] },
  { key: "wat", label: "WebAssembly Text", monaco: "plaintext", defaultExtension: "wat", extensions: ["wat", "wast"] },
  { key: "wgsl", label: "WGSL", monaco: "wgsl", defaultExtension: "wgsl", extensions: ["wgsl"] },
  { key: "xaml", label: "XAML", monaco: "xml", defaultExtension: "xaml", extensions: ["xaml"] },
  { key: "xml", label: "XML", monaco: "xml", defaultExtension: "xml", extensions: ["xml"] },
  { key: "xsl", label: "XSL", monaco: "xml", defaultExtension: "xsl", extensions: ["xsl", "xslt"] },
  { key: "yaml", label: "YAML", monaco: "yaml", defaultExtension: "yaml", extensions: ["yaml", "yml"] },
] as const;

export type NoteLanguage = (typeof LANGUAGE_OPTIONS)[number]["key"];

export const LANGUAGE_LABELS = new Map<NoteLanguage, string>(
  LANGUAGE_OPTIONS.map(({ key, label }) => [key, label]),
);

export const LANGUAGE_KEYS = new Set<string>(LANGUAGE_OPTIONS.map(({ key }) => key));

const LANGUAGE_BY_EXTENSION = new Map<string, NoteLanguage>();
const LANGUAGE_BY_FILENAME = new Map<string, NoteLanguage>();

for (const language of LANGUAGE_OPTIONS) {
  for (const extension of language.extensions) {
    if (!LANGUAGE_BY_EXTENSION.has(extension)) LANGUAGE_BY_EXTENSION.set(extension, language.key);
  }
  if ("filenames" in language) {
    for (const filename of language.filenames) LANGUAGE_BY_FILENAME.set(filename, language.key);
  }
}

export function isNoteLanguage(value: string): value is NoteLanguage {
  return LANGUAGE_KEYS.has(value);
}

export function languageFromFilename(filename: string): NoteLanguage {
  const normalized = filename.replaceAll("\\", "/").split("/").pop()?.toLocaleLowerCase("en-US") ?? "";
  const exact = LANGUAGE_BY_FILENAME.get(normalized);
  if (exact) return exact;
  if (normalized === ".env" || normalized.startsWith(".env.")) return "dotenv";
  if (normalized.startsWith("dockerfile.")) return "dockerfile";
  if (normalized.startsWith("makefile.")) return "makefile";
  const extension = normalized.split(".").pop() ?? "";
  return LANGUAGE_BY_EXTENSION.get(extension) ?? "plaintext";
}

export function defaultExtensionForLanguage(language: NoteLanguage): string {
  return LANGUAGE_OPTIONS.find(({ key }) => key === language)?.defaultExtension ?? "txt";
}

export function monacoLanguageForNoteLanguage(language: NoteLanguage): string {
  return LANGUAGE_OPTIONS.find(({ key }) => key === language)?.monaco ?? "plaintext";
}

export const SUPPORTED_FILE_EXTENSIONS = [...new Set(
  LANGUAGE_OPTIONS.flatMap(({ extensions }) => [...extensions]),
)].sort();
