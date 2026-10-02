import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioProvider, useStudio } from "../context/StudioContext";
import { cartService, wishlistService } from "../services/api";

function SavedState() {
  const { cart, wishlist } = useStudio();
  return <div>{cart.reduce((sum, item) => sum + item.quantity, 0)} bag / {wishlist.length} saved</div>;
}

function ChangeBag() {
  const { addToCart } = useStudio();
  return <button onClick={() => { void addToCart("sunset-vase"); void addToCart("sunset-vase"); }}>Add twice</button>;
}

function SavePiece() {
  const { toggleWishlist } = useStudio();
  return <button onClick={() => toggleWishlist("sunset-vase")}>Save piece</button>;
}

describe("Session saved state", () => {
  it.each([true, false])("preserves the saved bag when quick-add fails during refresh (failure first: %s)", async (failureFirst) => {
    let finishRefresh!: (items: { productId: string; quantity: number }[]) => void;
    let failAdd!: (error: Error) => void;
    vi.spyOn(cartService, "get").mockImplementation(() => new Promise(resolve => { finishRefresh = resolve; }));
    vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    vi.spyOn(cartService, "addItem").mockImplementation(() => new Promise((_resolve, reject) => { failAdd = reject; }));
    render(<StudioProvider><ChangeBag /><SavedState /></StudioProvider>);
    act(() => screen.getByRole("button", { name: "Add twice" }).click());
    const saved = [{ productId: "sunset-vase", quantity: 2 }];
    if (failureFirst) {
      await act(async () => failAdd(new Error("Stock changed.")));
      await act(async () => finishRefresh(saved));
    } else {
      await act(async () => finishRefresh(saved));
      await act(async () => failAdd(new Error("Stock changed.")));
    }
    expect(screen.getByText("2 bag / 0 saved")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Stock changed.");
  });

  it("keeps a pending cart update when the wishlist changes", async () => {
    let finish!: (items: { productId: string; quantity: number }[]) => void;
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "set").mockResolvedValue(["sunset-vase"]);
    vi.spyOn(cartService, "addItem").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<StudioProvider><ChangeBag /><SavePiece /><SavedState /></StudioProvider>);
    await waitFor(() => expect(cartService.get).toHaveBeenCalled());
    act(() => screen.getByRole("button", { name: "Add twice" }).click());
    act(() => screen.getByRole("button", { name: "Save piece" }).click());
    await act(async () => finish([{ productId: "sunset-vase", quantity: 1 }]));
    expect(screen.getByText("1 bag / 1 saved")).toBeVisible();
  });

  it("ignores overlapping cart changes rather than sending duplicate requests", async () => {
    let finish!: (items: { productId: string; quantity: number }[]) => void;
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    const add = vi.spyOn(cartService, "addItem").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<StudioProvider><ChangeBag /><SavedState /></StudioProvider>);
    await screen.findByText("0 bag / 0 saved");
    act(() => screen.getByRole("button", { name: "Add twice" }).click());
    expect(add).toHaveBeenCalledOnce();
    await act(async () => finish([{ productId: "sunset-vase", quantity: 1 }]));
    expect(screen.getByText("1 bag / 0 saved")).toBeVisible();
  });

  it("does not let an older initial refresh overwrite a completed cart update", async () => {
    let finishRefresh!: (items: { productId: string; quantity: number }[]) => void;
    vi.spyOn(cartService, "get").mockImplementation(() => new Promise(resolve => { finishRefresh = resolve; }));
    vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    vi.spyOn(cartService, "addItem").mockResolvedValue([{ productId: "sunset-vase", quantity: 1 }]);
    render(<StudioProvider><ChangeBag /><SavedState /></StudioProvider>);
    act(() => screen.getByRole("button", { name: "Add twice" }).click());
    await screen.findByText("1 bag / 0 saved");
    await act(async () => finishRefresh([]));
    expect(screen.getByText("1 bag / 0 saved")).toBeVisible();
  });

  it("reloads saved items after login and removes another user's state on logout", async () => {
    const getCart = vi.spyOn(cartService, "get").mockResolvedValue([]);
    const getWishlist = vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    render(<StudioProvider><SavedState /></StudioProvider>);
    await waitFor(() => expect(getCart).toHaveBeenCalled());
    getCart.mockResolvedValue([{ productId: "sunset-vase", quantity: 2 }]);
    getWishlist.mockResolvedValue(["sunset-vase"]);
    act(() => window.dispatchEvent(new Event("elysian-session-change")));
    await screen.findByText("2 bag / 1 saved");
    getCart.mockResolvedValue([]);
    getWishlist.mockResolvedValue([]);
    act(() => window.dispatchEvent(new Event("elysian-session-change")));
    await screen.findByText("0 bag / 0 saved");
  });
});