import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Product from "../pages/Product";
import { categories, creators, products } from "../data/mock";
import type { CartItem } from "../types/domain";

const mocks = vi.hoisted(() => ({
  getById: vi.fn(), listRelated: vi.fn(), creators: vi.fn(), categories: vi.fn(),
  addToCart: vi.fn(), cart: [] as CartItem[], busy: false,
}));
vi.mock("../services/api", () => ({
  productService: { getById: mocks.getById, listRelated: mocks.listRelated },
  creatorService: { list: mocks.creators }, categoryService: { list: mocks.categories },
}));
vi.mock("../context/StudioContext", () => ({ useStudio: () => ({
  cart: mocks.cart, wishlist: [], toggleWishlist: vi.fn(), addToCart: mocks.addToCart, busy: mocks.busy,
}) }));
const product = { ...products[0], stock: 3 };
const page = () => <MemoryRouter initialEntries={[`/products/${product.id}`]}>
  <Routes><Route path="/products/:productId" element={<Product />} /></Routes>
</MemoryRouter>;
const detail = async () => within((await screen.findByRole("heading", { name: product.name, level: 1 })).closest(".productCopy")! as HTMLElement);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cart = [];
  mocks.busy = false;
  mocks.getById.mockResolvedValue(product);
  mocks.listRelated.mockResolvedValue([products[1]]);
  mocks.creators.mockResolvedValue(creators);
  mocks.categories.mockResolvedValue(categories);
});

describe("product detail stock limits", () => {
  it("subtracts this product's bag quantity and ignores unrelated bag items", async () => {
    mocks.cart = [{ productId: product.id, quantity: 1 }, { productId: products[1].id, quantity: 100 }];
    render(page());
    const copy = await detail();
    const increase = copy.getByRole("button", { name: "Increase quantity" });
    expect(increase).toBeEnabled();
    fireEvent.click(increase);
    expect(increase).toBeDisabled();
    fireEvent.click(copy.getByRole("button", { name: "Add to bag" }));
    expect(mocks.addToCart).toHaveBeenCalledExactlyOnceWith(product.id, 2);
  });

  it("clamps the displayed and submitted quantity when the bag changes", async () => {
    const { rerender } = render(page());
    const copy = await detail();
    fireEvent.click(copy.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(copy.getByRole("button", { name: "Increase quantity" }));
    expect(copy.getByText("3", { exact: true })).toBeVisible();
    mocks.cart = [{ productId: product.id, quantity: 2 }];
    rerender(page());
    expect(copy.getByText("1", { exact: true })).toBeVisible();
    expect(copy.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    fireEvent.click(copy.getByRole("button", { name: "Add to bag" }));
    expect(mocks.addToCart).toHaveBeenCalledExactlyOnceWith(product.id, 1);
  });

  it("disables adding and quantity controls when all stock is in the bag", async () => {
    mocks.cart = [{ productId: product.id, quantity: 3 }];
    render(page());
    const copy = await detail();
    expect(copy.getByText("All available pieces are in your bag")).toBeVisible();
    const add = copy.getByRole("button", { name: "Stock limit reached" });
    expect(add).toBeDisabled();
    expect(copy.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    expect(copy.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    fireEvent.click(add);
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });

  it("keeps the sold-out label when the product has no stock", async () => {
    mocks.getById.mockResolvedValue({ ...product, stock: 0 });
    render(page());
    const copy = await detail();
    expect(copy.getByRole("button", { name: "Sold out" })).toBeDisabled();
    expect(copy.getByText("Currently unavailable")).toBeVisible();
  });
});