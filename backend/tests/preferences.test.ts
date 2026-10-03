import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../database/src/models/User";
import usersRouter from "../src/routes/users";
import { errorHandler, notFound } from "../src/middleware/errors";

vi.mock("../src/env", () => ({ env: { jwtSecret: "isolated-preferences-test-key" } }));
vi.mock("../src/store", () => ({
  getUserById: async (id: string) => ["one", "two"].includes(id) ? { id, role: "customer" } : null,
  listUsers: vi.fn(), listAddresses: vi.fn(), removeAddress: vi.fn(), saveAddress: vi.fn(), updateUser: vi.fn(),
}));
const defaults = { makersAndCollections: true, studioStories: true };
const rows = new Map<string, { preferences?: typeof defaults }>();
const query = (value: unknown) => ({ select: vi.fn().mockReturnThis(), lean: async () => value });
let server: Server;
let baseUrl: string;
async function request(method: string, body?: unknown, owner: string | null = "one") {
  return fetch(`${baseUrl}/users/me/preferences`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(owner ? { Authorization: `Bearer ${jwt.sign({}, "isolated-preferences-test-key", { subject: owner })}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("private account preferences", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json(), usersRouter, notFound, errorHandler);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  beforeEach(() => {
    rows.clear();
    rows.set("one", {});
    rows.set("two", {});
    vi.spyOn(User, "findOne").mockImplementation(((filter: { id: string }) => query(rows.get(filter.id) ?? null)) as never);
    vi.spyOn(User, "findOneAndUpdate").mockImplementation(((filter: { id: string }, update: { $set: { preferences: typeof defaults } }) => {
      if (!rows.has(filter.id)) return query(null);
      const row = { preferences: update.$set.preferences };
      rows.set(filter.id, row);
      return query(row);
    }) as never);
  });

  it("defaults legacy users to true and saves only for the authenticated owner", async () => {
    expect(await (await request("GET")).json()).toEqual(defaults);
    const saved = { makersAndCollections: false, studioStories: false };
    const response = await request("PUT", saved);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(saved);
    expect(await (await request("GET")).json()).toEqual(saved);
    expect(await (await request("GET", undefined, "two")).json()).toEqual(defaults);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith({ id: "one" }, { $set: { preferences: saved } }, {
      returnDocument: "after", runValidators: true,
    });
  });

  it.each([{}, { makersAndCollections: "false", studioStories: true },
    { makersAndCollections: true, studioStories: 0 },
    { ...defaults, userId: "two" }, { ...defaults, surprise: true }, null])("rejects invalid or extra fields: %j", async (body) => {
    expect((await request("PUT", body)).status).toBe(400);
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each(["GET", "PUT"])("requires authentication for %s", async (method) => {
    expect((await request(method, method === "PUT" ? defaults : undefined, null)).status).toBe(401);
  });

  it("returns 404 if the authenticated user's record disappears", async () => {
    rows.delete("one");
    expect((await request("GET")).status).toBe(404);
    expect((await request("PUT", defaults)).status).toBe(404);
  });

  it("keeps optional preferences private and gives nested fields true defaults", () => {
    const user = new User({ id: "one", name: "Ananya", email: "one@example.test", passwordHash: "hash" });
    expect(user.toObject()).not.toHaveProperty("preferences");
    const optedIn = new User({ preferences: {} });
    expect(optedIn.toObject()).toHaveProperty("preferences", defaults);
    expect(User.schema.path("preferences").options.select).toBe(false);
    expect(new User({ preferences: defaults }).toJSON()).not.toHaveProperty("preferences");
  });
});