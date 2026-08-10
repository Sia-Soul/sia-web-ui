declare module "*?worker" {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}

declare module "monaco-editor/editor/contrib/clipboard/browser/clipboard.js";
declare module "monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js";
declare module "monaco-editor/editor/contrib/find/browser/findController.js";
declare module "monaco-editor/editor/contrib/gotoError/browser/gotoError.js";
declare module "monaco-editor/editor/contrib/hover/browser/hoverContribution.js";
declare module "monaco-editor/editor/contrib/suggest/browser/suggestController.js";
declare module "monaco-editor/nls/lang/zh-cn.js";
