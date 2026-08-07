import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server + proxy so the frontend can reach the FastAPI backend at /api
// without hardcoding a host. Under docker-compose the frontend and backend
// run in separate containers, so "localhost" from inside the frontend
// container refers to the frontend container itself, not the backend
// (that's what produced ECONNREFUSED 127.0.0.1:8000 in the proxy). The
// backend is reachable there via its compose service name instead. Set
// BACKEND_URL (see docker-compose.yml) to override; running the frontend
// directly on the host still defaults to localhost.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
