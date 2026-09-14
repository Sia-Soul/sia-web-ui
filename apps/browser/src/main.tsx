import React from "react";
import ReactDOM from "react-dom/client";
import "@sia.soul/sia-react-ui/styles.css";
import App from "./App";
import BrowserMenuWindow from "./components/BrowserMenuWindow";
import BrowserOverlayWindow from "./components/BrowserOverlayWindow";
import BrowserTabPanelWindow from "./components/BrowserTabPanelWindow";
import "./styles.css";

async function resolveCurrentWindowLabel() {
  const globalLabel = window.__TAURI__?.window?.getCurrentWindow().label;
  if (globalLabel) return globalLabel;
  if (!window.__TAURI__) return "main";
  return window.__TAURI__.core.invoke<string>("current_window_label");
}

async function renderApplication() {
  const searchParams = new URLSearchParams(window.location.search);
  const windowMode = window.location.hash.replace(/^#\/?/, "");
  const currentWindowLabel = await resolveCurrentWindowLabel().catch(() => "main");
  const injectedWindowMode = window.__SIA_WINDOW_MODE__;
  const browserOverlayMode =
    injectedWindowMode === "browser-overlay" ||
    currentWindowLabel === "browser-overlay" ||
    windowMode === "browser-overlay" ||
    searchParams.has("browser-overlay");
  const browserMenuMode =
    injectedWindowMode === "browser-menu" ||
    currentWindowLabel === "browser-menu" ||
    windowMode === "browser-menu" ||
    searchParams.has("browser-menu");
  const browserTabPanelMode =
    injectedWindowMode === "browser-tab-panel" ||
    currentWindowLabel === "sia-tab-panel-window" ||
    currentWindowLabel === "browser-tab-panel" ||
    windowMode === "browser-tab-panel" ||
    searchParams.has("browser-tab-panel");

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
}

void renderApplication();
