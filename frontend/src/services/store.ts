import {
  addresses as seedAddresses,
  collaborations as seedCollaborations,
  creators as seedCreators,
  orders as seedOrders,
  payments as seedPayments,
  products as seedProducts,
  users as seedUsers,
} from "../data/mock";
import type {
  Address,
  Collaboration,
  Creator,
  Order,
  Payment,
  Product,
  User,
} from "../types/domain";

const STORAGE_KEY = "elysian-demo-v1";
const VERSION = 1;

/** Where the mock session token lives, so a demo reset can also sign you out. */
export const SESSION_KEY = "elysian-session-v1";

/**
 * The password every seeded demo account shares. Documented in the README so a
 * reviewer can sign in; replaced by real bcrypt + JWT credentials in Phase 2.
 */
export const DEMO_PASSWORD = "elysian123";

export interface DemoState {
  version: number;
  products: Product[];
  creators: Creator[];
  orders: Order[];
  payments: Payment[];
  collaborations: Collaboration[];
  addresses: Address[];
  users: User[];
  follows: string[];
  credentials: Record<string, string>;
}

/**
 * Demo-only obfuscation so the store never holds plaintext passwords. This is
 * NOT security - it is a placeholder until bcrypt arrives with the API.
 */
export function demoDigest(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return `d1$${hash.toString(16)}`;
}

function seedState(): DemoState {
  const users = structuredClone(seedUsers);
  const creator = users.find((user) => user.role === "creator");
  if (creator) creator.creatorId = seedCreators[0]?.id;
  return {
    version: VERSION,
    products: structuredClone(seedProducts),
    creators: structuredClone(seedCreators),
    orders: structuredClone(seedOrders),
    payments: structuredClone(seedPayments),
    collaborations: structuredClone(seedCollaborations),
    addresses: structuredClone(seedAddresses).map((address) => ({
      ...address,
      userId: "demo-customer",
    })),
    users,
    follows: [],
    credentials: Object.fromEntries(
      seedUsers.map((user) => [user.email, demoDigest(DEMO_PASSWORD)]),
    ),
  };
}

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoState>;
  return (
    candidate.version === VERSION &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.creators) &&
    Array.isArray(candidate.orders) &&
    Array.isArray(candidate.users) &&
    typeof candidate.credentials === "object"
  );
}

export function writeState(state: DemoState): DemoState {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Storage is optional; the session keeps working in memory. */
  }
  return state;
}

export function readState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isDemoState(parsed)) return parsed;
    }
  } catch {
    /* A corrupt or unavailable store falls back to the seed below. */
  }
  return writeState(seedState());
}

export function updateState(mutate: (state: DemoState) => void): DemoState {
  const state = readState();
  mutate(state);
  return writeState(state);
}

export function resetState(): DemoState {
  return writeState(seedState());
}
