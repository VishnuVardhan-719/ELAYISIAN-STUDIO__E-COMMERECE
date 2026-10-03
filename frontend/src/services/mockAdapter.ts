import { categories, collections } from "../data/mock";
import type { AccountPreferences } from "../types/preferences";
import type {
  Address,
  CartItem,
  Collaboration,
  CollaborationInput,
  Creator,
  Order,
  Product,
  ProductFilters,
  User,
} from "../types/domain";
import {
  filterProducts,
  normalizeCart,
  validateCollaboration,
} from "../utils/commerce";
import {
  DEMO_PASSWORD,
  SESSION_KEY,
  demoDigest,
  readState,
  resetState,
  updateState,
} from "./store";

export { DEMO_PASSWORD, SESSION_KEY };

const copy = <T>(value: T): T => structuredClone(value);
async function respond<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return copy(value);
}

function nextSequentialId(
  existing: string[],
  prefix: string,
  width: number,
): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highest = existing.reduce((max, id) => {
    const match = pattern.exec(id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(width, "0")}`;
}

export const productService = {
  list: (filters: ProductFilters = {}) =>
    respond(filterProducts(readState().products, filters)),
  getById: (id: string) =>
    respond(
      readState().products.find((p) => p.id === id && p.status === "active") ??
        null,
    ),
  listRelated: (id: string) => {
    const products = readState().products;
    const categoryId = products.find((p) => p.id === id)?.categoryId;
    return respond(
      products
        .filter(
          (p) =>
            p.id !== id && p.status === "active" && p.categoryId === categoryId,
        )
        .slice(0, 4),
    );
  },
  listForCreator: (id: string) =>
    respond(readState().products.filter((p) => p.creatorId === id)),
  listByIds: (ids: string[]) =>
    respond(readState().products.filter((p) => ids.includes(p.id))),
  saveDemo: (product: Product) => {
    if (
      !product.name.trim() ||
      !Number.isFinite(product.price) ||
      product.price <= 0 ||
      !Number.isInteger(product.stock) ||
      product.stock < 0
    )
      return Promise.reject(
        new Error("Enter a name, positive price and valid stock."),
      );
    updateState((state) => {
      state.products = state.products.some((p) => p.id === product.id)
        ? state.products.map((p) => (p.id === product.id ? copy(product) : p))
        : [...state.products, copy(product)];
    });
    return respond(product);
  },
};

export const categoryService = { list: () => respond(categories) };

export const collectionService = {
  list: () => respond(collections),
  getBySlug: (slug: string) =>
    respond(collections.find((c) => c.slug === slug) ?? null),
};

export const creatorService = {
  list: () => respond(readState().creators),
  getById: (id: string) =>
    respond(readState().creators.find((c) => c.id === id) ?? null),
  updateProfile: (id: string, patch: Partial<Omit<Creator, "id">>) => {
    const state = updateState((draft) => {
      draft.creators = draft.creators.map((creator) =>
        creator.id === id ? { ...creator, ...patch } : creator,
      );
    });
    return respond(state.creators.find((creator) => creator.id === id) ?? null);
  },
  getCollaborationFor: (email: string) => {
    const matches = readState().collaborations.filter(
      (entry) => entry.email.toLowerCase() === email.trim().toLowerCase(),
    );
    return respond(matches.at(-1) ?? null);
  },
  createCollaborationDraft: async (input: CollaborationInput) => {
    if (Object.keys(validateCollaboration(input)).length)
      throw new Error("Please check the application fields.");
    const state = updateState((draft) => {
      draft.collaborations = [
        ...draft.collaborations,
        {
          id: nextSequentialId(
            draft.collaborations.map((entry) => entry.id),
            "COL",
            3,
          ),
          creatorName: input.name,
          email: input.email,
          categoryId: input.categoryId,
          description: input.description,
          status: "pending",
          date: new Date().toISOString().slice(0, 10),
        },
      ];
    });
    const created = state.collaborations[state.collaborations.length - 1];
    return respond(created);
  },
};

export const followStore = {
  read: (): string[] => readState().follows,
  toggle: (id: string): string[] =>
    updateState((state) => {
      state.follows = state.follows.includes(id)
        ? state.follows.filter((entry) => entry !== id)
        : [...state.follows, id];
    }).follows,
};

export const CART_KEY = "elysian-cart-v1";
export const WISHLIST_KEY = "elysian-wishlist-v1";

let fallbackCart: CartItem[] = [];

function readCart(): CartItem[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return normalizeCart(
      Array.isArray(stored)
        ? stored.filter(
            (entry): entry is CartItem =>
              !!entry &&
              typeof entry === "object" &&
              typeof (entry as CartItem).productId === "string" &&
              typeof (entry as CartItem).quantity === "number",
          )
        : [],
      readState().products,
    );
  } catch {
    return fallbackCart;
  }
}

const getCart = () => readCart();
function saveCart(items: CartItem[]) {
  const normalized = normalizeCart(items, readState().products);
  fallbackCart = normalized;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(normalized));
  } catch {
    /* Storage is optional; the session remains functional. */
  }
  return respond(normalized);
}
export const cartService = {
  get: () => respond(getCart()),
  addItem: async (productId: string, quantity = 1) => {
    const product = readState().products.find(
      (p) => p.id === productId && p.status === "active",
    );
    if (!product || product.stock === 0)
      throw new Error("This piece is currently unavailable.");
    if (!Number.isInteger(quantity) || quantity < 1)
      throw new Error("Choose a valid quantity.");
    const inBag =
      getCart().find((item) => item.productId === productId)?.quantity || 0;
    if (inBag + quantity > product.stock)
      throw new Error(
        `Only ${product.stock} available. You already have ${inBag} in your bag.`,
      );
    return saveCart([...getCart(), { productId, quantity }]);
  },
  updateQuantity: (productId: string, quantity: number) =>
    saveCart(
      getCart().map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    ),
  removeItem: (id: string) =>
    saveCart(getCart().filter((item) => item.productId !== id)),
  clear: () => saveCart([]),
};

export interface PlaceOrderInput {
  userId: string;
  items: CartItem[];
  address: Omit<Address, "id" | "userId">;
}

export const orderService = {
  listForUser: (id: string) =>
    respond(readState().orders.filter((o) => o.userId === id)),
  getById: (id: string) =>
    respond(readState().orders.find((o) => o.id === id) ?? null),
  listForCreator: (id: string) => {
    const { orders, products } = readState();
    return respond(
      orders.flatMap((order) => {
        const items = order.items.filter((item) =>
          products.some(
            (p) => p.id === item.productId && p.creatorId === id,
          ),
        );
        return items.length
          ? [
              {
                ...order,
                items,
                total: items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
              },
            ]
          : [];
      }),
    );
  },
  create: async (input: PlaceOrderInput): Promise<Order> => {
    if (!input.items.length) throw new Error("Your bag is empty.");
    let created: Order | undefined;
    updateState((state) => {
      const lines = input.items.flatMap((item) => {
        const product = state.products.find(
          (p) => p.id === item.productId && p.status === "active",
        );
        if (!product) return [];
        if (item.quantity > product.stock)
          throw new Error(`Only ${product.stock} of ${product.name} remain.`);
        return [
          {
            productId: product.id,
            name: product.name,
            quantity: item.quantity,
            unitPrice: product.price,
          },
        ];
      });
      if (!lines.length)
        throw new Error("None of these pieces are available any more.");

      const total = lines.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const order: Order = {
        id: nextSequentialId(
          state.orders.map((o) => o.id),
          "ELS",
          4,
        ),
        userId: input.userId,
        date: new Date().toISOString().slice(0, 10),
        items: lines,
        total,
        status: "Processing",
      };
      state.orders = [...state.orders, order];
      state.payments = [
        ...state.payments,
        {
          id: nextSequentialId(
            state.payments.map((p) => p.id),
            "PAY",
            3,
          ),
          orderId: order.id,
          amount: total,
          method: "UPI (sample)",
          status: "Recorded demo",
        },
      ];
      state.products = state.products.map((product) => {
        const line = lines.find((l) => l.productId === product.id);
        return line ? { ...product, stock: product.stock - line.quantity } : product;
      });
      created = order;
    });
    return respond(created!);
  },
};

export const accountService = {
  getPreferences: async (userId: string): Promise<AccountPreferences> => {
    const stored = localStorage.getItem(`elysian-preferences-v1:${userId}`);
    const preferences = stored ? JSON.parse(stored) : null;
    return respond({
      makersAndCollections: typeof preferences?.makersAndCollections === "boolean" ? preferences.makersAndCollections : true,
      studioStories: typeof preferences?.studioStories === "boolean" ? preferences.studioStories : true,
    });
  },
  savePreferences: async (userId: string, preferences: AccountPreferences): Promise<AccountPreferences> => {
    localStorage.setItem(`elysian-preferences-v1:${userId}`, JSON.stringify(preferences));
    return respond(preferences);
  },
  getProfile: (userId?: string): Promise<User | null> => {
    const { users } = readState();
    return respond(
      users.find((user) => user.id === userId) ?? users[0] ?? null,
    );
  },
  updateProfile: (userId: string, patch: Partial<Pick<User, "name" | "email">>) => {
    const state = updateState((draft) => {
      const previousEmail = draft.users.find(
        (user) => user.id === userId,
      )?.email;
      draft.users = draft.users.map((user) =>
        user.id === userId ? { ...user, ...patch } : user,
      );
      if (patch.email && previousEmail && previousEmail !== patch.email) {
        const digest = draft.credentials[previousEmail];
        if (digest) {
          delete draft.credentials[previousEmail];
          draft.credentials[patch.email] = digest;
        }
      }
    });
    return respond(state.users.find((user) => user.id === userId) ?? null);
  },
  listAddresses: (userId?: string) => {
    const { addresses } = readState();
    return respond(
      userId ? addresses.filter((a) => a.userId === userId) : addresses,
    );
  },
  saveAddress: (address: Address) => {
    const state = updateState((draft) => {
      draft.addresses = [
        ...draft.addresses.filter((entry) => entry.id !== address.id),
        address,
      ];
    });
    return respond(state.addresses);
  },
  removeAddress: (id: string) => {
    const state = updateState((draft) => {
      draft.addresses = draft.addresses.filter((entry) => entry.id !== id);
    });
    return respond(state.addresses);
  },
};

export interface AuthResult {
  token: string;
  user: User;
}

export const authService = {
  login: async (email: string, password: string): Promise<AuthResult> => {
    const { users, credentials } = readState();
    const user = users.find(
      (entry) => entry.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!user || credentials[user.email] !== demoDigest(password))
      throw new Error("That email and password combination was not found.");
    return respond({ token: `demo.${user.id}`, user });
  },
  register: async (input: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthResult> => {
    const email = input.email.trim().toLowerCase();
    if (input.name.trim().length < 2)
      throw new Error("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Enter a valid email address.");
    if (input.password.length < 8)
      throw new Error("Choose a password of at least 8 characters.");
    if (readState().users.some((user) => user.email.toLowerCase() === email))
      throw new Error("An account already exists for that email.");
    const state = updateState((draft) => {
      const user: User = {
        id: `user-${Date.now().toString(36)}`,
        name: input.name.trim(),
        email,
        role: "customer",
      };
      draft.users = [...draft.users, user];
      draft.credentials = {
        ...draft.credentials,
        [email]: demoDigest(input.password),
      };
    });
    const user = state.users[state.users.length - 1];
    return respond({ token: `demo.${user.id}`, user });
  },
  me: (token: string | null) => {
    if (!token) return respond<User | null>(null);
    const id = token.startsWith("demo.") ? token.slice(5) : null;
    return respond(readState().users.find((user) => user.id === id) ?? null);
  },
};

export const adminService = {
  getSummary: () => {
    const { products, creators, orders, collaborations } = readState();
    return respond({
      products: products.length,
      creators: creators.length,
      orders: orders.length,
      pending: collaborations.filter((c) => c.status === "pending").length,
      lowStock: products.filter((p) => p.stock < 4).length,
    });
  },
  listUsers: () => respond(readState().users),
  listCreators: () => respond(readState().creators),
  listProducts: () => respond(readState().products),
  listCategories: () => respond(categories),
  listOrders: () => respond(readState().orders),
  listPayments: () => respond(readState().payments),
  listCollaborations: () => respond(readState().collaborations),
  reviewDemo: (id: string, status: Collaboration["status"]) => {
    const state = updateState((draft) => {
      draft.collaborations = draft.collaborations.map((entry) =>
        entry.id === id ? { ...entry, status } : entry,
      );
    });
    return respond(state.collaborations);
  },
};

export function resetDemoData(): void {
  resetState();
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(WISHLIST_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Nothing to clear. */
  }
  fallbackCart = [];
}
