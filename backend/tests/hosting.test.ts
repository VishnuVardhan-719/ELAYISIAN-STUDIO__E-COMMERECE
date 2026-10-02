import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/env", () => ({ env: { clientOrigin: "http://localhost:5173", jwtSecret: "isolated-hosting-test-secret", jwtExpiresIn: "1h", razorpayKeyId: "", razorpayKeySecret: "", razorpayWebhookSecret: "" } }));
vi.mock("../../database/src/db", () => ({ dbState: vi.fn(() => "connected"), connectDb: vi.fn() }));
vi.mock("../src/payments", () => ({
  paymentConfig: () => ({ enabled: false }),
  processPaymentWebhook: vi.fn(), createPaymentAttempt: vi.fn(), readPaymentAttempt: vi.fn(), verifyPayment: vi.fn(), verificationSchema: {},
}));

const { createApp } = await import("../src/app");
const { dbState, connectDb } = await import("../../database/src/db");
const { processPaymentWebhook } = await import("../src/payments");
let server: Server;
let baseUrl: string;
let staticDir: string;

describe("single-origin production hosting", () => {
  beforeAll(async () => {
    staticDir = await mkdtemp(join(tmpdir(), "elysian-hosting-"));
    await mkdir(join(staticDir, "assets"));
    await writeFile(join(staticDir, "index.html"), "<!doctype html><main>studio shell</main>");
    await writeFile(join(staticDir, "assets", "app.js"), "window.studio = true;");
    const app = createApp({ staticDir });
    expect(connectDb).not.toHaveBeenCalled();
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (staticDir) await rm(staticDir, { recursive: true, force: true });
  });

  it("trusts only the Render proxy hop", () => {
    expect(createApp().get("trust proxy")).toBe(1);
  });

  it.each(["/", "/shop", "/products/sunset-vase", "/account/orders"])("serves SPA refresh %s", async (path) => {
    const response = await fetch(baseUrl + path);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("studio shell");
  });

  it("serves a built asset without rewriting", async () => {
    const response = await fetch(baseUrl + "/assets/app.js");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("window.studio = true;");
  });

  it.each(["/assets/missing.js", "/assets/missing", "/images/missing", "/images/missing.svg", "/favicon.ico", "/.env", "/missing.css"])("does not serve SPA for missing resource %s", async (path) => {
    const response = await fetch(baseUrl + path);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("studio shell");
  });

  it.each(["/api", "/api/unknown", "/api/payments/unknown"])("returns JSON 404 for unknown API %s", async (path) => {
    const response = await fetch(baseUrl + path);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("reports ready only with a connected database", async () => {
    for (const state of ["connected", "disconnected", "connecting", "disconnecting", "unknown"]) {
      vi.mocked(dbState).mockReturnValue(state);
      const response = await fetch(baseUrl + "/api/health");
      expect(response.status).toBe(state === "connected" ? 200 : 503);
      expect(await response.json()).toEqual({ ok: state === "connected", database: state });
    }
  });

  it("passes the exact webhook bytes before JSON parsing", async () => {
    const body = '{ "event": "payment.captured", "payload": {} }';
    const response = await fetch(baseUrl + "/api/payments/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Razorpay-Signature": "test-signature" }, body });
    expect(response.status).toBe(200);
    expect(processPaymentWebhook).toHaveBeenCalledWith(Buffer.from(body), "test-signature");
  });

  it("mounts the payment config route", async () => {
    const response = await fetch(baseUrl + "/api/payments/config");
    expect(await response.json()).toEqual({ enabled: false });
  });

  it("adds security headers without blocking gateway scripts", async () => {
    const response = await fetch(baseUrl);
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("rate limits malformed login/register requests by proxy client IP", async () => {
    for (const path of ["/api/auth/login", "/api/auth/register"]) {
      for (let count = 0; count < 20; count++) {
        const response = await fetch(baseUrl + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "192.0.2.1" }, body: "{}" });
        expect(response.status).not.toBe(429);
      }
      const response = await fetch(baseUrl + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "192.0.2.1" }, body: "{}" });
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBeTruthy();
    }
  });
});