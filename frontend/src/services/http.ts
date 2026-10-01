import { SESSION_KEY } from "./store";

export class ApiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.name = "ApiError";
  }
}

export function readToken(): string | null {
  try {
    const token = localStorage.getItem(SESSION_KEY);
    return token && !token.startsWith("demo.") ? token : null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = readToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(
      typeof body?.error === "string" ? body.error : "The studio could not load this information. Please try again.",
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}