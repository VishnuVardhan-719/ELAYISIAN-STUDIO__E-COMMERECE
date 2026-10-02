import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { createPaymentAttempt, paymentConfig, processPaymentWebhook, readPaymentAttempt, verificationSchema, verifyPayment } from "../payments";
import { paymentCheckoutSchema } from "./orders";

const router = Router();

const safePayment: (handler: RequestHandler) => RequestHandler = (handler) => async (req, res, next) => {
  try { await handler(req, res, next); }
  catch (error) { next(error instanceof HttpError || error instanceof z.ZodError ? error : new HttpError(503, "Payments are temporarily unavailable. Please retry.")); }
};

router.get("/payments/config", (_req, res) => { res.json(paymentConfig()); });
router.post("/payments/orders", requireAuth, safePayment(async (req, res) => {
  const input = paymentCheckoutSchema.parse(req.body);
  res.status(201).json(await createPaymentAttempt({ ...input, userId: req.user!.id }));
}));
router.post("/payments/verify", requireAuth, safePayment(async (req, res) => {
  res.json(await verifyPayment(verificationSchema.parse(req.body), req.user!));
}));
router.get("/payments/attempts/:id", requireAuth, safePayment(async (req, res) => {
  res.json(await readPaymentAttempt(z.string().uuid().parse(req.params.id), req.user!));
}));

export const paymentWebhookHandler = safePayment(async (req, res) => {
  await processPaymentWebhook(req.body as Buffer, req.get("X-Razorpay-Signature") ?? "");
  res.json({ received: true });
});
export default router;