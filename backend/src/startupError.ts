export function startupFailure(error: unknown): string {
  if (error && typeof error === "object") {
    const { name, code } = error as { name?: unknown; code?: unknown };
    if (code === 18) return "[api] database authentication rejected. Check the configured database user.";
    if (name === "MongooseServerSelectionError" || name === "MongoServerSelectionError")
      return "[api] database connection timed out. Check Atlas network access, cluster availability and outbound connectivity.";
  }
  return "[api] failed to start. Check server configuration and database availability.";
}