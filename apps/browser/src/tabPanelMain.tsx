import React from "react";
import ReactDOM from "react-dom/client";
import "@sia.soul/sia-react-ui/styles.css";
import BrowserTabPanelWindow from "./components/BrowserTabPanelWindow";
import "./styles.css";
import "./shellContextMenu";
// 原生侧栏独立于主文档，也需要接收外部链接和 HTML 文件。
import "../src-tauri/src/browser_drop.js";

document.documentElement.classList.add("browser-tab-panel-document");
document.body.classList.add("browser-tab-panel-document__body");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserTabPanelWindow />
  </React.StrictMode>,
);
