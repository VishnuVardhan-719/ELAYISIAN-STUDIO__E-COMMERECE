import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAdminAnalytics, getAdminSummary, listPayments } from "../store";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/payments", async (_req, res) => {
  res.json(await listPayments());
});

router.get("/admin/summary", async (_req, res) => {
  res.json(await getAdminSummary());
});

router.get("/admin/analytics", async (_req, res) => {
  res.json(await getAdminAnalytics());
});

export default router;