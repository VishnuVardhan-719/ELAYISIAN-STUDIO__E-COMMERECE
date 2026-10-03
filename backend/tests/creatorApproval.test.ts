import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Collaboration } from "../../database/src/models/Collaboration";
import { Creator } from "../../database/src/models/Creator";
import { Category } from "../../database/src/models/Category";
import { User } from "../../database/src/models/User";
import { env } from "../src/env";
import { errorHandler, notFound } from "../src/middleware/errors";
import collaborationsRouter from "../src/routes/collaborations";
import authRouter from "../src/routes/auth";
import catalogueRouter from "../src/routes/catalogue";
import { getAdminAnalytics, reviewCollaboration } from "../src/store";
import type { Collaboration as DomainCollaboration, User as DomainUser } from "../../frontend/src/types/domain";

vi.mock("../src/env", () => ({ env: { jwtSecret: "isolated-creator-test-key", jwtExpiresIn: "1h" } }));

const input = { name: "Test Maker", email: "applicant@example.test", categoryId: "art", portfolio: "", description: "Original botanical prints made by hand in small editions.", reason: "Meet collectors who value original handmade work.", sample: "A hand-pulled fern print.", terms: true };
let server: Server;
let mongo: ChildProcess;
let dbpath: string;
let baseUrl: string;

async function request<T = unknown>(path: string, method = "GET", body?: unknown, user: string | null = "applicant") {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${jwt.sign({}, env.jwtSecret, { subject: user })}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as T };
}

async function apply() {
  const result = await request("/collaborations", "POST", input);
  expect(result.status).toBe(201);
  return result.body as { id: string };
}

async function approve(id: string) {
  return request(`/collaborations/${id}`, "PATCH", { status: "approved" }, "admin");
}

describe("secure creator approval", () => {
  beforeAll(async () => {
    const socket = createServer();
    await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
    const port = (socket.address() as AddressInfo).port;
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    dbpath = await mkdtemp(join(tmpdir(), "elysian-creator-test-"));
    const windowsBinary = "C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe";
    const binary = process.env.MONGOD_BINARY || (process.platform === "win32" && existsSync(windowsBinary) ? windowsBinary : "mongod");
    mongo = spawn(binary, ["--dbpath", dbpath, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "creatorTest", "--quiet"], { stdio: "ignore" });
    const uri = `mongodb://127.0.0.1:${port}/elysian_test_creators?directConnection=true`;
    const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 500 });
    for (let retry = 0; ; retry++) {
      try { await client.connect(); break; }
      catch { if (retry > 40) throw new Error("Isolated MongoDB did not start."); await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    await client.db().admin().command({ replSetInitiate: { _id: "creatorTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    for (let retry = 0; ; retry++) {
      if ((await client.db().admin().command({ hello: 1 })).isWritablePrimary) break;
      if (retry > 100) throw new Error("Isolated replica set did not elect a primary.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await client.close();
    await mongoose.connect(uri);
    await Promise.all([User.init(), Creator.init(), Collaboration.init(), Category.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api", collaborationsRouter, catalogueRouter);
    app.use(notFound);
    app.use(errorHandler);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    if (mongo && mongo.exitCode === null) {
      const stopped = new Promise<void>((resolve) => mongo.once("exit", () => resolve()));
      mongo.kill();
      await stopped;
    }
    if (dbpath) await rm(dbpath, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Creator.deleteMany({}), Collaboration.deleteMany({}), Category.deleteMany({})]);
    await User.create(["applicant", "other", "admin"].map((id) => ({ id, name: "Test User", email: `${id}@example.test`, passwordHash: "unused", role: id === "admin" ? "admin" : "customer" })));
    await Category.create({ id: "art", name: "Art", description: "Handmade art", image: "/images/art-v2.webp" });
  });

  it("rejects anonymous, identity-spoofed and invalid submissions without persisting", async () => {
    expect((await request("/collaborations", "POST", input, null)).status).toBe(401);
    expect((await request("/collaborations", "POST", { ...input, email: "other@example.test" })).status).toBe(400);
    expect((await request("/collaborations", "POST", { ...input, userId: "other" })).status).toBe(400);
    expect((await request("/collaborations", "POST", { ...input, categoryId: "missing" })).status).toBe(400);
    expect(await Collaboration.countDocuments()).toBe(0);
  });

  it("binds privately to applicant id and keeps ownership after email changes", async () => {
    const created = await apply();
    expect((await Collaboration.findOne({ id: created.id }).select("+userId").lean<{ userId: string }>())?.userId).toBe("applicant");
    expect((await request("/collaborations/me")).body).toEqual({ id: created.id, creatorName: input.name, email: input.email, categoryId: input.categoryId, description: input.description, status: "pending", date: expect.any(String) });
    await User.updateOne({ id: "applicant" }, { $set: { email: "changed@example.test" } });
    await User.updateOne({ id: "other" }, { $set: { email: input.email } });
    expect((await request<DomainCollaboration>("/collaborations/me")).body.id).toBe(created.id);
    expect((await request("/collaborations/me", "GET", undefined, "other")).body).toBeNull();
    expect(JSON.stringify((await request("/collaborations", "GET", undefined, "admin")).body)).not.toContain("userId");
    expect(JSON.stringify(await getAdminAnalytics())).not.toContain("userId");
    expect((await approve(created.id)).status).toBe(200);
    expect((await User.findOne({ id: "applicant" }).lean<DomainUser>())?.role).toBe("creator");
    expect((await User.findOne({ id: "other" }).lean<DomainUser>())?.role).toBe("customer");
  });

  it("atomically provisions once across concurrent duplicate applications and retries", async () => {
    const first = await apply();
    const second = await apply();
    const results = await Promise.all([approve(first.id), approve(first.id), approve(second.id)]);
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    expect((await approve(first.id)).status).toBe(200);
    const user = await User.findOne({ id: "applicant" }).lean<DomainUser>();
    expect(user).toMatchObject({ role: "creator", creatorId: "creator-applicant" });
    expect(await Creator.countDocuments()).toBe(1);
    expect(await Creator.findOne({ id: user!.creatorId }).lean()).toMatchObject({ name: input.name, bio: input.description, specialty: "Art" });
    expect(await Collaboration.countDocuments({ status: "approved" })).toBe(2);
    expect((await request("/auth/me")).body).toMatchObject({ role: "creator", creatorId: user!.creatorId });
    expect((await request("/creators")).body).toEqual([expect.objectContaining({ id: user!.creatorId })]);
    expect((await request(`/creators/${user!.creatorId}`)).status).toBe(200);
    expect((await request("/products/manage")).status).toBe(200);
  });

  it("protects admin review, admin applicants, missing owners and unbound history", async () => {
    const created = await apply();
    expect((await request(`/collaborations/${created.id}`, "PATCH", { status: "approved" }, null)).status).toBe(401);
    expect((await request(`/collaborations/${created.id}`, "PATCH", { status: "approved" })).status).toBe(403);
    expect((await approve("missing")).status).toBe(404);
    await User.updateOne({ id: "applicant" }, { $set: { role: "admin" } });
    expect((await approve(created.id)).status).toBe(409);
    expect((await User.findOne({ id: "applicant" }).lean<DomainUser>())?.role).toBe("admin");
    await User.deleteOne({ id: "applicant" });
    expect((await approve(created.id)).status).toBe(409);
    await Collaboration.collection.updateOne({ id: created.id }, { $unset: { userId: "" } });
    expect((await approve(created.id)).status).toBe(409);
    expect(await Creator.countDocuments()).toBe(0);
    expect((await Collaboration.findOne({ id: created.id }).lean<DomainCollaboration>())?.status).toBe("pending");
    expect((await request(`/collaborations/${created.id}`, "PATCH", { status: "declined" }, "admin")).status).toBe(200);
  });

  it("does not overwrite an existing creator profile or revoke an approved grant", async () => {
    const profile = { id: "existing", name: "Existing Maker", studio: "Existing Studio", specialty: "Art", location: "Bengaluru", bio: "Existing biography", image: "/images/creator1-v2.webp", cover: "/images/studio-v2.webp", since: 2020 };
    await Creator.create(profile);
    await User.updateOne({ id: "applicant" }, { $set: { role: "creator", creatorId: profile.id } });
    const created = await apply();
    expect((await approve(created.id)).status).toBe(200);
    expect(await Creator.countDocuments()).toBe(1);
    expect((await request(`/creators/${profile.id}`)).body).toEqual(profile);
    for (const status of ["declined", "pending"]) {
      expect((await request(`/collaborations/${created.id}`, "PATCH", { status }, "admin")).status).toBe(409);
    }
    expect((await User.findOne({ id: "applicant" }).lean<DomainUser>())?.creatorId).toBe(profile.id);
    expect((await Collaboration.findOne({ id: created.id }).lean<DomainCollaboration>())?.status).toBe("approved");
  });

  it.each(["profile", "user", "status"])("rolls back all provisioning on %s persistence failure", async (failure) => {
    const created = await apply();
    if (failure === "profile") vi.spyOn(Creator, "updateOne").mockImplementationOnce(() => { throw new Error("Persistence failed."); });
    if (failure === "user") vi.spyOn(User, "updateOne").mockImplementationOnce(() => { throw new Error("Persistence failed."); });
    if (failure === "status") vi.spyOn(Collaboration, "findOneAndUpdate").mockImplementationOnce(() => { throw new Error("Persistence failed."); });
    await expect(reviewCollaboration(created.id, "approved")).rejects.toThrow("Persistence failed.");
    expect(await Creator.countDocuments()).toBe(0);
    expect(await User.findOne({ id: "applicant" }).lean()).toMatchObject({ role: "customer" });
    expect((await User.findOne({ id: "applicant" }).lean<DomainUser>())?.creatorId).toBeUndefined();
    expect((await Collaboration.findOne({ id: created.id }).lean<DomainCollaboration>())?.status).toBe("pending");
  });

  it("keeps registration customer-only and rejects public privileged roles", async () => {
    const registration = { name: "New Maker", email: "new@example.test", password: "test-password-only" };
    expect((await request("/auth/register", "POST", { ...registration, role: "admin" }, null)).status).toBe(400);
    expect((await request<{ user: DomainUser }>("/auth/register", "POST", registration, null)).body.user).toMatchObject({ role: "customer" });
  });

  it("rejects another account's creator link and leaves history-only approval unchanged", async () => {
    const created = await apply();
    await User.updateOne({ id: "other" }, { $set: { creatorId: "creator-applicant" } });
    expect((await approve(created.id)).status).toBe(409);
    expect(await Creator.countDocuments()).toBe(0);
    await Collaboration.collection.updateOne({ id: created.id }, { $unset: { userId: "" }, $set: { status: "approved" } });
    expect((await approve(created.id)).status).toBe(200);
    expect(await Creator.countDocuments()).toBe(0);
    expect((await User.findOne({ id: "applicant" }).lean<DomainUser>())?.role).toBe("customer");
  });

  it("rejects a removed craft without persisting any provisioning", async () => {
    const created = await apply();
    await Category.deleteMany({});
    expect((await approve(created.id)).status).toBe(409);
    expect(await Creator.countDocuments()).toBe(0);
    expect((await User.findOne({ id: "applicant" }).lean<DomainUser>())?.role).toBe("customer");
    expect((await Collaboration.findOne({ id: created.id }).lean<DomainCollaboration>())?.status).toBe("pending");
  });
});