import mongoose, { type Connection } from "mongoose";
import { compareSync } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareExpoDatabase } from "../../database/src/expoSetup";

describe("expo database preparation", () => {
  let connection: Connection;
  beforeAll(async () => {
    connection = await mongoose.createConnection("mongodb://127.0.0.1:27017/elysian_test_expo_setup").asPromise();
    await connection.dropDatabase();
    await connection.collection("users").insertOne({ id: "old-admin", email: "old@example.test", passwordHash: "known-hash", role: "admin" });
    await connection.collection("creators").insertOne({ id: "mira", name: "Mira Sen" });
    await connection.collection("categories").insertOne({ id: "paper", name: "Paper" });
  });
  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  it("adds the three roles and the ₹1 product while rotating copied known credentials", async () => {
    const credentials = await prepareExpoDatabase(connection);
    expect(credentials.accounts.map((account) => account.name)).toEqual(["Vishnu", "Amrutha", "Akshita"]);
    expect(new Set(credentials.accounts.map((account) => account.password)).size).toBe(3);
    for (const account of credentials.accounts) {
      expect(account.password.length).toBeGreaterThanOrEqual(16);
      const stored = await connection.collection("users").findOne({ id: account.id });
      expect(compareSync(account.password, stored!.passwordHash)).toBe(true);
      expect(stored?.role).toBe(account.role);
      expect(stored?.password).toBeUndefined();
    }
    expect(await connection.collection("users").findOne({ id: "old-admin" })).not.toHaveProperty("passwordHash", "known-hash");
    const product = await connection.collection("products").findOne({ id: "expo-demo-bookmark" });
    expect(product).toMatchObject({ price: 1, creatorId: "mira", status: "active", stock: 100 });
    expect(product?.images[0]).toBe("/images/expo-bookmark.svg");
    expect(await connection.collection("users").findOne({ id: "expo-creator" })).toHaveProperty("creatorId", "mira");
  });

  it("refuses a repeat rather than unexpectedly resetting passwords or stock", async () => {
    await connection.collection("products").updateOne({ id: "expo-demo-bookmark" }, { $set: { stock: 99 } });
    await expect(prepareExpoDatabase(connection)).rejects.toThrow("already prepared");
    expect(await connection.collection("products").findOne({ id: "expo-demo-bookmark" })).toHaveProperty("stock", 99);
  });
});