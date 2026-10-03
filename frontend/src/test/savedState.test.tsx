import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioProvider, useStudio } from "../context/StudioContext";
import { cartService, SESSION_KEY, wishlistService } from "../services/api";

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

function ChangeWishlist() {
  const { wishlist, toggleWishlist } = useStudio();
  return <>
    <div aria-label="Wishlist">{wishlist.join(",") || "empty"}</div>
    <button onClick={() => { toggleWishlist("sunset-vase"); toggleWishlist("woven-throw"); }}>Save both</button>
    <button onClick={() => { toggleWishlist("sunset-vase"); toggleWishlist("sunset-vase"); }}>Toggle twice</button>
    <button onClick={() => toggleWishlist("woven-throw")}>Save throw</button>
  </>;
}

function pendingWishlist() {
  let resolve!: (ids: string[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string[]>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("Session saved state", () => {
  it.each([false, true])("blocks replacement writes until wishlist hydration completes (session refresh: %s)", async (sessionRefresh) => {
    const refresh = pendingWishlist();
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    const get = vi.spyOn(wishlistService, "get");
    if (sessionRefresh) get.mockResolvedValueOnce([]).mockImplementationOnce(() => refresh.promise);
    else get.mockImplementation(() => refresh.promise);
    const save = vi.spyOn(wishlistService, "set").mockImplementation(async (ids) => ids);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    if (sessionRefresh) {
      await act(async () => {});
      localStorage.setItem(SESSION_KEY, "account-b");
      act(() => window.dispatchEvent(new Event("elysian-session-change")));
    }
    act(() => screen.getByRole("button", { name: "Save throw" }).click());
    await act(async () => {});
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Your wishlist is loading. Please try again.");
    await act(async () => refresh.resolve(["sunset-vase"]));
    act(() => screen.getByRole("button", { name: "Save throw" }).click());
    await waitFor(() => expect(save).toHaveBeenCalledWith(["sunset-vase", "woven-throw"]));
  });

  it("does not block a new session queue behind an unresolved old-session write", async () => {
    const oldSave = pendingWishlist();
    localStorage.setItem(SESSION_KEY, "account-a");
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValueOnce([]).mockResolvedValueOnce(["linen-napkins"]);
    const save = vi.spyOn(wishlistService, "set").mockImplementationOnce(() => oldSave.promise).mockImplementation(async (ids) => ids);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await act(async () => {});
    act(() => screen.getByRole("button", { name: "Save both" }).click());
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    localStorage.setItem(SESSION_KEY, "account-b");
    act(() => window.dispatchEvent(new Event("elysian-session-change")));
    await waitFor(() => expect(screen.getByLabelText("Wishlist")).toHaveTextContent("linen-napkins"));
    act(() => screen.getByRole("button", { name: "Save throw" }).click());
    await waitFor(() => expect(save).toHaveBeenNthCalledWith(2, ["linen-napkins", "woven-throw"]));
    await act(async () => oldSave.resolve(["sunset-vase"]));
    expect(save).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Wishlist").textContent).toBe("linen-napkins,woven-throw");
  });

  it("rolls back a failed save to the hydrated persisted wishlist", async () => {
    const refresh = pendingWishlist(), save = pendingWishlist();
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockImplementation(() => refresh.promise);
    vi.spyOn(wishlistService, "set").mockImplementation(() => save.promise);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await act(async () => refresh.resolve(["sunset-vase"]));
    act(() => screen.getByRole("button", { name: "Save throw" }).click());
    await act(async () => {});
    expect(screen.getByLabelText("Wishlist").textContent).toBe("sunset-vase,woven-throw");
    expect(wishlistService.set).toHaveBeenCalledWith(["sunset-vase", "woven-throw"]);
    await act(async () => save.reject(new Error("Save failed.")));
    expect(screen.getByLabelText("Wishlist").textContent).toBe("sunset-vase");
    expect(screen.getByRole("status")).toHaveTextContent("Save failed.");
  });

  it("blocks writes after failed hydration and recovers on a successful session refresh", async () => {
    const refresh = pendingWishlist();
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockImplementationOnce(() => refresh.promise).mockResolvedValueOnce(["sunset-vase"]);
    const save = vi.spyOn(wishlistService, "set").mockImplementation(async (ids) => ids);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await act(async () => refresh.reject(new Error("Load failed.")));
    act(() => screen.getByRole("button", { name: "Save throw" }).click());
    await act(async () => {});
    expect(save).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event("elysian-session-change")));
    await waitFor(() => expect(screen.getByLabelText("Wishlist")).toHaveTextContent("sunset-vase"));
    act(() => screen.getByRole("button", { name: "Save throw" }).click());
    await waitFor(() => expect(save).toHaveBeenCalledWith(["sunset-vase", "woven-throw"]));
  });

  it("does not expose a wishlist refresh from a replaced token before its session event", async () => {
    const refresh = pendingWishlist();
    localStorage.setItem(SESSION_KEY, "account-a");
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockImplementation(() => refresh.promise);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    localStorage.setItem(SESSION_KEY, "account-b");
    await act(async () => refresh.resolve(["sunset-vase"]));
    expect(screen.getByLabelText("Wishlist").textContent).toBe("empty");
  });

  it.each([true, false])("serializes same-render wishlist toggles and persists the latest selection (first succeeds: %s)", async (succeeds) => {
    const first = pendingWishlist(), second = pendingWishlist();
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    const save = vi.spyOn(wishlistService, "set").mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await act(async () => {});
    act(() => screen.getByRole("button", { name: "Save both" }).click());
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Wishlist")).toHaveTextContent("sunset-vase,woven-throw");
    expect(save).toHaveBeenNthCalledWith(1, ["sunset-vase"]);
    await act(async () => {
      if (succeeds) first.resolve(["sunset-vase"]);
      else first.reject(new Error("First save failed."));
    });
    expect(save).toHaveBeenNthCalledWith(2, ["sunset-vase", "woven-throw"]);
    expect(screen.getByLabelText("Wishlist")).toHaveTextContent("sunset-vase,woven-throw");
    await act(async () => second.resolve(["sunset-vase", "woven-throw"]));
    expect(screen.getByLabelText("Wishlist")).toHaveTextContent("sunset-vase,woven-throw");
  });

  it("persists removal when the same piece is toggled twice before a render", async () => {
    const first = pendingWishlist();
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    const save = vi.spyOn(wishlistService, "set").mockImplementationOnce(() => first.promise).mockResolvedValue([]);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await act(async () => {});
    act(() => screen.getByRole("button", { name: "Toggle twice" }).click());
    expect(screen.getByLabelText("Wishlist")).toHaveTextContent("empty");
    await act(async () => first.resolve(["sunset-vase"]));
    expect(save).toHaveBeenLastCalledWith([]);
    expect(screen.getByLabelText("Wishlist")).toHaveTextContent("empty");
  });

  it.each([true, false])("rolls back the latest failure to confirmed saved state (first succeeds: %s)", async (succeeds) => {
    const first = pendingWishlist(), second = pendingWishlist();
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValue(["linen-napkins"]);
    vi.spyOn(wishlistService, "set").mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await waitFor(() => expect(screen.getByLabelText("Wishlist")).toHaveTextContent("linen-napkins"));
    act(() => screen.getByRole("button", { name: "Save both" }).click());
    await act(async () => {
      if (succeeds) first.resolve(["linen-napkins", "sunset-vase"]);
      else first.reject(new Error("First save failed."));
    });
    await act(async () => second.reject(new Error("Latest save failed.")));
    expect(screen.getByLabelText("Wishlist").textContent).toBe(succeeds ? "linen-napkins,sunset-vase" : "linen-napkins");
    expect(screen.getByRole("status")).toHaveTextContent("Latest save failed.");
  });

  it.each([true, false])("discards old-session queued writes and responses (first succeeds: %s)", async (succeeds) => {
    const first = pendingWishlist(), refresh = pendingWishlist();
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValueOnce([]).mockImplementationOnce(() => refresh.promise);
    const save = vi.spyOn(wishlistService, "set").mockImplementationOnce(() => first.promise).mockResolvedValue(["woven-throw"]);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await act(async () => {});
    act(() => screen.getByRole("button", { name: "Save both" }).click());
    await waitFor(() => expect(save).toHaveBeenCalled());
    act(() => window.dispatchEvent(new Event("elysian-session-change")));
    expect(screen.getByLabelText("Wishlist")).toHaveTextContent("empty");
    await act(async () => refresh.resolve(["linen-napkins"]));
    await act(async () => {
      if (succeeds) first.resolve(["sunset-vase"]);
      else first.reject(new Error("Old account failure."));
    });
    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Wishlist")).toHaveTextContent("linen-napkins");
    expect(screen.getByRole("status")).not.toHaveTextContent("Old account failure.");
    act(() => screen.getByRole("button", { name: "Save throw" }).click());
    await waitFor(() => expect(save).toHaveBeenLastCalledWith(["linen-napkins", "woven-throw"]));
  });

  it("does not send a queued wishlist to a changed token before the session event", async () => {
    const first = pendingWishlist();
    localStorage.setItem(SESSION_KEY, "account-a");
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    const save = vi.spyOn(wishlistService, "set").mockImplementation(() => first.promise);
    render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await act(async () => {});
    act(() => screen.getByRole("button", { name: "Save both" }).click());
    await waitFor(() => expect(save).toHaveBeenCalled());
    localStorage.setItem(SESSION_KEY, "account-b");
    await act(async () => first.resolve(["sunset-vase"]));
    expect(save).toHaveBeenCalledOnce();
  });

  it("discards queued wishlist writes on unmount", async () => {
    const first = pendingWishlist();
    vi.spyOn(cartService, "get").mockResolvedValue([]);
    vi.spyOn(wishlistService, "get").mockResolvedValue([]);
    const save = vi.spyOn(wishlistService, "set").mockImplementation(() => first.promise);
    const view = render(<StudioProvider><ChangeWishlist /></StudioProvider>);
    await act(async () => {});
    act(() => screen.getByRole("button", { name: "Save both" }).click());
    await waitFor(() => expect(save).toHaveBeenCalled());
    view.unmount();
    await act(async () => first.resolve(["sunset-vase"]));
    expect(save).toHaveBeenCalledOnce();
  });

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