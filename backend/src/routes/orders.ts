import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { gatewayConfigured } from "../payments";
import {
  createCheckout,
  getOrderById,
  listOrders,
  listOrdersForCreator,
  listOrdersForUser,
} from "../store";

const router = Router();

const orderQuerySchema = z
  .strictObject({
    userId: z.string().min(1).optional(),
    creatorId: z.string().min(1).optional(),
  })
  .refine((query) => !(query.userId && query.creatorId));

export const addressSchema = z.strictObject({
  name: z.string().trim().min(1),
  line: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  postalCode: z.string().regex(/^[1-9][0-9]{5}$/),
  phone: z.string().regex(/^[6-9][0-9]{9}$/),
});

export const paymentCheckoutSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ),
  address: addressSchema,
});

const checkoutSchema = paymentCheckoutSchema.extend({ userId: z.string().min(1) });

router.use("/orders", requireAuth);

router.get("/orders", async (req, res) => {
  const query = orderQuerySchema.parse(req.query);
  if (query.creatorId) {
    if (
      req.user!.role !== "admin" &&
      (req.user!.role !== "creator" || req.user!.creatorId !== query.creatorId)
    )
      throw new HttpError(403, "You do not have access to this resource.");
    res.json(await listOrdersForCreator(query.creatorId));
    return;
  }
  if (query.userId) {
    if (req.user!.role !== "admin" && req.user!.id !== query.userId)
      throw new HttpError(403, "You do not have access to this resource.");
    res.json(await listOrdersForUser(query.userId));
    return;
  }
  res.json(
    req.user!.role === "admin"
      ? await listOrders()
      : await listOrdersForUser(req.user!.id),
  );
});

router.get("/orders/:id", async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const order = await getOrderById(id);
  if (!order) {
    res.json(null);
    return;
  }
  if (req.user!.role === "admin" || order.userId === req.user!.id) {
    res.json(order);
    return;
  }
  if (req.user!.role === "creator" && req.user!.creatorId) {
    const creatorOrders = await listOrdersForCreator(req.user!.creatorId);
    res.json(creatorOrders.find((entry) => entry.id === id) ?? null);
    return;
  }
  res.json(null);
});

router.post("/orders", async (req, res) => {
  if (gatewayConfigured()) throw new HttpError(409, "Use verified sandbox checkout for this order.");
  const input = checkoutSchema.parse(req.body);
  if (input.userId !== req.user!.id)
    throw new HttpError(403, "You do not have access to this resource.");
  try {
    res.status(201).json(await createCheckout(input));
  } catch (error) {
    if (error instanceof Error) throw new HttpError(400, error.message);
    throw error;
  }
});

export default router;