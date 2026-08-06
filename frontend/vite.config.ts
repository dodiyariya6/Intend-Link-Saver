import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Scaffolding only: dev server + proxy so the frontend can reach the
// FastAPI backend at /api without hardcoding a host during local dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
