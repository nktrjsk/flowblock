import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// After Evolu owner restore, it navigates to "/" — redirect back to the app's base path.
const restoreRedirect = sessionStorage.getItem("evolu-restore-redirect");
if (restoreRedirect && window.location.pathname !== restoreRedirect) {
  sessionStorage.removeItem("evolu-restore-redirect");
  window.location.replace(restoreRedirect);
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
