import { createHmac } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "../../frontend/src/data/mock";
import type { Cart as DomainCart, Product as DomainProduct } from "../../frontend/src/types/domain";
import { Product } from "../../database/src/models/Product";
import { Order } from "../../database/src/models/Order";
import { Payment } from "../../database/src/models/Payment";
import { Cart } from "../../database/src/models/Cart";
import { User } from "../../database/src/models/User";
import { PaymentAttempt } from "../../database/src/models/PaymentAttempt";
import { env } from "../src/env";
import { errorHandler, notFound } from "../src/middleware/errors";
import paymentsRouter, { paymentWebhookHandler } from "../src/routes/payments";
import ordersRouter from "../src/routes/orders";
import { createCheckout } from "../src/store";

vi.mock("../src/env", () => ({ env: {
  jwtSecret: "isolated-test-jwt-key", razorpayKeyId: "rzp_test_fixture",
  razorpayKeySecret: "fixture-key", razorpayWebhookSecret: "fixture-webhook",
} }));

const address = { name: "Test Buyer", line: "Test Lane", city: "Bengaluru", state: "Karnataka", postalCode: "560001", phone: "9876543210" };
const input = { items: [{ productId: "sunset-vase", quantity: 1 }], address };
const originalFetch = globalThis.fetch;
let server: Server;
let mongo: ChildProcess;
let baseUrl: string;
let gatewayPayment: Record<string, unknown>;
let gatewayFetch: ReturnType<typeof vi.fn>;

async function request(path: string, body?: unknown, user = "buyer") {
  const response = await originalFetch(`${baseUrl}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({}, env.jwtSecret, { subject: user })}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function attempt() {
  const result = await request("/payments/orders", input);
  expect(result.status).toBe(201);
  return result.body as { attemptId: string; gatewayOrderId: string; amount: number };
}

function verification(created: { attemptId: string; gatewayOrderId: string }, paymentId = "pay_fixture") {
  return { attemptId: created.attemptId, razorpay_order_id: created.gatewayOrderId,
    razorpay_payment_id: paymentId, razorpay_signature: createHmac("sha256", "fixture-key").update(`${created.gatewayOrderId}|${paymentId}`).digest("hex") };
}

describe("verified sandbox payments", () => {
  beforeAll(async () => {
    const socket = createServer();
    await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
    const port = (socket.address() as AddressInfo).port;
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    const dbpath = await mkdtemp(join(tmpdir(), "elysian-payment-test-"));
    const windowsBinary = "C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe";
    const binary = process.env.MONGOD_BINARY || (process.platform === "win32" && existsSync(windowsBinary) ? windowsBinary : "mongod");
    mongo = spawn(binary, ["--dbpath", dbpath, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "paymentTest", "--quiet"], { stdio: "ignore" });
    const uri = `mongodb://127.0.0.1:${port}/elysian_test_payments?directConnection=true`;
    const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 500 });
    for (let retry = 0; ; retry++) {
      try { await client.connect(); break; }
      catch { if (retry > 40) throw new Error("Isolated MongoDB did not start."); await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    await client.db().admin().command({ replSetInitiate: { _id: "paymentTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    for (let retry = 0; ; retry++) {
      const hello = await client.db().admin().command({ hello: 1 });
      if (hello.isWritablePrimary) break;
      if (retry > 100) throw new Error("Isolated replica set did not elect a primary.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await client.close();
    await mongoose.connect(uri);
    await Promise.all([Product.init(), Order.init(), Payment.init(), Cart.init(), User.init(), PaymentAttempt.init()]);
    const app = express();
    app.post("/api/payments/webhook", express.raw({ type: "application/json" }), paymentWebhookHandler);
    app.use(express.json());
    app.use("/api", paymentsRouter, ordersRouter);
    app.use(notFound);
    app.use(errorHandler);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    mongo?.kill();
  });

  beforeEach(async () => {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), Payment.deleteMany({}), Cart.deleteMany({}), User.deleteMany({}), PaymentAttempt.deleteMany({})]);
    await Product.create(products[0]);
    await User.create(["buyer", "other", "admin"].map((id) => ({ id, name: "Test User", email: `${id}@example.test`, passwordHash: "unused", role: id === "admin" ? "admin" : "customer" })));
    await Cart.create({ userId: "buyer", items: input.items });
    env.razorpayKeyId = "rzp_test_fixture";
    env.razorpayKeySecret = "fixture-key";
    gatewayPayment = { id: "pay_fixture", order_id: "order_fixture", amount: 260000, currency: "INR", status: "captured", captured: true };
    gatewayFetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/orders")) {
        const body = JSON.parse(options!.body as string);
        return Response.json({ id: "order_fixture", amount: body.amount, currency: body.currency });
      }
      if (url.endsWith("/payments") && url.includes("/orders/")) return Response.json({ items: [gatewayPayment] });
      return Response.json(gatewayPayment);
    });
    vi.stubGlobal("fetch", gatewayFetch);
  });

  it("exposes only sandbox config and server-priced paise including shipping", async () => {
    expect(await request("/payments/config")).toEqual({ status: 200, body: { enabled: true, mode: "test" } });
    const created = await attempt();
    expect(created).toEqual({ attemptId: expect.any(String), gatewayOrderId: "order_fixture", keyId: "rzp_test_fixture", amount: 260000, currency: "INR", mode: "test" });
    expect(await Order.countDocuments()).toBe(0);
    expect((await Product.findOne({ id: "sunset-vase" }).lean<DomainProduct>())!.stock).toBe(8);
  });

  it("blocks legacy checkout with keys but preserves demo checkout without keys", async () => {
    expect((await request("/orders", { ...input, userId: "buyer" })).status).toBe(409);
    env.razorpayKeyId = "";
    env.razorpayKeySecret = "";
    expect((await request("/payments/config")).body).toEqual({ enabled: false, mode: "test" });
    expect((await request("/orders", { ...input, userId: "buyer" })).status).toBe(201);
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it("includes ordinary shipping in demo store checkout", async () => {
    expect((await createCheckout({ ...input, userId: "buyer" })).total).toBe(2600);
  });

  it("rejects live keys, spoofed totals and identities, empty or partly unavailable carts", async () => {
    for (const body of [{ ...input, amount: 1 }, { ...input, userId: "other" }, { ...input, items: [] }, { ...input, items: [...input.items, { productId: "missing", quantity: 1 }] }]) {
      expect((await request("/payments/orders", body)).status).toBe(400);
    }
    env.razorpayKeyId = "rzp_live_forbidden";
    expect((await request("/payments/orders", input)).status).toBe(503);
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests and wrong owner or forged signatures", async () => {
    expect((await request("/payments/orders", input, "missing")).status).toBe(401);
    const created = await attempt();
    expect((await request("/payments/verify", verification(created), "other")).status).toBe(403);
    expect((await request(`/payments/attempts/${created.attemptId}`, undefined, "other")).status).toBe(403);
    expect((await request("/payments/verify", { ...verification(created), razorpay_signature: "0".repeat(64) })).status).toBe(400);
    gatewayPayment.status = "authorized";
    gatewayPayment.captured = false;
    expect((await request(`/payments/attempts/${created.attemptId}`, undefined, "admin")).body).toEqual({ status: "pending" });
    expect(await Order.countDocuments()).toBe(0);
  });

  it.each([{ status: "authorized", captured: false }, { amount: 1 }, { currency: "USD" }, { order_id: "order_other" }, { id: "pay_other" }])("rejects mismatched or uncaptured fetched payment %j", async (patch) => {
    const created = await attempt();
    Object.assign(gatewayPayment, patch);
    expect((await request("/payments/verify", verification(created))).status).toBe(409);
    expect(await Order.countDocuments()).toBe(0);
    expect((await Product.findOne({ id: "sunset-vase" }).lean<DomainProduct>())!.stock).toBe(8);
  });

  it("atomically finalizes once across concurrent verify, webhook and restart-style retry", async () => {
    const created = await attempt();
    const results = await Promise.all([request("/payments/verify", verification(created)), request("/payments/verify", verification(created))]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results[0].body).toEqual(results[1].body);
    expect(results[0].body).toEqual({ id: expect.any(String), userId: "buyer", date: expect.any(String), items: [{ productId: "sunset-vase", name: products[0].name, quantity: 1, unitPrice: 2450 }], total: 2600, status: "Processing" });
    expect(await webhook(created.gatewayOrderId)).toBe(200);
    expect((await request("/payments/verify", verification(created))).body).toEqual(results[0].body);
    expect((await request(`/payments/attempts/${created.attemptId}`)).body).toEqual({ status: "completed", order: results[0].body });
    expect(await Order.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(1);
    expect((await Product.findOne({ id: "sunset-vase" }).lean<DomainProduct>())!.stock).toBe(7);
    expect((await Cart.findOne({ userId: "buyer" }).lean<DomainCart>())!.items).toEqual([]);
  });

  it("uses captured webhook to recover without browser verification and validates exact raw bytes", async () => {
    const created = await attempt();
    expect(await webhook(created.gatewayOrderId, false)).toBe(400);
    expect(await webhook(created.gatewayOrderId)).toBe(200);
    expect(await Order.countDocuments()).toBe(1);
    expect(await webhook(created.gatewayOrderId)).toBe(200);
    expect(await Order.countDocuments()).toBe(1);
  });

  it("records explicit reconciliation after captured stock failure without partial checkout", async () => {
    const created = await attempt();
    await Product.updateOne({ id: "sunset-vase" }, { $set: { stock: 0 } });
    expect((await request("/payments/verify", verification(created))).status).toBe(409);
    expect((await request(`/payments/attempts/${created.attemptId}`)).body).toEqual({ status: "reconciliation_required" });
    expect(await Order.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
    expect((await Cart.findOne({ userId: "buyer" }).lean<DomainCart>())!.items).toHaveLength(1);
  });

  it("reconciles captured payment on owner GET when browser verification and webhook were lost", async () => {
    const created = await attempt();
    const result = await request(`/payments/attempts/${created.attemptId}`);
    expect(result.body).toMatchObject({ status: "completed", order: { userId: "buyer", total: 2600 } });
    expect(await Order.countDocuments()).toBe(1);
  });

  it("keeps unrelated cart additions when finalizing captured checkout", async () => {
    const created = await attempt();
    await Cart.updateOne({ userId: "buyer" }, { $set: { items: [...input.items, { productId: "woven-throw", quantity: 2 }] } });
    expect((await request("/payments/verify", verification(created))).status).toBe(200);
    expect((await Cart.findOne({ userId: "buyer" }).lean<DomainCart>())!.items).toEqual([{ productId: "woven-throw", quantity: 2 }]);
  });

  it("sanitizes network failures and does not leak gateway responses", async () => {
    gatewayFetch.mockRejectedValueOnce(new Error("fixture-key private upstream detail"));
    const result = await request("/payments/orders", input);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain("fixture-key");
  });

  it("requires transaction topology before creating a gateway order", async () => {
    const admin = mongoose.connection.db!.admin();
    vi.spyOn(admin, "command").mockResolvedValueOnce({ isWritablePrimary: true });
    const topology = vi.spyOn(mongoose.connection.db!, "admin").mockReturnValue(admin);
    const result = await request("/payments/orders", input);
    topology.mockRestore();
    expect(result.status).toBe(503);
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it("leaves no partial stock or order writes if captured persistence fails", async () => {
    const created = await attempt();
    const persist = vi.spyOn(Order.prototype, "save").mockRejectedValueOnce(new Error("private database detail"));
    const result = await request("/payments/verify", verification(created));
    persist.mockRestore();
    expect(result.status).toBe(409);
    expect(JSON.stringify(result.body)).not.toContain("private database detail");
    expect((await Product.findOne({ id: "sunset-vase" }).lean<DomainProduct>())!.stock).toBe(8);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
    expect((await request(`/payments/attempts/${created.attemptId}`)).body).toEqual({ status: "reconciliation_required" });
  });

  it("enforces provider order and payment uniqueness in the database", async () => {
    const created = await attempt();
    const stored = await PaymentAttempt.findOne({ id: created.attemptId }).lean();
    expect(stored).not.toBeNull();
    await expect(PaymentAttempt.create({ ...stored, _id: undefined, id: "second", orderId: "ELS-second" })).rejects.toMatchObject({ code: 11000 });
    expect((await request("/payments/verify", verification(created))).status).toBe(200);
    const updated = await PaymentAttempt.findOne({ id: created.attemptId }).lean();
    await expect(PaymentAttempt.create({ ...updated, _id: undefined, id: "third", orderId: "ELS-third", gatewayOrderId: "order_different" })).rejects.toMatchObject({ code: 11000 });
  });

  it("does not claim success when reconciliation cannot fetch gateway state", async () => {
    const created = await attempt();
    gatewayFetch.mockRejectedValueOnce(new Error("fixture-key upstream exception"));
    const result = await request(`/payments/attempts/${created.attemptId}`);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain("fixture-key");
    expect(await Order.countDocuments()).toBe(0);
  });

  it("offers owner-only checkout resume when no captured or authorized payment exists", async () => {
    const created = await attempt();
    gatewayFetch.mockResolvedValueOnce(Response.json({ items: [] }));
    expect((await request(`/payments/attempts/${created.attemptId}`)).body).toEqual({ status: "pending", checkout: created });
    gatewayFetch.mockResolvedValueOnce(Response.json({ items: [] }));
    expect((await request(`/payments/attempts/${created.attemptId}`, undefined, "admin")).body).toEqual({ status: "pending" });
    expect((await request(`/payments/attempts/${created.attemptId}`, undefined, "other")).status).toBe(403);
  });

  it("never offers resume while any authorized payment is awaiting capture", async () => {
    const created = await attempt();
    gatewayPayment.status = "authorized";
    gatewayPayment.captured = false;
    expect((await request(`/payments/attempts/${created.attemptId}`)).body).toEqual({ status: "pending" });
  });

  it("reuses the pending snapshot and gateway order across repeat identical checkout creation", async () => {
    const first = await attempt();
    await Product.updateOne({ id: "sunset-vase" }, { $set: { price: 2700 } });
    const second = await request("/payments/orders", { address: { phone: address.phone, postalCode: address.postalCode, state: address.state, city: address.city, line: address.line, name: address.name }, items: input.items });
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first);
    expect(gatewayFetch.mock.calls.filter(([url]) => String(url).endsWith("/orders"))).toHaveLength(1);
    expect(await PaymentAttempt.countDocuments()).toBe(1);
  });

  it("claims checkout persistently before one upstream creation across concurrent tabs", async () => {
    const results = await Promise.all([request("/payments/orders", input), request("/payments/orders", input)]);
    expect(results.map((result) => result.status).sort()).toEqual(expect.arrayContaining([201]));
    expect(results.every((result) => result.status === 201 || result.status === 409)).toBe(true);
    const successful = results.filter((result) => result.status === 201);
    if (successful.length === 2) expect(successful[0].body).toEqual(successful[1].body);
    expect(gatewayFetch.mock.calls.filter(([url]) => String(url).endsWith("/orders"))).toHaveLength(1);
    expect(await PaymentAttempt.countDocuments()).toBe(1);
  });

  it("retains the creation lock after an ambiguous gateway failure instead of charging twice", async () => {
    gatewayFetch.mockRejectedValueOnce(new Error("Ambiguous provider timeout"));
    expect((await request("/payments/orders", input)).status).toBe(502);
    const retry = await request("/payments/orders", input);
    expect(retry.status).toBe(409);
    expect(gatewayFetch).toHaveBeenCalledTimes(1);
    expect(await PaymentAttempt.countDocuments()).toBe(1);
  });

  it.each(["completed", "reconciliation_required"])("clears the persistent checkout lock on %s", async (status) => {
    const created = await attempt();
    if (status === "reconciliation_required") await Product.updateOne({ id: "sunset-vase" }, { $set: { stock: 0 } });
    await request("/payments/verify", verification(created));
    const stored = await PaymentAttempt.findOne({ id: created.attemptId }).lean();
    expect(stored?.status).toBe(status);
    expect(stored).not.toHaveProperty("checkoutKey");
    const indexes = await PaymentAttempt.collection.indexes();
    expect(indexes).toEqual(expect.arrayContaining([expect.objectContaining({ key: { checkoutKey: 1 }, unique: true, partialFilterExpression: { checkoutKey: { $type: "string" } } })]));
  });
});

async function webhook(orderId: string, valid = true) {
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_fixture", order_id: orderId } } } }, null, 2);
  const response = await originalFetch(`${baseUrl}/api/payments/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "X-Razorpay-Signature": valid ? createHmac("sha256", "fixture-webhook").update(raw).digest("hex") : "0".repeat(64) }, body: raw });
  return response.status;
}