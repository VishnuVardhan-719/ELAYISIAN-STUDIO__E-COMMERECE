import cors from "cors";
import express from "express";
import { env } from "./env";
import { errorHandler, notFound } from "./middleware/errors";

const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, database: "memory" });
});

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});