/**
 * Separate from vite.config.ts to keep the dev-server config (proxy, etc.)
 * free of test-only concerns. Component smoke tests (render + a11y checks)
 * for the reusable UI library live in src/**\/*.test.tsx.
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
