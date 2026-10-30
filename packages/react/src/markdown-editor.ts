import { initializeDefaultScrollbars } from "./components/FloatingScrollbarProvider";

// 浏览器入口默认接管滚动容器，服务端导入不访问 DOM。
initializeDefaultScrollbars();

export { MarkdownEditor } from "./components/MarkdownEditor";
export type {
  MarkdownEditorMode,
  MarkdownEditorProps,
} from "./components/MarkdownEditor";
