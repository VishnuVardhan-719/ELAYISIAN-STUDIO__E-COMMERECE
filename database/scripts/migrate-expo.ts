import { resolve } from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { migrateDatabase } from "../src/migration";

dotenv.config({ path: resolve("backend/.env"), quiet: true });
dotenv.config({ path: resolve("backend/.env.migration"), quiet: true });

async function main() {
  const uri = process.env.MIGRATION_TARGET_URI || process.env.MONGODB_URI;
  if (!uri || !uri.startsWith("mongodb+srv://"))
    throw new Error("An Atlas destination URI is required.");
  const source = await mongoose.createConnection("mongodb://127.0.0.1:27017/elysian", { serverSelectionTimeoutMS: 10000 }).asPromise();
  let target;
  try {
    target = await mongoose.createConnection(uri, { dbName: "elysian_expo", serverSelectionTimeoutMS: 15000 }).asPromise();
    const backup = resolve(".scratch", "backups", `elysian-${Date.now()}`);
    const result = await migrateDatabase(source, target, backup);
    console.log(JSON.stringify({ backup, destination: target.name, ...result }, null, 2));
  } finally {
    await target?.close();
    await source.close();
  }
}

main().catch(() => {
  console.error("Migration failed. No source records were changed. Inspect target and private backup before retrying.");
  process.exitCode = 1;
});