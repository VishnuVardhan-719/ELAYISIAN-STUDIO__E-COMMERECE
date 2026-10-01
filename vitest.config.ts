import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["frontend/vite.config.ts", "backend/vitest.config.ts"],
  },
});