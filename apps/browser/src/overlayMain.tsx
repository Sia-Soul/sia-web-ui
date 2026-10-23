import React from "react";
import ReactDOM from "react-dom/client";
import "@sia.soul/sia-react-ui/styles.css";
import BrowserOverlayWindow from "./components/BrowserOverlayWindow";
import "./styles.css";
import "./shellContextMenu";

document.documentElement.classList.add("browser-overlay-document");
document.body.classList.add("browser-overlay-document__body");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserOverlayWindow />
  </React.StrictMode>,
);
