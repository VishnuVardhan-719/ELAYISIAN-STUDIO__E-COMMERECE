import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createExpoAccounts, prepareExpoDatabase } from "../src/expoSetup";

async function main() {
  const config = dotenv.parse(readFileSync(resolve("backend/.env")));
  const connection = await mongoose.createConnection(config.MONGODB_URI, { dbName: "elysian_expo" }).asPromise();
  try {
    if (await connection.collection("users").countDocuments({ id: /^expo-/ }))
      throw new Error("Expo users already exist.");
    const accounts = createExpoAccounts();
    const destination = resolve("backend/.env.expo-accounts");
    writeFileSync(destination, JSON.stringify({ accounts }, null, 2), { flag: "wx" });
    await prepareExpoDatabase(connection, accounts);
    mkdirSync(resolve(".context/verification"), { recursive: true });
    console.log("Expo accounts and ₹1 product created in elysian_expo.");
    console.log(`Private account details saved at ${destination}; values not logged.`);
  } finally {
    await connection.close();
  }
}

main().catch(() => {
  console.error("Expo setup stopped. Preserve the private account file; inspect database before retrying.");
  process.exitCode = 1;
});