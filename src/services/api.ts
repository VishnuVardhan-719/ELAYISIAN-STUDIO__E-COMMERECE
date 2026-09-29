// Components depend on this service contract. Replace mockAdapter with a REST adapter here.
export * from "./mockAdapter";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok)
    throw new ApiError(
      "The studio could not load this information. Please try again.",
      response.status,
    );
  return response.json() as Promise<T>;
}
