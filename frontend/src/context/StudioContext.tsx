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
import { cartService, followStore, wishlistService, WISHLIST_KEY } from "../services/api";
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
  const savedRevision = useRef(0);
  const cartRevision = useRef(0);
  const wishlistRevision = useRef(0);
  const changingCart = useRef(false);
  const notify = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 5000);
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const current = ++savedRevision.current;
      const currentCart = ++cartRevision.current;
      const currentWishlist = ++wishlistRevision.current;
      Promise.all([cartService.get(), wishlistService.get()])
        .then(([savedCart, savedWishlist]) => {
          if (!active || current !== savedRevision.current) return;
          if (currentCart === cartRevision.current) setCart(savedCart);
          if (currentWishlist === wishlistRevision.current) setWishlist(savedWishlist);
        })
        .catch(() => {
          if (active && current === savedRevision.current) notify("Your saved bag could not be loaded.");
        });
    };
    refresh();
    const mergeError = (event: Event) => notify((event as CustomEvent<string>).detail);
    window.addEventListener("elysian-session-change", refresh);
    window.addEventListener("elysian-merge-error", mergeError);
    return () => {
      active = false;
      window.removeEventListener("elysian-session-change", refresh);
      window.removeEventListener("elysian-merge-error", mergeError);
      clearTimeout(timer.current);
    };
  }, [notify]);
  const change = async (
    operation: () => Promise<CartItem[]>,
    message: string,
  ) => {
    if (changingCart.current) return;
    changingCart.current = true;
    const current = savedRevision.current;
    const currentCart = cartRevision.current;
    setBusy(true);
    try {
      const next = await operation();
      if (current === savedRevision.current && currentCart === cartRevision.current) {
        ++cartRevision.current;
        setCart(next);
        notify(message);
      }
    } catch (error) {
      if (current === savedRevision.current) notify(
        error instanceof Error
          ? error.message
          : "Your bag could not be updated. Please try again.",
      );
    } finally {
      changingCart.current = false;
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
      const current = savedRevision.current;
      const currentWishlist = ++wishlistRevision.current;
      const exists = wishlist.includes(id);
      const next = exists ? wishlist.filter((i) => i !== id) : [...wishlist, id];
      setWishlist(next);
      wishlistService.set(next).catch((error: unknown) => {
        if (current !== savedRevision.current || currentWishlist !== wishlistRevision.current) return;
        setWishlist(wishlist);
        notify(error instanceof Error ? error.message : "Your saved bag could not be loaded.");
      });
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
