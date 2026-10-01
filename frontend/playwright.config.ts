import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run seed && node --import tsx backend/src/index.ts",
      cwd: repositoryRoot,
      url: "http://127.0.0.1:4001/api/health",
      env: {
        NODE_ENV: "test",
        PORT: "4001",
        MONGODB_URI: "mongodb://127.0.0.1:27017/elysian_e2e",
        JWT_SECRET: "elysian-e2e-isolated-test-secret",
        CLIENT_ORIGIN: "http://127.0.0.1:5174",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort",
      cwd: repositoryRoot,
      url: "http://127.0.0.1:5174",
      env: {
        NODE_ENV: "development",
        VITE_API_MODE: "rest",
        API_PROXY_TARGET: "http://127.0.0.1:4001",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: fileURLToPath(new URL("./playwright-report", import.meta.url)) }]],
});
