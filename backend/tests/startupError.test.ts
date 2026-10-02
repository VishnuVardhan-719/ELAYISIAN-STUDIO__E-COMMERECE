import { describe, expect, it } from "vitest";
import { startupFailure } from "../src/startupError";

describe("private startup diagnostics", () => {
  it("identifies a database selection timeout without printing credentials", () => {
    const message = startupFailure({ name: "MongooseServerSelectionError", message: "mongodb+srv://private-password@private-host/database" });
    expect(message).toContain("database connection timed out");
    expect(message).toContain("Atlas network access");
    expect(message).not.toContain("private");
  });

  it("identifies database authentication rejection using its numeric code", () => {
    expect(startupFailure({ code: 18, message: "secret-password" })).toContain("database authentication rejected");
  });

  it("never echoes arbitrary provider or environment errors", () => {
    expect(startupFailure(new Error("secret-token"))).toBe("[api] failed to start. Check server configuration and database availability.");
    expect(startupFailure(null)).not.toContain("null");
  });
});