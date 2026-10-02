import { describe, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("JWT_SECRET", "isolated-hosting-test-secret");
vi.stubEnv("RAZORPAY_KEY_ID", "");
vi.stubEnv("RAZORPAY_KEY_SECRET", "");
vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");

const { readEnv } = await import("../src/env");
const production = { NODE_ENV: "production", JWT_SECRET: "a".repeat(48) };

describe("hosting environment validation", () => {
  it.each([undefined, "", "short", "elysian-development-secret-change-me"])(
    "rejects an insecure production JWT", (secret) => {
      expect(() => readEnv({ NODE_ENV: "production", JWT_SECRET: secret })).toThrow(/JWT_SECRET/);
    },
  );

  it("allows isolated test and development defaults", () => {
    expect(readEnv({ NODE_ENV: "test" }).jwtSecret).toBeTruthy();
    expect(readEnv({ NODE_ENV: "development" }).port).toBe(4000);
  });

  it("accepts production JWT and trims sandbox settings", () => {
    expect(readEnv({ ...production, RAZORPAY_KEY_ID: " rzp_test_demo ", RAZORPAY_KEY_SECRET: " demo-secret ", RAZORPAY_WEBHOOK_SECRET: " webhook-test " })).toMatchObject({
      razorpayKeyId: "rzp_test_demo", razorpayKeySecret: "demo-secret", razorpayWebhookSecret: "webhook-test",
    });
  });

  it("allows payments disabled without keys", () => {
    expect(readEnv(production)).toMatchObject({ razorpayKeyId: "", razorpayKeySecret: "", razorpayWebhookSecret: "" });
  });

  it.each(["rzp_live_demo", "unknown"])("rejects a non-sandbox key without leaking it", (key) => {
    expect(() => readEnv({ ...production, RAZORPAY_KEY_ID: key, RAZORPAY_KEY_SECRET: "private-test-value" })).toThrow(/sandbox/);
    try { readEnv({ ...production, RAZORPAY_KEY_ID: key }); }
    catch (error) { expect(String(error)).not.toContain(key); }
  });

  it.each([{ RAZORPAY_KEY_ID: "rzp_test_demo" }, { RAZORPAY_KEY_SECRET: "test-secret" }])("rejects an incomplete gateway key pair", (keys) => {
    expect(() => readEnv({ ...production, ...keys })).toThrow(/together/);
  });

  it.each(["0", "-1", "65536", "abc", "4000.5"])("rejects invalid server port %s", (port) => {
    expect(() => readEnv({ ...production, PORT: port })).toThrow(/PORT/);
  });
});