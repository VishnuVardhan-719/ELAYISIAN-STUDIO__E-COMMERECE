import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mongoose, { type Connection } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "../../database/src/migration";

describe("non-destructive expo migration", () => {
  let source: Connection;
  let target: Connection;
  let backup: string;

  beforeAll(async () => {
    source = await mongoose.createConnection("mongodb://127.0.0.1:27017/elysian_test_migration_source").asPromise();
    target = await mongoose.createConnection("mongodb://127.0.0.1:27017/elysian_test_migration_target").asPromise();
    backup = await mkdtemp(join(tmpdir(), "elysian-backup-"));
  });
  beforeEach(async () => {
    await source.dropDatabase();
    await target.dropDatabase();
    const products = source.collection("products");
    await products.insertOne({ id: "sunset-vase", stock: 5, createdAt: new Date("2026-10-01") });
    await products.createIndex({ id: 1 }, { unique: true, name: "id_1" });
    await source.createCollection("empty");
  });
  afterAll(async () => {
    await source.dropDatabase();
    await target.dropDatabase();
    await source.close();
    await target.close();
    await rm(backup, { recursive: true, force: true });
  });

  it("backs up BSON and indexes before copying without changing the source", async () => {
    const before = await source.collection("products").findOne({ id: "sunset-vase" });
    const result = await migrateDatabase(source, target, join(backup, "copy"));
    expect(result.collections).toEqual(expect.arrayContaining([
      { name: "products", count: 1 }, { name: "empty", count: 0 },
    ]));
    expect(await target.collection("products").findOne({ id: "sunset-vase" })).toEqual(before);
    expect(await source.collection("products").findOne({ id: "sunset-vase" })).toEqual(before);
    expect(await target.collection("products").indexes()).toEqual(await source.collection("products").indexes());
    const manifest = JSON.parse(await readFile(join(backup, "copy", "manifest.json"), "utf8"));
    expect(manifest.sourceDatabase).toBe("elysian_test_migration_source");
    const document = mongoose.mongo.BSON.EJSON.parse(await readFile(join(backup, "copy", "products.json"), "utf8"))[0];
    expect(document.createdAt).toEqual(before?.createdAt);
    expect(document._id).toEqual(before?._id);
  });

  it("refuses an occupied destination and leaves both databases intact", async () => {
    await target.collection("existing").insertOne({ keep: true });
    await expect(migrateDatabase(source, target, join(backup, "occupied"))).rejects.toThrow("destination must be empty");
    expect(await target.collection("existing").countDocuments()).toBe(1);
    expect(await source.collection("products").countDocuments()).toBe(1);
    expect(await target.db!.listCollections().toArray()).toHaveLength(1);
  });

  it("refuses migrating a database onto itself", async () => {
    await expect(migrateDatabase(source, source, join(backup, "same"))).rejects.toThrow("different databases");
  });
});