import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();
const input = {
  userId: "customer", items: [{ productId: "expo-demo-bookmark", quantity: 1 }],
  address: { name: "Customer", line: "Studio road", city: "Mumbai", state: "Maharashtra", postalCode: "400001", phone: "9876543210" },
};
const attempt = { attemptId: "attempt-1", gatewayOrderId: "order_gateway", keyId: "rzp_test_public", amount: 100, currency: "INR", mode: "test" };
const proof = { razorpay_order_id: "order_gateway", razorpay_payment_id: "pay_test", razorpay_signature: "signature" };
const order = { id: "ELS-1001", userId: "customer", date: "2026-10-02", items: [], total: 1, status: "Processing" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type Options = { handler: (result: typeof proof) => void; modal: { ondismiss: () => void } };
let options: Options;
let failed: () => void;
let open: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;

function gateway(action: "success" | "dismiss" | "failed" = "success") {
  open = vi.fn(() => {
    if (action === "success") options.handler(proof);
    if (action === "dismiss") options.modal.ondismiss();
    if (action === "failed") failed();
  });
  close = vi.fn();
  vi.stubGlobal("Razorpay", class {
    constructor(value: Options) { options = value; }
    open = open;
    close = close;
    on(_event: string, listener: () => void) { failed = listener; }
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_API_MODE", "rest");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async (path) => {
    if (path === "/api/payments/config") return reply({ enabled: true, mode: "test" });
    if (path === "/api/payments/orders") return reply(attempt);
    if (path === "/api/payments/verify") return reply(order);
    if (String(path).startsWith("/api/payments/attempts/")) return reply({ status: "pending" });
    return reply(order);
  });
  gateway();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.querySelectorAll('script[src="https://checkout.razorpay.com/v1/checkout.js"]').forEach((script) => script.remove());
});

describe("sandbox checkout service", () => {
  it("does not open payment when durable recovery storage is unavailable", async () => {
    const save = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/recovery|storage/i);
    expect(open).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/payments/verify")).toBe(false);
    save.mockRestore();
  });
  it("keeps recovery scoped to the JWT owner when another account checks payment status", async () => {
    const token = (sub: string) => `header.${btoa(JSON.stringify({ sub }))}.signature`;
    localStorage.setItem("elysian-session-v1", token("customer-a"));
    gateway("dismiss");
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/closed/);
    localStorage.setItem("elysian-session-v1", token("customer-b"));
    fetchMock.mockResolvedValue(reply({ error: "Not your attempt" }, 403));
    expect(await api.paymentService.reconcile()).toBeNull();
    localStorage.setItem("elysian-session-v1", token("customer-a"));
    fetchMock.mockResolvedValue(reply({ status: "pending", checkout: attempt }));
    expect(await api.paymentService.reconcile()).toMatchObject({ status: "pending" });
    expect(fetchMock.mock.lastCall?.[0]).toBe(`/api/payments/attempts/${attempt.attemptId}`);
    expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).join()).not.toContain(token("customer-a"));
  });
  it("does not overwrite another account's saved attempt when creation returns after a session change", async () => {
    localStorage.setItem("elysian-session-v1", "token-a");
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (path, init) => {
      if (path === "/api/payments/orders") {
        localStorage.setItem("elysian-session-v1", "token-b");
        localStorage.setItem("elysian-payment-attempt-v1", "attempt-b");
        return reply(attempt);
      }
      return original(path, init);
    });
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/session/i);
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBe("attempt-b");
    expect(open).not.toHaveBeenCalled();
  });

  it("closes the gateway on a session-change event without discarding recovery", async () => {
    localStorage.setItem("elysian-session-v1", "token-a");
    open.mockImplementation(() => {});
    const api = await import("../services/api");
    const checking = expect(api.orderService.create(input)).rejects.toThrow(/session/i);
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
    localStorage.setItem("elysian-session-v1", "token-b");
    window.dispatchEvent(new Event("elysian-session-change"));
    await checking;
    expect(close).toHaveBeenCalledOnce();
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBe(attempt.attemptId);
  });
  it("resumes an unpaid saved attempt after reload without a new gateway order", async () => {
    localStorage.setItem("elysian-payment-attempt-v1", attempt.attemptId);
    fetchMock.mockImplementation(async (path) => reply(String(path).includes("/attempts/") ? { status: "pending", checkout: attempt } : order));
    const api = await import("../services/api");
    expect(await api.paymentService.resume()).toEqual(order);
    expect(options).toMatchObject({ order_id: attempt.gatewayOrderId });
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/payments/orders")).toBe(false);
  });

  it("keeps a dismissed attempt recoverable when a success callback arrives late", async () => {
    gateway("dismiss");
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/closed/);
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBe(attempt.attemptId);
    options.handler(proof);
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([path]) => path === "/api/payments/verify")).toBe(true));
  });

  it("refuses proof verification and joining an old checkout after the session changes", async () => {
    localStorage.setItem("elysian-session-v1", "token-a");
    open.mockImplementation(() => {});
    const api = await import("../services/api");
    const first = api.orderService.create(input);
    const rejected = expect(first).rejects.toThrow(/session/i);
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
    localStorage.setItem("elysian-session-v1", "token-b");
    await expect(api.paymentService.create(input)).rejects.toThrow(/session/i);
    options.handler(proof);
    await rejected;
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/payments/verify")).toBe(false);
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBe(attempt.attemptId);
  });

  it("uses the captured session on creation and verification", async () => {
    localStorage.setItem("elysian-session-v1", "token-a");
    const api = await import("../services/api");
    await api.orderService.create(input);
    for (const [path, init] of fetchMock.mock.calls) {
      if (path === "/api/payments/orders" || path === "/api/payments/verify") {
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-a");
      }
    }
  });

  it("does not return a verified receipt to a changed session", async () => {
    localStorage.setItem("elysian-session-v1", "token-a");
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (path, init) => {
      if (path === "/api/payments/verify") { localStorage.setItem("elysian-session-v1", "token-b"); return reply(order); }
      return original(path, init);
    });
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/session/i);
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBe(attempt.attemptId);
  });
  it.each([403, 404])("discards inaccessible saved attempts on %s after an account change", async (status) => {
    localStorage.setItem("elysian-payment-attempt-v1", "another-account-attempt");
    fetchMock.mockResolvedValue(reply({ error: "Attempt unavailable" }, status));
    const api = await import("../services/api");
    expect(await api.paymentService.reconcile()).toBeNull();
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBeNull();
  });

  it("preserves saved attempts when status lookup fails temporarily", async () => {
    localStorage.setItem("elysian-payment-attempt-v1", "attempt-1");
    fetchMock.mockResolvedValue(reply({ error: "Temporarily unavailable" }, 503));
    const api = await import("../services/api");
    await expect(api.paymentService.reconcile()).rejects.toThrow("Temporarily unavailable");
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBe("attempt-1");
  });
  it("shares one script load and permits retry after a loading error", async () => {
    vi.stubGlobal("Razorpay", undefined);
    const { paymentService } = await import("../services/api");
    const first = paymentService.load();
    const second = paymentService.load();
    const scripts = document.querySelectorAll('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    expect(scripts).toHaveLength(1);
    const errors = [expect(first).rejects.toThrow(/load/i), expect(second).rejects.toThrow(/load/i)];
    scripts[0].dispatchEvent(new Event("error"));
    await Promise.all(errors);
    const retry = paymentService.load();
    gateway();
    document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')!.dispatchEvent(new Event("load"));
    await expect(retry).resolves.toBeUndefined();
  });

  it("times out script loading without leaving a broken script or blocked retry", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Razorpay", undefined);
    const { paymentService } = await import("../services/api");
    const loading = expect(paymentService.load()).rejects.toThrow(/load|timed out/i);
    await vi.advanceTimersByTimeAsync(15000);
    await loading;
    expect(document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')).toBeNull();
    gateway();
    await expect(paymentService.load()).resolves.toBeUndefined();
  });

  it("does not report modal dismissal as cancellation once verification has started", async () => {
    gateway();
    open.mockImplementation(() => { options.handler(proof); options.modal.ondismiss(); });
    const api = await import("../services/api");
    expect(await api.orderService.create(input)).toEqual(order);
  });

  it("keeps reconciliation-required attempts blocked rather than implying payment success", async () => {
    localStorage.setItem("elysian-payment-attempt-v1", "attempt-1");
    fetchMock.mockImplementation(async (path) => reply(path === "/api/payments/config" ? { enabled: true, mode: "test" } : { status: "reconciliation_required" }));
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/review/i);
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/payments/orders")).toBe(false);
  });
  it("creates with server totals and verifies before returning a real order", async () => {
    const api = await import("../services/api");
    expect(await api.orderService.create(input)).toEqual(order);
    expect(options).toMatchObject({ key: attempt.keyId, order_id: attempt.gatewayOrderId, amount: 100, currency: "INR" });
    expect(fetchMock.mock.calls.find(([path]) => path === "/api/payments/orders")?.[1]?.body).toBe(JSON.stringify({ items: input.items, address: input.address }));
    expect(fetchMock.mock.calls.find(([path]) => path === "/api/payments/verify")?.[1]?.body).toBe(JSON.stringify({ attemptId: attempt.attemptId, ...proof }));
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/orders")).toBe(false);
  });

  it("fails closed if configuration is unavailable instead of falling back to demo checkout", async () => {
    fetchMock.mockResolvedValue(reply({ error: "Payment configuration unavailable" }, 503));
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow("Payment configuration unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it("refuses a non-test gateway response", async () => {
    fetchMock.mockImplementation(async (path) => reply(path === "/api/payments/config"
      ? { enabled: true, mode: "test" }
      : { ...attempt, keyId: "rzp_live_not_allowed" }));
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/Only sandbox/);
    expect(open).not.toHaveBeenCalled();
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBeNull();
  });

  it("opens one gateway for concurrent submission and ignores duplicate success callbacks", async () => {
    open.mockImplementation(() => { options.handler(proof); options.handler(proof); });
    const api = await import("../services/api");
    expect(await Promise.all([api.orderService.create(input), api.orderService.create(input)])).toEqual([order, order]);
    expect(open).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/payments/verify")).toHaveLength(1);
  });

  it.each(["dismiss", "failed"] as const)("allows retry after %s without completing the order", async (action) => {
    const api = await import("../services/api");
    gateway(action);
    await expect(api.orderService.create(input)).rejects.toThrow(/closed|failed/i);
    if (action === "failed") expect(close).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/payments/verify")).toBe(false);
    gateway();
    fetchMock.mockImplementation(async (path) => reply(String(path).includes("/attempts/") ? { status: "pending", checkout: attempt } : order));
    expect(await api.paymentService.resume()).toEqual(order);
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/payments/orders")).toHaveLength(1);
  });

  it("persists only the attempt ID when verification is uncertain and reconciles after reload", async () => {
    fetchMock.mockImplementation(async (path) => {
      if (path === "/api/payments/verify") throw new Error("Network unavailable");
      if (path === "/api/payments/config") return reply({ enabled: true, mode: "test" });
      return reply(attempt);
    });
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/verification|pending/i);
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBe(attempt.attemptId);
    expect(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))).toEqual(["elysian-payment-attempt-v1"]);
    vi.resetModules();
    fetchMock.mockResolvedValue(reply({ status: "completed", order }));
    const reloaded = await import("../services/api");
    expect(await reloaded.paymentService.reconcile()).toEqual({ status: "completed", order });
    expect(localStorage.getItem("elysian-payment-attempt-v1")).toBeNull();
  });

  it("does not silently create another payment while verification remains pending", async () => {
    localStorage.setItem("elysian-payment-attempt-v1", "attempt-1");
    const api = await import("../services/api");
    await expect(api.orderService.create(input)).rejects.toThrow(/pending/i);
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/payments/orders")).toBe(false);
  });

  it("leaves legacy checkout available when REST payments are disabled", async () => {
    fetchMock.mockImplementation(async (path) => reply(path === "/api/payments/config" ? { enabled: false, mode: "test" } : order));
    const api = await import("../services/api");
    expect(await api.orderService.create(input)).toEqual(order);
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/orders")).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it("never fetches payment config or opens a gateway in mock mode", async () => {
    vi.stubEnv("VITE_API_MODE", "mock");
    const api = await import("../services/api");
    expect(await api.paymentService.config()).toEqual({ enabled: false, mode: "test" });
    expect(await api.paymentService.reconcile()).toBeNull();
    await expect(api.paymentService.create(input)).rejects.toThrow(/disabled/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});