import cors from "cors";
import express from "express";
import { extname, join, resolve } from "node:path";
import { dbState } from "../../database/src/db";
import { env } from "./env";
import { errorHandler, notFound } from "./middleware/errors";
import adminRouter from "./routes/admin";
import authRouter from "./routes/auth";
import catalogueRouter from "./routes/catalogue";
import collaborationsRouter from "./routes/collaborations";
import ordersRouter from "./routes/orders";
import paymentsRouter, { paymentWebhookHandler } from "./routes/payments";
import savedStateRouter from "./routes/savedState";
import usersRouter from "./routes/users";

export function createApp({ staticDir }: { staticDir?: string } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin" });
    next();
  });
  app.use(cors({ origin: env.clientOrigin }));
  app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "100kb" }), paymentWebhookHandler);

  const attempts = new Map<string, { count: number; expires: number }>();
  app.post(["/api/auth/login", "/api/auth/register"], (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
    const key = `${req.path}:${req.ip}`;
    const entry = attempts.get(key) ?? { count: 0, expires: now + 15 * 60_000 };
    attempts.set(key, entry);
    if (++entry.count > 20) {
      res.set("Retry-After", String(Math.ceil((entry.expires - now) / 1000)));
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }
    next();
  });
  app.use(express.json());
  app.get("/api/health", (_req, res) => {
    const database = dbState();
    const ok = database === "connected";
    res.status(ok ? 200 : 503).json({ ok, database });
  });
  app.use("/api/auth", authRouter);
  app.use("/api", paymentsRouter);
  app.use("/api", catalogueRouter);
  app.use("/api", collaborationsRouter);
  app.use("/api", savedStateRouter);
  app.use("/api", ordersRouter);
  app.use("/api", usersRouter);
  app.use("/api", adminRouter);
  app.use("/api", notFound);
  if (staticDir) {
    const root = resolve(staticDir);
    app.use(express.static(root));
    app.use((req, res, next) => {
      if (!["GET", "HEAD"].includes(req.method) || !req.accepts("html") ||
          extname(req.path) || req.path.split("/").some((part) => part.startsWith(".")) ||
          /^\/(assets|images)(\/|$)/i.test(req.path)) {
        next();
        return;
      }
      res.sendFile(join(root, "index.html"), (error) => { if (error) next(error); });
    });
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}