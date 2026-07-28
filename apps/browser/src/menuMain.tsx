import React from "react";
import ReactDOM from "react-dom/client";
import "@sia-ui/react/styles.css";
import BrowserMenuWindow from "./components/BrowserMenuWindow";
import "./styles.css";

document.documentElement.classList.add("browser-menu-document");
document.body.classList.add("browser-menu-document__body");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserMenuWindow />
  </React.StrictMode>,
);
