import { fileURLToPath } from "node:url";
import { connectDb } from "../../database/src/db";
import { createApp } from "./app";
import { env } from "./env";
import { startupFailure } from "./startupError";

async function start(): Promise<void> {
  await connectDb();
  const app = createApp({ staticDir: fileURLToPath(new URL("../../frontend/dist/", import.meta.url)) });
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`[api] listening on port ${env.port}`);
  });
}

start().catch((error: unknown) => {
  console.error(startupFailure(error));
  process.exit(1);
});