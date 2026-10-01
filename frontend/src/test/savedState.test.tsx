import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioProvider, useStudio } from "../context/StudioContext";
import { cartService, wishlistService } from "../services/api";

function SavedState() {
  const { cart, wishlist } = useStudio();
  return <div>{cart.reduce((sum, item) => sum + item.quantity, 0)} bag / {wishlist.length} saved</div>;
}

describe("Session saved state", () => {
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