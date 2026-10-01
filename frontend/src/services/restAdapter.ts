import type { CartItem, CollaborationInput, Collection, Creator, User } from "../types/domain";
import { normalizeCart } from "../utils/commerce";
import { apiRequest, ApiError, readToken } from "./http";
import * as mock from "./mockAdapter";

export type { AuthResult } from "./mockAdapter";
export const { DEMO_PASSWORD, SESSION_KEY, CART_KEY, WISHLIST_KEY, followStore } = mock;

const idPath = encodeURIComponent;
const write = <T>(path: string, method: string, body?: unknown, token?: string) =>
  apiRequest<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });

export const productService: typeof mock.productService = {
  list: (filters = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined) query.set(key, String(value));
    return apiRequest(`/products${query.size ? `?${query}` : ""}`);
  },
  getById: (id) => apiRequest(`/products/${idPath(id)}`),
  listRelated: (id) => apiRequest(`/products/${idPath(id)}/related`),
  listForCreator: (id) => apiRequest(`/products/manage?creatorId=${idPath(id)}`),
  listByIds: (ids) => ids.length ? write("/products/by-ids", "POST", { ids }) : Promise.resolve([]),
  saveDemo: (product) => write("/products", "POST", product),
};

export const categoryService: typeof mock.categoryService = { list: () => apiRequest("/categories") };
export const collectionService: typeof mock.collectionService = {
  list: () => apiRequest("/collections"),
  getBySlug: (slug): Promise<Collection | null> => apiRequest(`/collections/${idPath(slug)}`),
};
export const creatorService: typeof mock.creatorService = {
  list: () => apiRequest("/creators"),
  getById: (id): Promise<Creator | null> => apiRequest(`/creators/${idPath(id)}`),
  updateProfile: (id, patch) => write(`/creators/${idPath(id)}`, "PATCH", patch),
  getCollaborationFor: (_email) => apiRequest("/collaborations/me"),
  createCollaborationDraft: (input: CollaborationInput) => write("/collaborations", "POST", input),
};

let guestCart: CartItem[] = [];
function readIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}
function readGuestCart(): CartItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is CartItem =>
      !!item && typeof item === "object" && typeof item.productId === "string" && typeof item.quantity === "number") : [];
  } catch { return guestCart; }
}
function saveGuestCart(items: CartItem[]): CartItem[] {
  guestCart = items;
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { return items; }
  return items;
}
async function normalizedGuestCart(): Promise<CartItem[]> {
  const items = readGuestCart();
  return saveGuestCart(normalizeCart(items, await productService.listByIds(items.map((item) => item.productId))));
}

export const cartService: typeof mock.cartService = {
  get: () => readToken() ? apiRequest("/cart") : normalizedGuestCart(),
  addItem: async (productId, quantity = 1) => {
    if (readToken()) return write("/cart", "POST", { productId, quantity });
    const product = (await productService.listByIds([productId]))[0];
    if (!product || product.status !== "active" || product.stock === 0) throw new Error("This piece is currently unavailable.");
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Choose a valid quantity.");
    const items = await normalizedGuestCart();
    const inBag = items.find((item) => item.productId === productId)?.quantity ?? 0;
    if (inBag + quantity > product.stock) throw new Error(`Only ${product.stock} available. You already have ${inBag} in your bag.`);
    return saveGuestCart(normalizeCart([...items, { productId, quantity }], await productService.listByIds([...items.map((item) => item.productId), productId])));
  },
  updateQuantity: async (productId, quantity) => {
    if (readToken()) return quantity < 1 ? cartService.removeItem(productId) : write("/cart", "PATCH", { productId, quantity });
    saveGuestCart(readGuestCart().map((item) => item.productId === productId ? { ...item, quantity } : item));
    return normalizedGuestCart();
  },
  removeItem: async (productId) => readToken() ? write(`/cart?productId=${idPath(productId)}`, "DELETE") : saveGuestCart(readGuestCart().filter((item) => item.productId !== productId)),
  clear: async () => readToken() ? write("/cart", "DELETE") : saveGuestCart([]),
};

export const wishlistService = {
  get: (): Promise<string[]> => readToken() ? apiRequest("/wishlist") : Promise.resolve(readIds()),
  set: async (productIds: string[]): Promise<string[]> => {
    if (readToken()) return write("/wishlist", "PUT", { productIds });
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(productIds)); } catch { return productIds; }
    return productIds;
  },
};

export const orderService: typeof mock.orderService = {
  listForUser: (userId) => apiRequest(`/orders?userId=${idPath(userId)}`),
  getById: (id) => apiRequest(`/orders/${idPath(id)}`),
  listForCreator: (creatorId) => apiRequest(`/orders?creatorId=${idPath(creatorId)}`),
  create: (input) => write("/orders", "POST", input),
};

export const accountService: typeof mock.accountService = {
  getProfile: async (userId) => {
    const current = await authService.me(readToken());
    if (!userId || current?.id === userId) return current;
    const users = await apiRequest<User[]>("/users");
    return users.find((user) => user.id === userId) ?? null;
  },
  updateProfile: (_userId, patch) => write("/users/me", "PATCH", patch),
  listAddresses: (_userId) => apiRequest("/users/me/addresses"),
  saveAddress: ({ id, userId: _userId, ...address }) => write(`/users/me/addresses/${idPath(id)}`, "PUT", address),
  removeAddress: (id) => write(`/users/me/addresses/${idPath(id)}`, "DELETE"),
};

async function acceptSession(result: mock.AuthResult): Promise<mock.AuthResult> {
  try { localStorage.setItem(SESSION_KEY, result.token); } catch { return result; }
  const token = result.token;
  const items = readGuestCart();
  for (const item of items) {
    try {
      await write("/cart", "POST", item, token);
    } catch (error) {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("elysian-merge-error", {
        detail: error instanceof Error ? error.message : "Your saved bag could not be loaded.",
      }));
      return result;
    }
    saveGuestCart(readGuestCart().filter((entry) => entry.productId !== item.productId));
  }
  const localWishlist = readIds();
  if (localWishlist.length) {
    try {
      const saved = await apiRequest<string[]>("/wishlist", { headers: { Authorization: `Bearer ${token}` } });
      await write("/wishlist", "PUT", { productIds: [...new Set([...saved, ...localWishlist])] }, token);
    } catch (error) {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("elysian-merge-error", {
        detail: error instanceof Error ? error.message : "Your saved bag could not be loaded.",
      }));
      return result;
    }
  }
  localStorage.removeItem(CART_KEY);
  localStorage.removeItem(WISHLIST_KEY);
  guestCart = [];
  return result;
}

export const authService: typeof mock.authService = {
  login: async (email, password) => acceptSession(await write("/auth/login", "POST", { email, password })),
  register: async (input) => acceptSession(await write("/auth/register", "POST", input)),
  me: async (token) => {
    if (!token || token.startsWith("demo.")) return null;
    try {
      return await apiRequest<User>("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try { localStorage.removeItem(SESSION_KEY); } catch { return null; }
        return null;
      }
      throw error;
    }
  },
};

export const adminService: typeof mock.adminService = {
  getSummary: () => apiRequest("/admin/summary"),
  listUsers: () => apiRequest("/users"),
  listCreators: () => apiRequest("/creators"),
  listProducts: () => apiRequest("/products/manage"),
  listCategories: () => apiRequest("/categories"),
  listOrders: () => apiRequest("/orders"),
  listPayments: () => apiRequest("/payments"),
  listCollaborations: () => apiRequest("/collaborations"),
  reviewDemo: (id, status) => write(`/collaborations/${idPath(id)}`, "PATCH", { status }),
};

export function resetDemoData(): void {
  mock.resetDemoData();
  guestCart = [];
}