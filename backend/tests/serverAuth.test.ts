import type { NextFunction, Request, Response } from "express";
import { sign } from "jsonwebtoken";
import mongoose from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { env } from "../src/env";
import { requireAuth, requireRole } from "../src/middleware/auth";
import { HttpError } from "../src/middleware/errors";
import { getUserById, resetStore } from "../src/store";

const TEST_URI = "mongodb://127.0.0.1:27017/elysian_test_auth";

function request(authorization?: string): Request {
  return { headers: authorization ? { authorization } : {} } as Request;
}

async function run(
  middleware: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
) {
  const next = vi.fn();
  await middleware(req, {} as Response, next);
  return next;
}

describe("server auth middleware", () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await resetStore();
  });

  it("resolves the current user from a valid token subject", async () => {
    const token = sign({ role: "admin" }, env.jwtSecret, {
      subject: "demo-customer",
      expiresIn: "1h",
    });
    const req = request(`Bearer ${token}`);
    const next = await run(requireAuth, req);

    expect(req.user).toEqual(await getUserById("demo-customer"));
    expect(req.user?.role).toBe("customer");
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ["missing header", undefined],
    ["wrong scheme", "Basic token"],
    ["bad signature", `Bearer ${sign({}, "wrong-secret", { subject: "demo-customer" })}`],
    ["missing subject", `Bearer ${sign({}, env.jwtSecret)}`],
    [
      "expired token",
      `Bearer ${sign({}, env.jwtSecret, {
        subject: "demo-customer",
        expiresIn: -1,
      })}`,
    ],
    [
      "unknown user",
      `Bearer ${sign({}, env.jwtSecret, { subject: "missing-user" })}`,
    ],
  ])("rejects %s as unauthenticated", async (_name, authorization) => {
    const req = request(authorization);
    const next = await run(requireAuth, req);
    const error = next.mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 401 });
    expect(req.user).toBeUndefined();
  });

  it("allows an authenticated user with an accepted role", async () => {
    const req = request();
    req.user = (await getUserById("demo-creator")) ?? undefined;
    const next = await run(requireRole("creator", "admin"), req);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an authenticated user without an accepted role", async () => {
    const req = request();
    req.user = (await getUserById("demo-customer")) ?? undefined;
    const next = await run(requireRole("admin"), req);

    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 403 });
  });

  it("fails closed when the role guard has no authenticated user", async () => {
    const next = await run(requireRole("admin"), request());

    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 401 });
  });
});