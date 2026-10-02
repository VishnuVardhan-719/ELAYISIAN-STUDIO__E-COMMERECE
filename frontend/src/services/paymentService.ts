import type { Address, CartItem, Order } from "../types/domain";
import { apiRequest, ApiError, readToken } from "./http";

export type PaymentAttempt = { status: "pending" | "completed" | "reconciliation_required"; order?: Order; checkout?: GatewayOrder };
type GatewayOrder = { attemptId: string; gatewayOrderId: string; keyId: string; amount: number; currency: "INR"; mode: "test" };
type PaymentProof = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type GatewayOptions = {
  key: string; order_id: string; amount: number; currency: "INR";
  handler: (proof: PaymentProof) => void; modal: { ondismiss: () => void };
};
type Gateway = { open: () => void; close: () => void; on: (event: "payment.failed", handler: () => void) => void };
declare global {
  interface Window { Razorpay?: new (options: GatewayOptions) => Gateway }
}

const ATTEMPT_KEY = "elysian-payment-attempt-v1";
const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const pendingMessage = "Sandbox payment verification is pending. Check payment status before trying again.";
let scriptLoad: Promise<void> | undefined;
const pendingIds = new Map<string, string>();
let checkout: Promise<Order> | undefined;
let checkoutToken: string | null = null;
const sessionMessage = "Your session changed. Reopen checkout with the correct account.";
const auth = (token: string | null) => ({ Authorization: token ? `Bearer ${token}` : "" });
function checkSession(token: string | null): void {
  if (readToken() !== token) throw new Error(sessionMessage);
}

function attemptKey(token = readToken()): string {
  try {
    const payload = JSON.parse(atob((token ?? "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown };
    if (typeof payload.sub === "string" && payload.sub) return `${ATTEMPT_KEY}:${encodeURIComponent(payload.sub)}`;
  } catch { return ATTEMPT_KEY; }
  return ATTEMPT_KEY;
}
function savedAttempt(token: string | null): string | null {
  const key = attemptKey(token);
  try { return localStorage.getItem(key) || pendingIds.get(key) || null; } catch { return pendingIds.get(key) || null; }
}
function saveAttempt(id: string | null, token: string | null): void {
  const key = attemptKey(token);
  if (id) pendingIds.set(key, id);
  else pendingIds.delete(key);
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    if (id) throw new Error("Payment recovery storage is unavailable. Enable browser storage before continuing.");
  }
}
const post = <T>(path: string, body: unknown, token: string | null) => apiRequest<T>(path, { method: "POST", body: JSON.stringify(body), headers: auth(token) });

function load(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptLoad) return scriptLoad;
  scriptLoad = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    const finish = (error?: Error) => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        scriptLoad = undefined;
        reject(error);
      } else resolve();
    };
    const timer = setTimeout(() => finish(new Error("Sandbox checkout loading timed out. Please try again.")), 15000);
    script.onload = () => finish(window.Razorpay ? undefined : new Error("Sandbox checkout could not load. Please try again."));
    script.onerror = () => finish(new Error("Sandbox checkout could not load. Please try again."));
    document.head.appendChild(script);
  });
  return scriptLoad;
}

async function reconcile(token = readToken()): Promise<PaymentAttempt | null> {
  checkSession(token);
  const id = savedAttempt(token);
  if (!id) return null;
  try {
    const result = await apiRequest<PaymentAttempt>(`/payments/attempts/${encodeURIComponent(id)}`, { headers: auth(token) });
    checkSession(token);
    if (result.status === "completed" && result.order) saveAttempt(null, token);
    return result;
  } catch (error) {
    checkSession(token);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      saveAttempt(null, token);
      return null;
    }
    throw error;
  }
}

async function create(input: { items: CartItem[]; address: Omit<Address, "id" | "userId"> } | undefined, token: string | null): Promise<Order> {
  checkSession(token);
  const previous = await reconcile(token);
  if (previous?.status === "completed" && previous.order) return previous.order;
  if (previous && !previous.checkout) throw new Error(previous.status === "reconciliation_required"
    ? "Sandbox payment needs manual review. Do not retry payment."
    : pendingMessage);
  await load();
  checkSession(token);
  if (!previous?.checkout && !input) throw new Error(pendingMessage);
  const attempt = previous?.checkout ?? await post<GatewayOrder>("/payments/orders", input, token);
  if (attempt.mode !== "test" || !attempt.keyId.startsWith("rzp_test_") || attempt.currency !== "INR") {
    throw new Error("Only sandbox payments are supported.");
  }
  checkSession(token);
  saveAttempt(attempt.attemptId, token);
  return new Promise<Order>((resolve, reject) => {
    let settled = false;
    let verifying = false;
    let cleanup = () => {};
    const fail = (message: string) => {
      if (settled || verifying) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    try {
      const gateway = new window.Razorpay!({
        key: attempt.keyId, order_id: attempt.gatewayOrderId, amount: attempt.amount, currency: attempt.currency,
        modal: { ondismiss: () => fail("Sandbox checkout closed. You can try again.") },
        handler: (proof) => {
          if (verifying) return;
          if (readToken() !== token) { reject(new Error(sessionMessage)); gateway.close(); return; }
          verifying = true;
          post<Order>("/payments/verify", { attemptId: attempt.attemptId, ...proof }, token)
            .then((order) => { checkSession(token); settled = true; saveAttempt(null, token); resolve(order); })
            .catch(() => { settled = true; reject(new Error(readToken() === token ? pendingMessage : sessionMessage)); })
            .finally(cleanup);
        },
      });
      const sessionChanged = () => {
        if (readToken() === token) return;
        settled = true;
        reject(new Error(sessionMessage));
        gateway.close();
        cleanup();
      };
      cleanup = () => {
        window.removeEventListener("elysian-session-change", sessionChanged);
        window.removeEventListener("storage", sessionChanged);
      };
      window.addEventListener("elysian-session-change", sessionChanged);
      window.addEventListener("storage", sessionChanged);
      gateway.on("payment.failed", () => {
        if (settled || verifying) return;
        fail("Sandbox payment failed. You can try again.");
        gateway.close();
        cleanup();
      });
      gateway.open();
    } catch {
      fail("Sandbox checkout could not open. Please try again.");
    }
  });
}

function start(input: Parameters<typeof create>[0], token: string | null): Promise<Order> {
  if (checkout && checkoutToken !== token) return Promise.reject(new Error(sessionMessage));
  if (!checkout) {
    checkoutToken = token;
    checkout = create(input, token).finally(() => { checkout = undefined; });
  }
  return checkout;
}

export const paymentService = {
  config: () => apiRequest<{ enabled: boolean; mode: "test" }>("/payments/config"),
  load,
  reconcile,
  create: (input: NonNullable<Parameters<typeof create>[0]>, token = readToken()) => start(input, token),
  resume: () => start(undefined, readToken()),
};