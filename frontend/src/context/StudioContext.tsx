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
import { cartService, followStore, SESSION_KEY, wishlistService, WISHLIST_KEY } from "../services/api";
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
  const desiredWishlist = useRef(wishlist);
  const confirmedWishlist = useRef(wishlist);
  const wishlistWriteRevision = useRef(0);
  const wishlistPending = useRef(false);
  const wishlistReady = useRef(false);
  const wishlistQueue = useRef(Promise.resolve());
  const wishlistSession = useRef(localStorage.getItem(SESSION_KEY));
  const wishlistLifecycle = useRef({ active: true });
  const changingCart = useRef(false);
  const notify = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 5000);
  }, []);
  useEffect(() => {
    let active = true;
    const lifecycle = wishlistLifecycle.current;
    lifecycle.active = true;
    const refresh = (event?: Event) => {
      const current = ++savedRevision.current;
      const currentCart = ++cartRevision.current;
      ++wishlistRevision.current;
      const currentWrite = wishlistWriteRevision.current;
      const session = localStorage.getItem(SESSION_KEY);
      wishlistSession.current = session;
      wishlistReady.current = false;
      wishlistQueue.current = Promise.resolve();
      if (event) {
        desiredWishlist.current = [];
        confirmedWishlist.current = [];
        wishlistPending.current = false;
        setWishlist([]);
      }
      Promise.all([cartService.get(), wishlistService.get()])
        .then(([savedCart, savedWishlist]) => {
          if (!active || current !== savedRevision.current) return;
          if (currentCart === cartRevision.current) setCart(savedCart);
          if (currentWrite === wishlistWriteRevision.current && session === localStorage.getItem(SESSION_KEY)) {
            confirmedWishlist.current = savedWishlist;
            if (!wishlistPending.current) {
              desiredWishlist.current = savedWishlist;
              setWishlist(savedWishlist);
            }
            wishlistReady.current = true;
          }
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
      lifecycle.active = false;
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
      const session = wishlistSession.current;
      if (session !== localStorage.getItem(SESSION_KEY)) return;
      if (!wishlistReady.current) {
        notify("Your wishlist is loading. Please try again.");
        return;
      }
      const current = savedRevision.current;
      const currentWishlist = ++wishlistRevision.current;
      wishlistPending.current = true;
      const exists = desiredWishlist.current.includes(id);
      const next = exists ? desiredWishlist.current.filter((i) => i !== id) : [...desiredWishlist.current, id];
      desiredWishlist.current = next;
      setWishlist(next);
      const isCurrentSession = () => wishlistLifecycle.current.active && current === savedRevision.current && session === localStorage.getItem(SESSION_KEY);
      wishlistQueue.current = wishlistQueue.current.then(async () => {
        if (!isCurrentSession()) return;
        try {
          const saved = await wishlistService.set(next);
          if (!isCurrentSession()) return;
          ++wishlistWriteRevision.current;
          confirmedWishlist.current = saved;
          if (currentWishlist === wishlistRevision.current) {
            wishlistPending.current = false;
            desiredWishlist.current = saved;
            setWishlist(saved);
          }
        } catch (error: unknown) {
          if (!isCurrentSession() || currentWishlist !== wishlistRevision.current) return;
          wishlistPending.current = false;
          desiredWishlist.current = confirmedWishlist.current;
          setWishlist(confirmedWishlist.current);
          notify(error instanceof Error ? error.message : "Your saved bag could not be loaded.");
        }
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
