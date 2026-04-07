import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { evolu } from "./db/evolu";

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__evolu = evolu;
}


const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
