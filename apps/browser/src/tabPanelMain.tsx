import React from "react";
import ReactDOM from "react-dom/client";
import "@sia.soul/sia-react-ui/styles.css";
import BrowserTabPanelWindow from "./components/BrowserTabPanelWindow";
import "./styles.css";

document.documentElement.classList.add("browser-tab-panel-document");
document.body.classList.add("browser-tab-panel-document__body");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserTabPanelWindow />
  </React.StrictMode>,
);
