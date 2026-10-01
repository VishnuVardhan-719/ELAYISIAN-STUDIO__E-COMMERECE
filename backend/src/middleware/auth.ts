import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import type { User } from "../../../frontend/src/types/domain";
import { env } from "../env";
import { getUserById } from "../store";
import { HttpError } from "./errors";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "");
  if (!match) {
    next(new HttpError(401, "Authentication required."));
    return;
  }

  try {
    const payload = jwt.verify(match[1], env.jwtSecret);
    const user =
      typeof payload !== "string" && payload.sub
        ? await getUserById(payload.sub)
        : null;
    if (!user) throw new HttpError(401, "Authentication required.");
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, "Authentication required."));
  }
}

export function requireRole(...roles: User["role"][]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, "Authentication required."));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "You do not have access to this resource."));
      return;
    }
    next();
  };
}