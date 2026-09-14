import React from "react";
import ReactDOM from "react-dom/client";
import "@sia.soul/sia-react-ui/styles.css";
import App from "./App";
import "./styles.css";

function preventWebViewRefresh(event: KeyboardEvent) {
  const modifierPressed = event.ctrlKey || event.metaKey;
  const isRefreshShortcut = event.key === "F5"
    || (modifierPressed && event.key.toLowerCase() === "r");
  if (isRefreshShortcut) event.preventDefault();
}

window.addEventListener("keydown", preventWebViewRefresh, { capture: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
