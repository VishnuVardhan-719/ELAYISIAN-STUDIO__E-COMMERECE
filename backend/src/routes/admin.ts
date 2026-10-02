import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAdminAnalytics, getAdminSummary, listPayments } from "../store";

const router = Router();

router.get("/payments", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(await listPayments());
});

router.get("/admin/summary", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(await getAdminSummary());
});

router.get("/admin/analytics", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(await getAdminAnalytics());
});

export default router;