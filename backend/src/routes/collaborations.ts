import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import {
  createCollaboration,
  getCollaborationFor,
  listCategories,
  listCollaborations,
  reviewCollaboration,
} from "../store";

const router = Router();

const applicationSchema = z.strictObject({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  categoryId: z.string().min(1),
  portfolio: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]),
  description: z.string().trim().min(30),
  reason: z.string().trim().min(15),
  sample: z.string().trim().min(1),
  terms: z.literal(true),
});

const reviewSchema = z.strictObject({
  status: z.enum(["pending", "approved", "declined"]),
});

router.post("/collaborations", requireAuth, async (req, res) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (
    !parsed.success ||
    !(await listCategories()).some(
      (category) => category.id === parsed.data.categoryId,
    )
  )
    throw new HttpError(400, "Please check the application fields.");
  res.status(201).json(await createCollaboration(parsed.data, req.user!.id));
});

router.get("/collaborations/me", requireAuth, async (req, res) => {
  res.json(await getCollaborationFor(req.user!.id));
});

router.get(
  "/collaborations",
  requireAuth,
  requireRole("admin"),
  async (_req, res) => {
    res.json(await listCollaborations());
  },
);

router.patch(
  "/collaborations/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const { status } = reviewSchema.parse(req.body);
    const id = z.string().min(1).parse(req.params.id);
    if (!(await reviewCollaboration(id, status)))
      throw new HttpError(404, "Collaboration not found.");
    res.json(await listCollaborations());
  },
);

export default router;