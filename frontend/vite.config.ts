import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    proxy: { "/api": process.env.API_PROXY_TARGET || "http://127.0.0.1:4000" },
  },
  preview: {
    proxy: { "/api": process.env.API_PROXY_TARGET || "http://127.0.0.1:4000" },
  },
  test: {
    name: "frontend",
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
