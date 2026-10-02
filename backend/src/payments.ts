import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import type { Cart as DomainCart, Order, Product as DomainProduct, User } from "../../frontend/src/types/domain";
import { checkoutShipping } from "../../frontend/src/utils/commerce";
import { supportsTransactions } from "../../database/src/db";
import { PaymentAttempt, type PaymentAttemptShape } from "../../database/src/models/PaymentAttempt";
import { Order as OrderModel } from "../../database/src/models/Order";
import { Payment } from "../../database/src/models/Payment";
import { Product } from "../../database/src/models/Product";
import { Cart } from "../../database/src/models/Cart";
import { env } from "./env";
import { HttpError } from "./middleware/errors";
import type { CheckoutInput } from "./store";
import { getOrderById } from "./store";

export const verificationSchema = z.strictObject({
  attemptId: z.string().uuid(),
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export function paymentConfig() {
  return { enabled: Boolean(env.razorpayKeyId?.startsWith("rzp_test_") && env.razorpayKeySecret), mode: "test" as const };
}

export function gatewayConfigured(): boolean {
  return Boolean(env.razorpayKeyId || env.razorpayKeySecret);
}

function requireSandbox() {
  if (!paymentConfig().enabled) throw new HttpError(503, "Sandbox payments are unavailable.");
}

async function requireTransactions() {
  if (!await supportsTransactions()) throw new HttpError(503, "Sandbox payments require a transaction-capable database.");
}

export function validSignature(body: string | Buffer, signature: string, secret: string): boolean {
  if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

async function gateway(path: string, body?: unknown): Promise<Record<string, unknown>> {
  requireSandbox();
  try {
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(502, "The payment gateway could not complete that request. Please retry.");
  }
}

export async function createPaymentAttempt(input: CheckoutInput) {
  requireSandbox();
  await requireTransactions();
  await Promise.all([PaymentAttempt.init(), OrderModel.init(), Payment.init(), Cart.init(), Product.init()]);
  const quantities = new Map<string, number>();
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  if (!quantities.size) throw new HttpError(400, "Your bag is empty.");
  const normalizedItems = [...quantities].sort(([left], [right]) => left.localeCompare(right));
  const { name, line, city, state, postalCode, phone } = input.address;
  const checkoutKey = createHash("sha256").update(JSON.stringify([input.userId, normalizedItems, { name, line, city, state, postalCode, phone }])).digest("hex");
  const existing = await PaymentAttempt.findOne({ checkoutKey, status: "pending" }).lean();
  if (existing) return pendingCheckout(existing);
  const catalogue = await Product.find({ id: { $in: [...quantities.keys()] }, status: "active" }).lean<DomainProduct[]>();
  const items = [...quantities].map(([productId, quantity]) => {
    const product = catalogue.find((entry) => entry.id === productId);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !product || product.stock < quantity)
      throw new HttpError(400, "Some pieces are unavailable. Please check your bag.");
    return { productId, name: product.name, quantity, unitPrice: product.price };
  });
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0);
  const amount = subtotal + checkoutShipping(subtotal / 100, items) * 100;
  if (!Number.isSafeInteger(amount) || amount < 100) throw new HttpError(400, "Invalid checkout amount.");
  const id = randomUUID();
  const attempt = new PaymentAttempt({ id, checkoutKey, userId: input.userId, orderId: `ELS-${id}`, amount, items, address: input.address });
  try { await attempt.save(); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const winner = await PaymentAttempt.findOne({ checkoutKey, status: "pending" }).lean();
      if (winner) return pendingCheckout(winner);
      throw new HttpError(409, "Checkout changed. Please retry.");
    }
    throw error;
  }
  const order = await gateway("orders", { amount, currency: "INR", receipt: id });
  if (typeof order.id !== "string" || !/^order_[A-Za-z0-9]+$/.test(order.id) || order.amount !== amount || order.currency !== "INR")
    throw new HttpError(502, "The payment gateway returned an invalid order.");
  attempt.gatewayOrderId = order.id;
  await attempt.save();
  return pendingCheckout(attempt);
}

function pendingCheckout(attempt: PaymentAttemptShape) {
  if (!attempt.gatewayOrderId) throw new HttpError(409, "Checkout creation is pending or uncertain. Please retry later; persistent attempts require manual review.");
  return { attemptId: attempt.id, gatewayOrderId: attempt.gatewayOrderId, keyId: env.razorpayKeyId, amount: attempt.amount, currency: "INR" as const, mode: "test" as const };
}

async function ownedAttempt(id: string, user: User, allowAdmin = false) {
  const attempt = await PaymentAttempt.findOne({ id }).lean();
  if (!attempt) throw new HttpError(404, "Payment attempt not found.");
  if (attempt.userId !== user.id && !(allowAdmin && user.role === "admin")) throw new HttpError(403, "You do not have access to this resource.");
  return attempt;
}

export async function readPaymentAttempt(id: string, user: User) {
  const attempt = await ownedAttempt(id, user, true);
  if (attempt.status === "pending" && attempt.gatewayOrderId) {
    const result = await gateway(`orders/${attempt.gatewayOrderId}/payments`);
    const payments = z.object({ items: z.array(z.object({ id: z.string().regex(/^pay_[A-Za-z0-9]+$/), status: z.string(), amount: z.number(), currency: z.string(), order_id: z.string(), captured: z.boolean() })) }).safeParse(result);
    if (!payments.success) throw new HttpError(502, "The payment gateway returned an invalid response.");
    const captured = payments.data.items.find((payment) => payment.status === "captured" && payment.captured && payment.amount === attempt.amount && payment.currency === "INR" && payment.order_id === attempt.gatewayOrderId);
    if (captured) {
      try { return { status: "completed", order: await finalizePayment(attempt, captured.id) }; }
      catch (error) {
        const current = await PaymentAttempt.findOne({ id }).lean();
        if (current?.status === "reconciliation_required") return { status: current.status };
        throw error;
      }
    }
    if (user.id === attempt.userId && !payments.data.items.some((payment) => payment.status === "authorized" || payment.status === "captured" || payment.captured)) return { status: attempt.status, checkout: pendingCheckout(attempt) };
  }
  if (attempt.status !== "completed") return { status: attempt.status };
  const order = await getOrderById(attempt.orderId);
  if (!order) throw new HttpError(503, "Payment reconciliation is required.");
  return { status: attempt.status, order };
}

export async function verifyPayment(input: z.infer<typeof verificationSchema>, user: User): Promise<Order> {
  requireSandbox();
  const attempt = await ownedAttempt(input.attemptId, user);
  if (attempt.gatewayOrderId !== input.razorpay_order_id || !validSignature(`${attempt.gatewayOrderId}|${input.razorpay_payment_id}`, input.razorpay_signature, env.razorpayKeySecret ?? ""))
    throw new HttpError(400, "Invalid payment signature.");
  return finalizePayment(attempt, input.razorpay_payment_id);
}

async function finalizePayment(attempt: PaymentAttemptShape, paymentId: string): Promise<Order> {
  requireSandbox();
  if (attempt.status === "reconciliation_required") throw new HttpError(409, "Payment captured; manual reconciliation is required.");
  if (attempt.gatewayPaymentId && attempt.gatewayPaymentId !== paymentId) throw new HttpError(409, "Payment does not match this attempt.");
  if (attempt.status === "completed") {
    const order = await getOrderById(attempt.orderId);
    if (!order) throw new HttpError(503, "Payment reconciliation is required.");
    return order;
  }
  const payment = await gateway(`payments/${paymentId}`);
  if (payment.id !== paymentId || payment.order_id !== attempt.gatewayOrderId || payment.amount !== attempt.amount || payment.currency !== "INR" || payment.status !== "captured" || payment.captured !== true)
    throw new HttpError(409, "Payment is not captured or does not match this checkout.");
  await requireTransactions();
  await Promise.all([PaymentAttempt.init(), OrderModel.init(), Payment.init(), Cart.init(), Product.init()]);
  const order: Order = { id: attempt.orderId, userId: attempt.userId, date: new Date().toISOString().slice(0, 10), items: attempt.items.map(({ productId, name, quantity, unitPrice }) => ({ productId, name, quantity, unitPrice })), total: attempt.amount / 100, status: "Processing" };
  try {
    await mongoose.connection.transaction(async (session) => {
      const current = await PaymentAttempt.findOne({ id: attempt.id }).session(session).lean();
      if (!current) throw new HttpError(409, "Payment attempt unavailable.");
      if (current.status === "completed" && current.gatewayPaymentId === paymentId) return;
      if (current.status !== "pending") throw new HttpError(409, "Payment reconciliation is required.");
      await PaymentAttempt.updateOne({ id: attempt.id, status: "pending" }, { $set: { status: "completed", gatewayPaymentId: paymentId }, $unset: { checkoutKey: 1 } }, { session });
      for (const item of order.items) {
        const result = await Product.updateOne({ id: item.productId, status: "active", stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { session });
        if (!result.matchedCount) throw new HttpError(409, "Payment captured; stock reconciliation is required.");
      }
      await new OrderModel(order).save({ session });
      await new Payment({ id: `PAY-${attempt.id}`, orderId: order.id, amount: order.total, method: "Razorpay sandbox verified", status: "Recorded demo" }).save({ session });
      const cart = await Cart.findOne({ userId: order.userId }).session(session).lean<DomainCart>();
      if (cart) {
        const items = cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity - (order.items.find((line) => line.productId === item.productId)?.quantity ?? 0) })).filter((item) => item.quantity > 0);
        await Cart.updateOne({ userId: order.userId }, { $set: { items } }, { session });
      }
    }, { readPreference: "primary", writeConcern: { w: "majority" } });
  } catch {
    const current = await PaymentAttempt.findOne({ id: attempt.id }).lean();
    if (current?.status === "completed" && current.gatewayPaymentId === paymentId) {
      const existing = await getOrderById(attempt.orderId);
      if (existing) return existing;
    }
    await PaymentAttempt.updateOne({ id: attempt.id, status: "pending" }, { $set: { status: "reconciliation_required", gatewayPaymentId: paymentId }, $unset: { checkoutKey: 1 } });
    throw new HttpError(409, "Payment captured; manual reconciliation is required.");
  }
  const persisted = await getOrderById(attempt.orderId);
  if (!persisted) throw new HttpError(503, "Payment reconciliation is required.");
  return persisted;
}

const webhookSchema = z.object({ event: z.string(), payload: z.object({ payment: z.object({ entity: z.object({ id: z.string().regex(/^pay_[A-Za-z0-9]+$/), order_id: z.string().regex(/^order_[A-Za-z0-9]+$/) }) }) }).optional() });

export async function processPaymentWebhook(raw: Buffer, signature: string) {
  requireSandbox();
  if (!Buffer.isBuffer(raw) || !validSignature(raw, signature, env.razorpayWebhookSecret ?? "")) throw new HttpError(400, "Invalid webhook signature.");
  let body: unknown;
  try { body = JSON.parse(raw.toString("utf8")); } catch { throw new HttpError(400, "Invalid webhook payload."); }
  const event = webhookSchema.parse(body);
  if (event.event !== "payment.captured") return;
  if (!event.payload) throw new HttpError(400, "Invalid webhook payload.");
  const payment = event.payload.payment.entity;
  const attempt = await PaymentAttempt.findOne({ gatewayOrderId: payment.order_id }).lean();
  if (!attempt) return;
  if (attempt.status === "reconciliation_required") return;
  await finalizePayment(attempt, payment.id);
}