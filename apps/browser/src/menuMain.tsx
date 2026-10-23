import React from "react";
import ReactDOM from "react-dom/client";
import "@sia.soul/sia-react-ui/styles.css";
import BrowserMenuWindow from "./components/BrowserMenuWindow";
import BrowserTabTooltipWindow from "./components/BrowserTabTooltip";
import "./styles.css";
import "./shellContextMenu";

document.documentElement.classList.add("browser-menu-document");
document.body.classList.add("browser-menu-document__body");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 提示窗口复用轻量入口和框架样式，不加载浏览器主界面。 */}
    {new URLSearchParams(window.location.search).has("tab-tooltip") ? <BrowserTabTooltipWindow /> : <BrowserMenuWindow />}
  </React.StrictMode>,
);
