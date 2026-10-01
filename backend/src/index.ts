import cors from "cors";
import express from "express";
import { connectDb, dbState } from "../../database/src/db";
import { env } from "./env";
import { errorHandler, notFound } from "./middleware/errors";
import adminRouter from "./routes/admin";
import authRouter from "./routes/auth";
import catalogueRouter from "./routes/catalogue";
import collaborationsRouter from "./routes/collaborations";
import ordersRouter from "./routes/orders";
import savedStateRouter from "./routes/savedState";
import usersRouter from "./routes/users";

const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, database: dbState() });
});

app.use("/api/auth", authRouter);
app.use("/api", catalogueRouter);
app.use("/api", collaborationsRouter);
app.use("/api", savedStateRouter);
app.use("/api", ordersRouter);
app.use("/api", usersRouter);
app.use("/api", adminRouter);

app.use(notFound);
app.use(errorHandler);

async function start(): Promise<void> {
  await connectDb();
  app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[api] failed to start: ${message}`);
  process.exit(1);
});