import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "../types/domain";
import { cartService, followStore, WISHLIST_KEY } from "../services/api";
interface StudioState {
  cart: CartItem[];
  wishlist: string[];
  favorites: string[];
  notice: string;
  busy: boolean;
  addToCart: (id: string, quantity?: number) => Promise<void>;
  updateCart: (id: string, quantity: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleWishlist: (id: string) => void;
  toggleCreator: (id: string) => void;
  notify: (message: string) => void;
}
const StudioContext = createContext<StudioState | null>(null);
export function StudioProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]),
    [wishlist, setWishlist] = useState<string[]>(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
        return Array.isArray(stored)
          ? stored.filter((id: unknown) => typeof id === "string")
          : [];
      } catch {
        return [];
      }
    }),
    [favorites, setFavorites] = useState<string[]>(() => followStore.read()),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 5000);
  }, []);
  useEffect(() => {
    cartService
      .get()
      .then(setCart)
      .catch(() => notify("Your saved bag could not be loaded."));
    return () => clearTimeout(timer.current);
  }, [notify]);
  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    } catch {
      /* In-memory use is still available. */
    }
  }, [wishlist]);
  const change = async (
    operation: () => Promise<CartItem[]>,
    message: string,
  ) => {
    setBusy(true);
    try {
      setCart(await operation());
      notify(message);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Your bag could not be updated. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const value: StudioState = {
    cart,
    wishlist,
    favorites,
    notice,
    busy,
    notify,
    addToCart: (id, quantity = 1) =>
      change(() => cartService.addItem(id, quantity), "Added to your bag."),
    updateCart: (id, quantity) =>
      change(() => cartService.updateQuantity(id, quantity), "Bag updated."),
    removeFromCart: (id) =>
      change(() => cartService.removeItem(id), "Removed from your bag."),
    clearCart: () =>
      change(() => cartService.clear(), "Your bag is empty again."),
    toggleWishlist: (id) => {
      const exists = wishlist.includes(id);
      setWishlist((current) =>
        exists ? current.filter((i) => i !== id) : [...current, id],
      );
      notify(exists ? "Removed from your wishlist." : "Saved to your wishlist.");
    },
    toggleCreator: (id) => {
      const next = followStore.toggle(id);
      setFavorites(next);
      notify(
        next.includes(id)
          ? "You will see more from this maker."
          : "You no longer follow this maker.",
      );
    },
  };
  return (
    <StudioContext.Provider value={value}>
      {children}
      <div
        className={`toast ${notice ? "toastVisible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </StudioContext.Provider>
  );
}
export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("StudioProvider is missing");
  return value;
}
