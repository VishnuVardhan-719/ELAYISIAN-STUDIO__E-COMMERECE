import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import {
  addCartItem,
  clearCart,
  getCart,
  getWishlist,
  removeCartItem,
  setWishlist,
  updateCartItem,
} from "../store";

const router = Router();

const cartItemSchema = z.strictObject({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const wishlistSchema = z.strictObject({
  productIds: z.array(z.string().min(1)),
});

async function cartWrite<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Error) throw new HttpError(400, error.message);
    throw error;
  }
}

router.use("/cart", requireAuth);
router.use("/wishlist", requireAuth);

router.get("/cart", async (req, res) => {
  res.json(await getCart(req.user!.id));
});

router.post("/cart", async (req, res) => {
  const { productId, quantity } = cartItemSchema.parse(req.body);
  res.json(
    await cartWrite(() => addCartItem(req.user!.id, productId, quantity)),
  );
});

router.patch("/cart", async (req, res) => {
  const { productId, quantity } = cartItemSchema
    .extend({ quantity: z.number().int().nonnegative() })
    .parse(req.body);
  res.json(await updateCartItem(req.user!.id, productId, quantity));
});

router.delete("/cart", async (req, res) => {
  const productId = z.string().min(1).optional().parse(req.query.productId);
  res.json(
    productId
      ? await removeCartItem(req.user!.id, productId)
      : await clearCart(req.user!.id),
  );
});

router.get("/wishlist", async (req, res) => {
  res.json(await getWishlist(req.user!.id));
});

router.put("/wishlist", async (req, res) => {
  const { productIds } = wishlistSchema.parse(req.body);
  res.json(await setWishlist(req.user!.id, productIds));
});

export default router;