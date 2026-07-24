import React from "react";
import ReactDOM from "react-dom/client";
import "@sia-ui/react/styles.css";
import App from "./App";
import BrowserMenuWindow from "./components/BrowserMenuWindow";
import BrowserOverlayWindow from "./components/BrowserOverlayWindow";
import BrowserTabPanelWindow from "./components/BrowserTabPanelWindow";
import "./styles.css";

const searchParams = new URLSearchParams(window.location.search);
const browserOverlayMode = searchParams.has("browser-overlay");
const browserMenuMode = searchParams.has("browser-menu");
const browserTabPanelMode = searchParams.has("browser-tab-panel");
if (browserOverlayMode) {
  document.documentElement.classList.add("browser-overlay-document");
  document.body.classList.add("browser-overlay-document__body");
} else if (browserMenuMode) {
  document.documentElement.classList.add("browser-menu-document");
  document.body.classList.add("browser-menu-document__body");
} else if (browserTabPanelMode) {
  document.documentElement.classList.add("browser-tab-panel-document");
  document.body.classList.add("browser-tab-panel-document__body");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {browserOverlayMode
      ? <BrowserOverlayWindow />
      : browserMenuMode
        ? <BrowserMenuWindow />
        : browserTabPanelMode
          ? <BrowserTabPanelWindow />
          : <App />}
  </React.StrictMode>,
);
