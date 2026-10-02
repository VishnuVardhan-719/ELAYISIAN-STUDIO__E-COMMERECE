import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";
import type { ClientSession, Connection } from "mongoose";

export interface ExpoAccount { id: string; name: string; email: string; role: string; password: string }

export function createExpoAccounts(): ExpoAccount[] {
  return [
    { id: "expo-admin", name: "Vishnu", email: "vishnu@example.test", role: "admin" },
    { id: "expo-creator", name: "Amrutha", email: "amrutha@example.test", role: "creator" },
    { id: "expo-customer", name: "Akshita", email: "akshita@example.test", role: "customer" },
  ].map((account) => ({ ...account, password: randomBytes(18).toString("base64url") }));
}

export async function prepareExpoDatabase(connection: Connection, accounts = createExpoAccounts()): Promise<{ accounts: ExpoAccount[] }> {
  if (!connection.db) throw new Error("Database must be connected.");
  if (connection.name !== "elysian_expo" && !connection.name.startsWith("elysian_test_"))
    throw new Error("Expo preparation is restricted to the dedicated expo database.");
  const users = connection.collection("users");
  if (await users.countDocuments({ id: { $in: accounts.map(({ id }) => id) } }))
    throw new Error("Expo database is already prepared; refusing credential reset.");
  const creator = await connection.collection("creators").findOne({ id: "mira" });
  const category = await connection.collection("categories").findOne({}) ;
  if (!creator || !category) throw new Error("Migrate the catalogue before expo preparation.");
  const previousUsers = await users.find().toArray();
  const oldHashes = previousUsers.map(({ _id }) => ({ _id, hash: hashSync(randomBytes(24).toString("base64url"), 10) }));
  const hashed = accounts.map(({ password, ...account }) => ({
    ...account, passwordHash: hashSync(password, 10),
    ...(account.role === "creator" ? { creatorId: creator.id } : {}),
  }));
  const populate = async (session?: ClientSession) => {
    for (const { _id, hash } of oldHashes)
      await users.updateOne({ _id }, { $set: { passwordHash: hash } }, { session });
    await users.insertMany(hashed, { session });
    await connection.collection("products").insertOne({
      id: "expo-demo-bookmark", name: "Expo Demo Bookmark", creatorId: creator.id,
      categoryId: category.id, price: 1, images: ["/images/expo-bookmark.svg"],
      description: "A ₹1 expo demonstration bookmark. Razorpay sandbox checkout only; no real money is charged. Free stall pickup.",
      material: "Paper", dimensions: "5 × 15 cm", stock: 100, status: "active", featured: true,
    }, { session });
  };
  const hello = await connection.db.admin().command({ hello: 1 });
  if (hello.setName || hello.msg === "isdbgrid") await connection.transaction(populate);
  else await populate();
  return { accounts };
}