import * as mock from "./mockAdapter";
import * as rest from "./restAdapter";
import { paymentService as payments } from "./paymentService";

export { ApiError, apiRequest } from "./http";
export type { AuthResult } from "./mockAdapter";
export type { PaymentAttempt } from "./paymentService";
export const paymentService = import.meta.env.VITE_API_MODE === "rest" ? payments : {
  config: async () => ({ enabled: false, mode: "test" as const }),
  reconcile: async () => null,
  load: async () => {},
  create: async (): Promise<never> => { throw new Error("Sandbox payments are disabled in demo mode."); },
  resume: async (): Promise<never> => { throw new Error("Sandbox payments are disabled in demo mode."); },
};

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
