declare module "*?worker" {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}

declare module "monaco-editor/editor/contrib/clipboard/browser/clipboard.js";
declare module "monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js";
