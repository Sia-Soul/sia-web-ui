import { useRef, useState } from "react";
import { Editor, Markdown, MarkdownEditor, RichTextContent, RichTextEditor, Space, Switch, Typography } from "@sia.soul/sia-react-ui";
import type { EditorHandle } from "@sia.soul/sia-react-ui";

/** 编辑器补全、诊断、快捷键与富文本占位提示。 */
export function EditorExamples() {
  const [value, setValue] = useState("SELECT name FROM users;");
  const [disabled, setDisabled] = useState(false);
  const [event, setEvent] = useState("等待编辑器初始化");
  const api = useRef<EditorHandle | null>(null);
  const range = { startLineNumber: 1, startColumn: 8, endLineNumber: 1, endColumn: 12 };
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Switch checked={disabled} onCheckedChange={setDisabled} label="禁用 Markdown 编辑器" />
    <div style={{ height: 260 }}><Editor value={value} onChange={setValue} language="sql" theme="dark" onReady={instance => { api.current = instance; }} onSelectionChange={selection => setEvent(`选中：${selection.text}`)} onKeyDown={event => { if (event.ctrlKey && event.key.toLowerCase() === "s") { event.preventDefault(); setEvent(`保存：${api.current?.getValue()}`); } }} highlightRange={range} markers={[{ ...range, message: "示例字段说明", severity: "info", source: "样例诊断" }]} contextMenuItems={[{ key: "all", label: "选择全部", command: "selectAll" }, { key: "insert", label: "插入条件", onClick: instance => instance.insertBlock(" WHERE active = 1") }]} completionProvider={context => [{ label: "users", insertText: "users", kind: "table", detail: `当前单词：${context.word}`, documentation: "用户表" }]} completionTriggerCharacters={[".", " "]} refreshSuggestionOnSpace className="property-editor" loadingText="正在初始化代码编辑器…" /></div>
    <RichTextEditor placeholder="编辑正文" placeholderMode="floating" pasteImageHint="此例不上传图片，请使用图片链接" />
    <RichTextContent content="" emptyText="尚未填写正文" />
    {/* 空资源根路径使用内置版本；私有部署时替换为包含 dist/index.min.js 的资源根目录。 */}
    <MarkdownEditor placeholderMode="floating" placeholder="Markdown 正文" disabled={disabled} assetBaseUrl="" defaultValue="## 示例标题" />
    <Markdown content="![本地示例](demo.svg)" resolveImageSrc={() => "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="4" y="25">SiaWebUI</text></svg>')} imagePreview />
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
