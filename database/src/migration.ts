import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import mongoose, { type Connection } from "mongoose";

const { EJSON } = mongoose.mongo.BSON;

function digest(value: unknown): string {
  return createHash("sha256").update(EJSON.stringify(value, { relaxed: false })).digest("hex");
}

export async function migrateDatabase(source: Connection, target: Connection, backup: string): Promise<{ collections: { name: string; count: number }[] }> {
  if (!source.db || !target.db) throw new Error("Both databases must be connected.");
  if (source === target || (source.host === target.host && source.port === target.port && source.name === target.name))
    throw new Error("Migration requires different databases.");
  if ((await target.db.listCollections().toArray()).length)
    throw new Error("Migration destination must be empty; refusing overwrite.");
  const collections = await source.db.listCollections().toArray();
  await mkdir(backup, { recursive: true });
  const snapshots = [];
  for (const info of collections) {
    if (info.type !== "collection" || !/^[a-zA-Z0-9_-]+$/.test(info.name))
      throw new Error("Unsupported collection; migration stopped before copying.");
    const collection = source.db.collection(info.name);
    const documents = await collection.find().sort({ _id: 1 }).toArray();
    const indexes = await collection.indexes();
    const snapshot = { name: info.name, count: documents.length, hash: digest(documents), indexes };
    await writeFile(join(backup, `${info.name}.json`), EJSON.stringify(documents, { relaxed: false }), { flag: "wx" });
    await writeFile(join(backup, `${info.name}.indexes.json`), EJSON.stringify(indexes, { relaxed: false }), { flag: "wx" });
    snapshots.push(snapshot);
  }
  await writeFile(join(backup, "manifest.json"), JSON.stringify({
    sourceDatabase: source.name, destinationDatabase: target.name,
    createdAt: new Date().toISOString(), collections: snapshots,
  }, null, 2), { flag: "wx" });
  for (const snapshot of snapshots) {
    const current = await source.db.collection(snapshot.name).find().sort({ _id: 1 }).toArray();
    if (digest(current) !== snapshot.hash) throw new Error("Source changed during backup; no copy performed.");
  }
  for (const snapshot of snapshots) {
    const documents = EJSON.parse(await readFile(join(backup, `${snapshot.name}.json`), "utf8"));
    const collection = await target.db.createCollection(snapshot.name);
    if (documents.length) await collection.insertMany(documents);
    for (const index of snapshot.indexes) {
      if (index.name === "_id_") continue;
      const { key, v: _version, ns: _namespace, ...options } = index;
      await collection.createIndex(key, options);
    }
    const copied = await collection.find().sort({ _id: 1 }).toArray();
    if (digest(copied) !== snapshot.hash)
      throw new Error("Copied records failed verification. Preserve backup; inspect destination manually.");
    const indexNames = (await collection.indexes()).map((index) => index.name).sort();
    if (JSON.stringify(indexNames) !== JSON.stringify(snapshot.indexes.map((index) => index.name).sort()))
      throw new Error("Copied indexes failed verification.");
  }
  return { collections: snapshots.map(({ name, count }) => ({ name, count })) };
}