import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCard } from "../components/ProductCard";
import { StudioProvider, useStudio } from "../context/StudioContext";
import { cartService, wishlistService } from "../services/api";
import { products } from "../data/mock";

function Bag() {
  const { cart } = useStudio();
  return <p>{cart.reduce((sum, item) => sum + item.quantity, 0)} in bag</p>;
}

function mount(product = products[0]) {
  return render(<MemoryRouter><StudioProvider>
    <Routes><Route path="/" element={<><ProductCard product={product} /><Bag /></>} />
      <Route path="/products/:id" element={<p>Product details</p>} /></Routes>
  </StudioProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(cartService, "get").mockResolvedValue([]);
  vi.spyOn(wishlistService, "get").mockResolvedValue([]);
});

describe("Product card quick add", () => {
  it("adds one piece without opening its detail page and announces success", async () => {
    const add = vi.spyOn(cartService, "addItem").mockResolvedValue([{ productId: products[0].id, quantity: 1 }]);
    mount();
    await screen.findByText("0 in bag");
    const button = screen.getByRole("button", { name: `Add ${products[0].name} to bag` });
    expect(button.closest("a")).toBeNull();
    await userEvent.click(button);
    expect(add).toHaveBeenCalledExactlyOnceWith(products[0].id, 1);
    await waitFor(() => expect(screen.getAllByText("1 in bag")).toHaveLength(2));
    expect(screen.getByRole("status")).toHaveTextContent("Added to your bag.");
    expect(screen.queryByText("Product details")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: products[0].name }));
    expect(await screen.findByText("Product details")).toBeVisible();
  });

  it.each([{ stock: 0 }, { status: "draft" as const }])("disables unavailable pieces", (patch) => {
    const add = vi.spyOn(cartService, "addItem");
    mount({ ...products[0], ...patch });
    const button = screen.getByRole("button", { name: `${products[0].name} is currently unavailable` });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(add).not.toHaveBeenCalled();
  });

  it("stops adding when every available unit is already in the bag", async () => {
    vi.mocked(cartService.get).mockResolvedValue([{ productId: products[0].id, quantity: products[0].stock }]);
    mount();
    expect(await screen.findByRole("button", { name: `Stock limit reached for ${products[0].name}` })).toBeDisabled();
    expect(screen.getByRole("link", { name: "View bag" })).toHaveAttribute("href", "/cart");
  });

  it("blocks repeated clicks while adding and exposes a busy state", async () => {
    let finish!: (items: { productId: string; quantity: number }[]) => void;
    const add = vi.spyOn(cartService, "addItem").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount();
    const button = screen.getByRole("button", { name: `Add ${products[0].name} to bag` });
    await userEvent.dblClick(button);
    expect(add).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Adding…");
    await act(async () => finish([{ productId: products[0].id, quantity: 1 }]));
    expect(button).toBeEnabled();
    expect(screen.getByRole("link", { name: "View bag" })).toBeVisible();
  });

  it("reports a failed add and allows retry without claiming success", async () => {
    vi.spyOn(cartService, "addItem").mockRejectedValueOnce(new Error("Network unavailable."));
    mount();
    const button = screen.getByRole("button", { name: `Add ${products[0].name} to bag` });
    await userEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Network unavailable."));
    expect(button).toBeEnabled();
    expect(screen.getByText("0 in bag")).toBeVisible();
    expect(screen.queryByRole("link", { name: "View bag" })).not.toBeInTheDocument();
  });
});