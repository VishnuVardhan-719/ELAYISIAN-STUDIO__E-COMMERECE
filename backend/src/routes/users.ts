import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import {
  listAddresses,
  listUsers,
  removeAddress,
  saveAddress,
  updateUser,
} from "../store";

const router = Router();

const profileSchema = z
  .strictObject({
    name: z.string().trim().min(2).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
  })
  .refine((patch) => patch.name !== undefined || patch.email !== undefined);

const addressSchema = z.strictObject({
  name: z.string().trim().min(1),
  line: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  postalCode: z.string().regex(/^[1-9][0-9]{5}$/),
  phone: z.string().regex(/^[6-9][0-9]{9}$/),
});

router.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(await listUsers());
});

router.patch("/users/me", requireAuth, async (req, res) => {
  const patch = profileSchema.parse(req.body);
  try {
    res.json(await updateUser(req.user!.id, patch));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "An account already exists for that email."
    )
      throw new HttpError(409, error.message);
    throw error;
  }
});

router.get("/users/me/addresses", requireAuth, async (req, res) => {
  res.json(await listAddresses(req.user!.id));
});

router.put("/users/me/addresses/:id", requireAuth, async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const address = addressSchema.parse(req.body);
  try {
    res.json(await saveAddress(req.user!.id, { id, ...address }));
  } catch (error) {
    if (error instanceof Error) throw new HttpError(404, error.message);
    throw error;
  }
});

router.delete("/users/me/addresses/:id", requireAuth, async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  try {
    res.json(await removeAddress(req.user!.id, id));
  } catch (error) {
    if (error instanceof Error) throw new HttpError(404, error.message);
    throw error;
  }
});

export default router;