import * as mock from "./mockAdapter";
import * as rest from "./restAdapter";

export { ApiError, apiRequest } from "./http";
export type { AuthResult } from "./mockAdapter";

const adapter = import.meta.env.VITE_API_MODE === "rest" ? rest : mock;
export const {
  productService, categoryService, collectionService, creatorService,
  cartService, orderService, accountService, authService, adminService,
  followStore, resetDemoData, DEMO_PASSWORD, SESSION_KEY, CART_KEY, WISHLIST_KEY,
} = adapter;

export const wishlistService = import.meta.env.VITE_API_MODE === "rest" ? rest.wishlistService : {
  get: async (): Promise<string[]> => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? "[]");
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  },
  set: async (ids: string[]): Promise<string[]> => {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids)); } catch { return ids; }
    return ids;
  },
};
