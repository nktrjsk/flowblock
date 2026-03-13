import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), basicSsl()],
  server: { host: true },
  optimizeDeps: {
    exclude: ["@evolu/react-web"],
  },
});
