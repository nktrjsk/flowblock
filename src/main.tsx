import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// After Evolu owner restore, it navigates to "/" — redirect back to the app's base path.
const restoreRedirect = sessionStorage.getItem("evolu-restore-redirect");
sessionStorage.removeItem("evolu-restore-redirect");
const isSafeRelativePath = typeof restoreRedirect === "string" && /^\/[^/\\]/.test(restoreRedirect);
if (isSafeRelativePath && window.location.pathname !== restoreRedirect) {
  window.location.replace(restoreRedirect);
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
