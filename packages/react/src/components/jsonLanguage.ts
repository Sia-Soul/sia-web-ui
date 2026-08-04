import type * as Monaco from "monaco-editor";

let registered = false;

export function registerJsonLanguage(monaco: {
  languages: Pick<typeof Monaco.languages, "getLanguages" | "register" | "setMonarchTokensProvider">;
}) {
  if (registered || monaco.languages.getLanguages().some(({ id }) => id === "json")) {
    registered = true;
    return;
  }

  monaco.languages.register({
    id: "json",
    extensions: [".json"],
    aliases: ["JSON", "json"],
    mimetypes: ["application/json"],
  });
  monaco.languages.setMonarchTokensProvider("json", {
    tokenPostfix: ".json",
    brackets: [
      { open: "{", close: "}", token: "delimiter.bracket" },
      { open: "[", close: "]", token: "delimiter.array" },
    ],
    tokenizer: {
      root: [
        [/\s+/, "white"],
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/, "string.key"],
        [/"(?:[^"\\]|\\.)*"/, "string.value"],
        [/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
        [/\b(?:true|false|null)\b/, "keyword"],
        [/[{}\[\]]/, "@brackets"],
        [/[,:]/, "delimiter"],
      ],
    },
  });
  registered = true;
}
