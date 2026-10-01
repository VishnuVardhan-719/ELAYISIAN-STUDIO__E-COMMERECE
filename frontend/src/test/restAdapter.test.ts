import { beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "../data/mock";
import * as api from "../services/api";

const fetchMock = vi.fn<typeof fetch>();
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json" },
});

beforeEach(() => {
  vi.stubEnv("VITE_API_MODE", "rest");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.resetModules();
});

describe("HTTP contract", () => {
  it("attaches the session token and preserves server validation messages", async () => {
    localStorage.setItem("elysian-session-v1", "jwt-token");
    fetchMock.mockResolvedValue(reply({ error: "Choose a valid quantity." }, 400));
    await expect(api.apiRequest("/cart")).rejects.toMatchObject({
      message: "Choose a valid quantity.", status: 400,
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer jwt-token");
  });

  it("encodes filters and selects REST without modifying the service contract", async () => {
    const rest = await import("../services/api");
    const page = { items: products.slice(0, 1), total: 1, pages: 1, page: 1 };
    fetchMock.mockResolvedValue(reply(page));
    expect(await rest.productService.list({ search: "clay & linen", pageSize: 4 })).toEqual(page);
    const [path] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/products?search=clay+%26+linen&pageSize=4");
  });

  it("keeps an anonymous bag locally using the live catalogue", async () => {
    const rest = await import("../services/api");
    fetchMock.mockImplementation(async () => reply(products));
    expect(await rest.cartService.addItem(products[0].id, 2)).toEqual([
      { productId: products[0].id, quantity: 2 },
    ]);
    expect(JSON.parse(localStorage.getItem(rest.CART_KEY)!)).toEqual([
      { productId: products[0].id, quantity: 2 },
    ]);
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "POST")).toBe(true);
    await expect(rest.cartService.addItem(products[0].id, 100)).rejects.toThrow(/Only/);
  });

  it("merges a guest bag and wishlist once on login without replacing the saved bag", async () => {
    const rest = await import("../services/api");
    localStorage.setItem(rest.CART_KEY, JSON.stringify([{ productId: products[0].id, quantity: 1 }]));
    localStorage.setItem(rest.WISHLIST_KEY, JSON.stringify([products[0].id]));
    fetchMock.mockImplementation(async (path, options) => {
      if (path === "/api/auth/login") return reply({ token: "jwt-token", user: { id: "demo-customer", name: "Ananya", email: "ananya@example.test", role: "customer" } });
      if (path === "/api/cart" && options?.method === "POST") return reply([{ productId: products[0].id, quantity: 3 }]);
      if (path === "/api/wishlist" && options?.method === "PUT") return reply([products[0].id, products[1].id]);
      if (path === "/api/wishlist") return reply([products[1].id]);
      return reply([{ productId: products[0].id, quantity: 2 }]);
    });
    await rest.authService.login("ananya@example.test", rest.DEMO_PASSWORD);
    expect(fetchMock.mock.calls.some(([path, options]) => path === "/api/cart" && options?.method === "DELETE")).toBe(false);
    expect(fetchMock.mock.calls.find(([path, options]) => path === "/api/cart" && options?.method === "POST")?.[1]?.body).toBe(JSON.stringify({ productId: products[0].id, quantity: 1 }));
    expect(localStorage.getItem(rest.CART_KEY)).toBeNull();
    expect(localStorage.getItem(rest.WISHLIST_KEY)).toBeNull();
  });

  it("does not send stale mock tokens to protected endpoints", async () => {
    const rest = await import("../services/api");
    expect(await rest.authService.me("demo.demo-customer")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps authentication usable when a guest merge exceeds live stock", async () => {
    const rest = await import("../services/api");
    localStorage.setItem(rest.CART_KEY, JSON.stringify([{ productId: "sunset-vase", quantity: 100 }]));
    fetchMock.mockImplementation(async (path) => path === "/api/auth/login"
      ? reply({ token: "jwt-token", user: { id: "demo-customer", role: "customer" } })
      : reply({ error: "Only 8 available. You already have 0 in your bag." }, 400));
    expect((await rest.authService.login("ananya@example.test", rest.DEMO_PASSWORD)).token).toBe("jwt-token");
    expect(JSON.parse(localStorage.getItem(rest.CART_KEY)!)).toEqual([{ productId: "sunset-vase", quantity: 100 }]);
  });
});