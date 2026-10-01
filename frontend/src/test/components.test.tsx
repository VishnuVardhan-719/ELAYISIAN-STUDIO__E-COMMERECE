import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Quantity, Modal, ErrorState } from "../components/ui";
import { ProductCard } from "../components/ProductCard";
import { OrdersTable } from "../components/OrdersTable";
import { StudioProvider } from "../context/StudioContext";
import { products, orders } from "../data/mock";
import BecomeCreator from "../pages/BecomeCreator";
import Shop from "../pages/Shop";
describe("Interactive components", () => {
  it("enforces quantity boundaries", async () => {
    const change = vi.fn();
    render(<Quantity value={1} max={2} onChange={change} />);
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Increase quantity" }),
    );
    expect(change).toHaveBeenCalledWith(2);
  });
  it("saves and removes a product from the wishlist", async () => {
    render(
      <MemoryRouter>
        <StudioProvider>
          <ProductCard product={products[0]} />
        </StudioProvider>
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Save The Sunday Vase/ }),
    );
    expect(
      screen.getByRole("button", { name: /Remove The Sunday Vase/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      screen.getByRole("button", { name: /Remove The Sunday Vase/ }),
    );
    expect(
      screen.getByRole("button", { name: /Save The Sunday Vase/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });
  it("exposes a labeled modal and close action", async () => {
    const close = vi.fn();
    render(
      <Modal open onClose={close} title="Product preview">
        <p>Preview content</p>
      </Modal>,
    );
    expect(
      screen.getByRole("dialog", { name: "Product preview" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(close).toHaveBeenCalledOnce();
  });
  it("provides a retry action for a failed resource", async () => {
    const retry = vi.fn();
    render(<ErrorState message="Network unavailable" retry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("renders readable order items and statuses", () => {
    render(<OrdersTable orders={orders} />);
    expect(screen.getByRole("table", { name: "Sample orders" })).toBeVisible();
    expect(screen.getByText("ELS-1048")).toBeVisible();
    expect(screen.getByText("Delivered")).toBeVisible();
  });
  it("shows validation errors for an empty application", async () => {
    render(
      <MemoryRouter>
        <BecomeCreator />
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Preview collaboration request" }),
    );
    expect(await screen.findByText("Enter your full name.")).toBeVisible();
    expect(
      screen.getByText("Please agree to the collaboration terms."),
    ).toBeVisible();
  });
  it("reads product filters from the URL", async () => {
    render(
      <MemoryRouter initialEntries={["/shop?category=ceramics&max=1000"]}>
        <StudioProvider>
          <Routes>
            <Route path="/shop" element={<Shop />} />
          </Routes>
        </StudioProvider>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText("1 thoughtfully made pieces")).toBeVisible(),
    );
    expect(
      screen.getByRole("heading", { name: "The Studio Cup" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "The Sunday Vase" }),
    ).not.toBeInTheDocument();
  });
});
