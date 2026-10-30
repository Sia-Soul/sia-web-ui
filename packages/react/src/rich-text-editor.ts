import { initializeDefaultScrollbars } from "./components/FloatingScrollbarProvider";

// 浏览器入口默认接管滚动容器，服务端导入不访问 DOM。
initializeDefaultScrollbars();

export { RichTextContent, RichTextEditor } from "./components/RichTextEditor";
export type { RichTextContentFormat, RichTextContentProps, RichTextEditorProps, RichTextImagePasteHandler, RichTextToolbar } from "./components/RichTextEditor";
