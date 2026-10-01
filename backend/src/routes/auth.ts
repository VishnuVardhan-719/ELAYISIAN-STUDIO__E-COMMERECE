import { compareSync } from "bcryptjs";
import { Router } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import type { User } from "../../../frontend/src/types/domain";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { createUser, getUserByEmail } from "../store";

const router = Router();

const loginSchema = z.strictObject({
  email: z.string(),
  password: z.string().min(1),
});

const registerSchema = z.strictObject({
  name: z.string(),
  email: z.string(),
  password: z.string(),
});

function tokenFor(user: User): string {
  return jwt.sign({}, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    throw new HttpError(
      401,
      "That email and password combination was not found.",
    );
  const stored = await getUserByEmail(parsed.data.email);
  if (!stored || !compareSync(parsed.data.password, stored.passwordHash))
    throw new HttpError(
      401,
      "That email and password combination was not found.",
    );
  res.json({ token: tokenFor(stored.user), user: stored.user });
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const input = {
    name: parsed.data.name.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  };
  if (input.name.length < 2) throw new HttpError(400, "Enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    throw new HttpError(400, "Enter a valid email address.");
  if (input.password.length < 8)
    throw new HttpError(400, "Choose a password of at least 8 characters.");
  if (Buffer.byteLength(input.password, "utf8") > 72)
    throw new HttpError(400, "Choose a password of at most 72 bytes.");
  if (await getUserByEmail(input.email))
    throw new HttpError(409, "An account already exists for that email.");
  const user = await createUser(input);
  res.status(201).json({ token: tokenFor(user), user });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;