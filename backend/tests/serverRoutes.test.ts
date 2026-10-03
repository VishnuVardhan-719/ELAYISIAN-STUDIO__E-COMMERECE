import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/env";
import adminRouter from "../src/routes/admin";
import authRouter from "../src/routes/auth";
import catalogueRouter from "../src/routes/catalogue";
import collaborationsRouter from "../src/routes/collaborations";
import ordersRouter from "../src/routes/orders";
import savedStateRouter from "../src/routes/savedState";
import usersRouter from "../src/routes/users";
import { errorHandler, notFound } from "../src/middleware/errors";
import { listAllProducts, listCollaborations, listCreators, listOrders, resetStore } from "../src/store";

const TEST_URI = "mongodb://127.0.0.1:27017/elysian_test_routes";

vi.mock("../src/env", () => ({ env: { jwtSecret: "isolated-route-test-key", jwtExpiresIn: "1h", razorpayKeyId: "", razorpayKeySecret: "", razorpayWebhookSecret: "" } }));

let server: Server;
let baseUrl: string;

const tokenFor = (userId: string) =>
  jwt.sign({}, env.jwtSecret, { subject: userId, expiresIn: "1h" });

async function request(path: string, options?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body: unknown = await response.json();
  return { response, body };
}

describe("first API route slice", () => {
  it("accepts the shop's default featured sort", async () => {
    const result = await request("/api/products?sort=featured&category=&search=&maxPrice=6000&page=1&pageSize=9");
    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ items: expect.any(Array), page: 1 });
  });
  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api", catalogueRouter);
    app.use("/api", collaborationsRouter);
    app.use("/api", savedStateRouter);
    app.use("/api", ordersRouter);
    app.use("/api", usersRouter);
    app.use("/api", adminRouter);
    app.use(notFound);
    app.use(errorHandler);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await resetStore();
  });

  it("logs in and resolves the current user from the bearer token", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "ANANYA@EXAMPLE.TEST",
        password: "elysian123",
      }),
    });

    expect(login.response.status).toBe(200);
    expect(login.body).toMatchObject({
      token: expect.any(String),
      user: { id: "demo-customer", role: "customer" },
    });
    expect(login.body).not.toHaveProperty("user.passwordHash");

    const token = (login.body as { token: string }).token;
    const me = await request("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(me.response.status).toBe(200);
    expect(me.body).toMatchObject({ id: "demo-customer", role: "customer" });
  });

  it("uses one response for unknown users and wrong passwords", async () => {
    for (const body of [
      { email: "missing@example.test", password: "elysian123" },
      { email: "ananya@example.test", password: "wrong-password" },
      { email: "invalid", password: "elysian123" },
    ]) {
      const result = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      expect(result.response.status).toBe(401);
      expect(result.body).toEqual({
        error: "That email and password combination was not found.",
      });
    }
  });

  it("registers a normalized customer and rejects a duplicate email", async () => {
    const registered = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "New Collector",
        email: "NEW@EXAMPLE.TEST",
        password: "longenough1",
      }),
    });

    expect(registered.response.status).toBe(201);
    expect(registered.body).toMatchObject({
      token: expect.any(String),
      user: { email: "new@example.test", role: "customer" },
    });

    const duplicate = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Another Collector",
        email: "new@example.test",
        password: "longenough1",
      }),
    });
    expect(duplicate.response.status).toBe(409);
    expect(duplicate.body).toEqual({
      error: "An account already exists for that email.",
    });
  });

  it.each([
    [
      { name: "N", email: "short-name@example.test", password: "longenough1" },
      "Enter your full name.",
    ],
    [
      { name: "Valid Name", email: "invalid", password: "longenough1" },
      "Enter a valid email address.",
    ],
    [
      { name: "Valid Name", email: "short-password@example.test", password: "short" },
      "Choose a password of at least 8 characters.",
    ],
    [
      {
        name: "Valid Name",
        email: "long-password@example.test",
        password: "🙂".repeat(19),
      },
      "Choose a password of at most 72 bytes.",
    ],
  ])("preserves registration validation messages", async (body, message) => {
    const result = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });

    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: message });
  });

  it("returns a client error for malformed JSON", async () => {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: "{not-json",
    });

    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: "Invalid request" });
  });

  it("serves filtered products, product detail, and related products", async () => {
    const products = await request(
      "/api/products?search=stoneware&category=ceramics&maxPrice=2500&pageSize=1&page=99",
    );
    expect(products.response.status).toBe(200);
    const page = products.body as {
      items: Array<{
        categoryId: string;
        description: string;
        material: string;
        name: string;
        price: number;
        status: string;
      }>;
      page: number;
      pages: number;
      total: number;
    };
    expect(page.total).toBeGreaterThan(0);
    expect(page.page).toBe(page.pages);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      categoryId: "ceramics",
      status: "active",
    });
    expect(page.items[0].price).toBeLessThanOrEqual(2500);
    expect(
      `${page.items[0].name} ${page.items[0].description} ${page.items[0].material}`.toLowerCase(),
    ).toContain("stoneware");

    const product = await request("/api/products/sunset-vase");
    expect(product.body).toMatchObject({ id: "sunset-vase" });

    const related = await request("/api/products/sunset-vase/related");
    expect(related.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ categoryId: "ceramics" })]),
    );

    expect((await request("/api/products/not-found")).body).toBeNull();
  });

  it("serves categories, creators, and collections", async () => {
    expect((await request("/api/categories")).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "ceramics" })]),
    );
    expect((await request("/api/creators/mira")).body).toMatchObject({ id: "mira" });
    expect((await request("/api/collections/small-joys")).body).toMatchObject({
      slug: "small-joys",
    });
  });

  it("rejects malformed product query numbers", async () => {
    const result = await request("/api/products?page=not-a-number");

    expect(result.response.status).toBe(400);
    expect(result.body).toMatchObject({ error: "Invalid request" });
  });

  it("accepts valid collaborations and rejects invalid applications", async () => {
    const valid = await request("/api/collaborations", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenFor("demo-customer")}` },
      body: JSON.stringify({
        name: "Leela Rao",
        email: "ananya@example.test",
        categoryId: "art",
        portfolio: "https://example.test/leela",
        description: "Original botanical prints made by hand in small editions.",
        reason: "I want to meet collectors who value slow printmaking.",
        sample: "A hand-pulled monsoon fern print.",
        terms: true,
      }),
    });

    expect(valid.response.status).toBe(201);
    expect(valid.body).toMatchObject({ id: "COL-023", status: "pending" });

    const invalid = await request("/api/collaborations", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenFor("demo-customer")}` },
      body: JSON.stringify({
        name: "L",
        email: "invalid",
        categoryId: "missing",
        portfolio: "not-a-url",
        description: "short",
        reason: "short",
        sample: "",
        terms: false,
      }),
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.body).toEqual({ error: "Please check the application fields." });
  });

  it("scopes collaboration status and review by authenticated role", async () => {
    const creatorToken = tokenFor("demo-creator");
    const mine = await request("/api/collaborations/me", {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(mine.body).toBeNull();

    const customerList = await request("/api/collaborations", {
      headers: { Authorization: `Bearer ${tokenFor("demo-customer")}` },
    });
    expect(customerList.response.status).toBe(403);

    const adminToken = tokenFor("demo-admin");
    const reviewed = await request("/api/collaborations/COL-021", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "approved" }),
    });
    expect(reviewed.response.status).toBe(409);
    expect(reviewed.body).toEqual({ error: "The applicant must sign in and resubmit this application." });
  });

  it("keeps carts isolated and enforces stock through authenticated routes", async () => {
    const customer = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    const creator = { Authorization: `Bearer ${tokenFor("demo-creator")}` };

    expect(
      (
        await request("/api/cart", {
          method: "POST",
          headers: customer,
          body: JSON.stringify({ productId: "sunset-vase", quantity: 2 }),
        })
      ).body,
    ).toEqual([{ productId: "sunset-vase", quantity: 2 }]);
    expect((await request("/api/cart", { headers: creator })).body).toEqual([]);

    const overStock = await request("/api/cart", {
      method: "POST",
      headers: customer,
      body: JSON.stringify({ productId: "sunset-vase", quantity: 99 }),
    });
    expect(overStock.response.status).toBe(400);
    expect(overStock.body).toEqual({
      error: "Only 8 available. You already have 2 in your bag.",
    });

    const updated = await request("/api/cart", {
      method: "PATCH",
      headers: customer,
      body: JSON.stringify({ productId: "sunset-vase", quantity: 3 }),
    });
    expect(updated.body).toEqual([{ productId: "sunset-vase", quantity: 3 }]);

    const removed = await request("/api/cart", {
      method: "PATCH",
      headers: customer,
      body: JSON.stringify({ productId: "sunset-vase", quantity: 0 }),
    });
    expect(removed.response.status).toBe(200);
    expect(removed.body).toEqual([]);

    expect(
      (
        await request("/api/cart?productId=sunset-vase", {
          method: "DELETE",
          headers: customer,
        })
      ).body,
    ).toEqual([]);
  });

  it("keeps wishlists isolated and rejects unauthenticated access", async () => {
    expect((await request("/api/wishlist")).response.status).toBe(401);

    const customer = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    const creator = { Authorization: `Bearer ${tokenFor("demo-creator")}` };
    const saved = await request("/api/wishlist", {
      method: "PUT",
      headers: customer,
      body: JSON.stringify({
        productIds: ["sunset-vase", "sunset-vase", "studio-cup"],
      }),
    });

    expect(saved.body).toEqual(["sunset-vase", "studio-cup"]);
    expect((await request("/api/wishlist", { headers: creator })).body).toEqual([]);
  });

  it("persists private preferences across requests without changing public user shapes", async () => {
    const path = "/api/users/me/preferences";
    const customer = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    const creator = { Authorization: `Bearer ${tokenFor("demo-creator")}` };
    const admin = { Authorization: `Bearer ${tokenFor("demo-admin")}` };
    const defaults = { makersAndCollections: true, studioStories: true };
    const preferences = { makersAndCollections: false, studioStories: false };
    expect((await request(path)).response.status).toBe(401);
    expect((await request(path, { headers: customer })).body).toEqual(defaults);
    const saved = await request(path, {
      method: "PUT", headers: customer, body: JSON.stringify(preferences),
    });
    expect(saved.response.status).toBe(200);
    expect(saved.body).toEqual(preferences);
    expect((await request(path, { headers: customer })).body).toEqual(preferences);
    expect((await request(path, { headers: creator })).body).toEqual(defaults);
    expect((await request(path, {
      method: "PUT", headers: customer,
      body: JSON.stringify({ makersAndCollections: "false", studioStories: true }),
    })).response.status).toBe(400);
    expect((await request("/api/auth/me", { headers: customer })).body).not.toHaveProperty("preferences");
    const users = (await request("/api/users", { headers: admin })).body as Record<string, unknown>[];
    expect(users.find((user) => user.id === "demo-customer")).not.toHaveProperty("preferences");
  });

  it("scopes order lists and details to buyers, creators, and admins", async () => {
    const customer = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    const creator = { Authorization: `Bearer ${tokenFor("demo-creator")}` };
    const admin = { Authorization: `Bearer ${tokenFor("demo-admin")}` };

    const mine = await request("/api/orders?userId=demo-customer", {
      headers: customer,
    });
    expect(mine.body).toHaveLength(3);

    const forbidden = await request("/api/orders?userId=demo-creator", {
      headers: customer,
    });
    expect(forbidden.response.status).toBe(403);

    const creatorOrders = await request("/api/orders?creatorId=mira", {
      headers: creator,
    });
    expect(creatorOrders.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ productId: "sunset-vase" }),
          ]),
        }),
      ]),
    );

    const hidden = await request("/api/orders/ELS-1056", { headers: creator });
    expect(hidden.body).toBeNull();
    expect((await request("/api/orders", { headers: admin })).body).toHaveLength(3);
  });

  it("creates checkout for the authenticated buyer and clears their cart", async () => {
    const headers = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    await request("/api/cart", {
      method: "POST",
      headers,
      body: JSON.stringify({ productId: "studio-cup", quantity: 1 }),
    });
    const before = (await request("/api/products/studio-cup")).body as {
      price: number;
      stock: number;
    };
    const checkout = await request("/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        userId: "demo-customer",
        items: [{ productId: "studio-cup", quantity: 1 }],
        address: {
          name: "Ananya Rao",
          line: "24, Gulmohar Lane",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          phone: "9876543210",
        },
      }),
    });

    expect(checkout.response.status).toBe(201);
    expect(checkout.body).toMatchObject({
      userId: "demo-customer",
      total: before.price + 150,
      status: "Processing",
    });
    expect((await request("/api/cart", { headers })).body).toEqual([]);
    expect(
      ((await request("/api/products/studio-cup")).body as { stock: number }).stock,
    ).toBe(before.stock - 1);
  });

  it("rejects checkout identity spoofing and invalid delivery details", async () => {
    const headers = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    const input = {
      userId: "someone-else",
      items: [{ productId: "studio-cup", quantity: 1 }],
      address: {
        name: "Ananya Rao",
        line: "24, Gulmohar Lane",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        phone: "9876543210",
      },
    };
    expect(
      (await request("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      })).response.status,
    ).toBe(403);

    const invalid = await request("/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...input,
        userId: "demo-customer",
        address: { ...input.address, postalCode: "123", phone: "123" },
      }),
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.body).toMatchObject({ error: "Invalid request" });
  });

  it("updates the current profile and restricts user listing to admins", async () => {
    const customer = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    const updated = await request("/api/users/me", {
      method: "PATCH",
      headers: customer,
      body: JSON.stringify({ name: "Ananya R.", email: "ANANYA.NEW@EXAMPLE.TEST" }),
    });
    expect(updated.body).toMatchObject({
      name: "Ananya R.",
      email: "ananya.new@example.test",
    });
    expect((await request("/api/auth/me", { headers: customer })).body).toMatchObject({
      email: "ananya.new@example.test",
    });
    expect((await request("/api/users", { headers: customer })).response.status).toBe(403);

    const admin = { Authorization: `Bearer ${tokenFor("demo-admin")}` };
    const users = await request("/api/users", { headers: admin });
    expect(users.response.status).toBe(200);
    expect(users.body).not.toHaveProperty("0.passwordHash");
  });

  it("keeps address CRUD scoped to the authenticated owner", async () => {
    const customer = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    const creator = { Authorization: `Bearer ${tokenFor("demo-creator")}` };
    const saved = await request("/api/users/me/addresses/addr-new", {
      method: "PUT",
      headers: customer,
      body: JSON.stringify({
        name: "Ananya Rao",
        line: "12, Museum Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        phone: "9876543210",
      }),
    });
    expect(saved.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "addr-new", userId: "demo-customer" }),
      ]),
    );
    expect((await request("/api/users/me/addresses", { headers: creator })).body).toEqual([]);

    const wrongOwner = await request("/api/users/me/addresses/addr-new", {
      method: "DELETE",
      headers: creator,
    });
    expect(wrongOwner.response.status).toBe(404);

    const removed = await request("/api/users/me/addresses/addr-new", {
      method: "DELETE",
      headers: customer,
    });
    expect(removed.body).toEqual([
      expect.objectContaining({ id: "addr-1", userId: "demo-customer" }),
    ]);
  });

  it("filters the public catalogue by creator without exposing drafts", async () => {
    const result = await request("/api/products?creatorId=mira&pageSize=100");
    const page = result.body as {
      items: Array<{ creatorId: string; status: string }>;
      total: number;
    };

    expect(result.response.status).toBe(200);
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((product) => product.creatorId === "mira")).toBe(true);
    expect(page.items.every((product) => product.status === "active")).toBe(true);
  });

  it("lets creators manage only their products and anonymously resolve wishlist product ids", async () => {
    const creator = { Authorization: `Bearer ${tokenFor("demo-creator")}` };
    const draft = {
      id: "piece-new-draft",
      name: "Monsoon Bowl",
      creatorId: "mira",
      categoryId: "ceramics",
      price: 1800,
      images: ["/images/bowls.webp"],
      description: "A hand-thrown bowl with a quiet monsoon-blue glaze.",
      material: "Glazed stoneware",
      dimensions: "16 × 7 cm",
      stock: 4,
      status: "draft",
    };
    const saved = await request("/api/products", {
      method: "POST",
      headers: creator,
      body: JSON.stringify(draft),
    });
    expect(saved.response.status).toBe(201);
    expect(saved.body).toEqual(draft);

    const managed = await request("/api/products/manage", { headers: creator });
    expect(managed.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draft.id, status: "draft" })]),
    );

    const byIds = await request("/api/products/by-ids", {
      method: "POST",
      body: JSON.stringify({ ids: [draft.id, "sunset-vase", draft.id, "missing"] }),
    });
    expect(byIds.response.status).toBe(200);
    expect(byIds.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: draft.id }),
        expect.objectContaining({ id: "sunset-vase" }),
      ]),
    );
    expect((byIds.body as unknown[])).toHaveLength(2);

    const featured = await request("/api/products", {
      method: "POST",
      headers: creator,
      body: JSON.stringify({ ...draft, featured: true }),
    });
    expect(featured.body).toEqual({ ...draft, featured: true });
    const replaced = await request("/api/products", {
      method: "POST",
      headers: creator,
      body: JSON.stringify(draft),
    });
    expect(replaced.body).toEqual(draft);

    const forbidden = await request("/api/products", {
      method: "POST",
      headers: creator,
      body: JSON.stringify({ ...draft, id: "piece-stolen", creatorId: "isha" }),
    });
    expect(forbidden.response.status).toBe(403);
  });

  it("enforces creator profile ownership", async () => {
    const creator = { Authorization: `Bearer ${tokenFor("demo-creator")}` };
    const updated = await request("/api/creators/mira", {
      method: "PATCH",
      headers: creator,
      body: JSON.stringify({ studio: "Mira Clay House", location: "Bengaluru" }),
    });
    expect(updated.body).toMatchObject({
      id: "mira",
      studio: "Mira Clay House",
    });
    expect((await request("/api/creators/mira")).body).toMatchObject({
      studio: "Mira Clay House",
    });

    const forbidden = await request("/api/creators/isha", {
      method: "PATCH",
      headers: creator,
      body: JSON.stringify({ studio: "Not Mira's Studio" }),
    });
    expect(forbidden.response.status).toBe(403);
  });

  it("aggregates seeded order revenue and review queues for admins only", async () => {
    expect((await request("/api/admin/analytics")).response.status).toBe(401);
    for (const userId of ["demo-customer", "demo-creator"]) {
      expect((await request("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${tokenFor(userId)}` },
      })).response.status).toBe(403);
    }
    const products = await listAllProducts();
    const creators = await listCreators();
    const revenues = new Map<string, number>();
    for (const order of await listOrders()) {
      for (const item of order.items) {
        const creatorId = products.find((product) => product.id === item.productId)!.creatorId;
        revenues.set(creatorId, (revenues.get(creatorId) ?? 0) + item.quantity * item.unitPrice);
      }
    }
    const revenueByCreator = [...revenues].map(([creatorId, revenue]) => ({
      creatorId,
      creatorName: creators.find((creator) => creator.id === creatorId)!.name,
      revenue,
    })).sort((a, b) => a.creatorId.localeCompare(b.creatorId));
    const analytics = await request("/api/admin/analytics", {
      headers: { Authorization: `Bearer ${tokenFor("demo-admin")}` },
    });
    expect(analytics.response.status).toBe(200);
    expect(analytics.body).toEqual({
      revenueByCreator,
      lowStock: products.filter((product) => product.stock < 4).sort((a, b) => a.id.localeCompare(b.id)),
      pendingCollaborations: (await listCollaborations()).filter((entry) => entry.status === "pending").sort((a, b) => a.id.localeCompare(b.id)),
    });
  });

  it("restricts payments, summary, and all-product management to admins", async () => {
    const customer = { Authorization: `Bearer ${tokenFor("demo-customer")}` };
    for (const path of ["/api/payments", "/api/admin/summary", "/api/products/manage"]) {
      expect((await request(path, { headers: customer })).response.status).toBe(403);
    }

    const admin = { Authorization: `Bearer ${tokenFor("demo-admin")}` };
    const payments = await request("/api/payments", { headers: admin });
    expect(payments.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "Recorded demo" })]),
    );
    const summary = await request("/api/admin/summary", { headers: admin });
    expect(summary.body).toEqual({
      products: expect.any(Number),
      creators: expect.any(Number),
      orders: expect.any(Number),
      pending: expect.any(Number),
      lowStock: expect.any(Number),
    });
    expect((await request("/api/products/manage", { headers: admin })).response.status).toBe(
      200,
    );
  });
});