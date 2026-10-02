import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Cart from "../pages/Cart";
import { products } from "../data/mock";

const mocks = vi.hoisted(() => ({
  config: vi.fn(), reconcile: vi.fn(), resume: vi.fn(), create: vi.fn(), list: vi.fn(), addresses: vi.fn(),
  clearCart: vi.fn(), notify: vi.fn(), cart: [{ productId: "expo-demo-bookmark", quantity: 1 }],
}));
vi.mock("../services/api", () => ({
  paymentService: { config: mocks.config, reconcile: mocks.reconcile, resume: mocks.resume },
  productService: { list: mocks.list },
  accountService: { listAddresses: mocks.addresses },
  orderService: { create: mocks.create },
}));
vi.mock("../context/StudioContext", () => ({ useStudio: () => ({
  cart: mocks.cart, updateCart: vi.fn(), removeFromCart: vi.fn(), clearCart: mocks.clearCart, busy: false, notify: mocks.notify,
}) }));
const user = { id: "customer", name: "Customer", email: "customer@example.test", role: "customer" };
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user }) }));
const order = {
  id: "ELS-1001", userId: "customer", date: "2026-10-02", status: "Processing",
  items: [{ productId: "expo-demo-bookmark", name: "Expo bookmark", quantity: 1, unitPrice: 1 }], total: 1,
};
const mount = () => render(<MemoryRouter><Cart checkout /></MemoryRouter>);
const savedAddresses = [
  { id: "first", userId: user.id, name: "Customer", line: "Studio road", city: "Mumbai", state: "Maharashtra", postalCode: "400001", phone: "9876543210" },
  { id: "second", userId: user.id, name: "Second recipient", line: "Craft lane", city: "Pune", state: "Maharashtra", postalCode: "411001", phone: "9876543211" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockResolvedValue({ enabled: true, mode: "test" });
  mocks.reconcile.mockResolvedValue(null);
  mocks.list.mockResolvedValue({ items: [{ ...products[0], id: "expo-demo-bookmark", name: "Expo bookmark", price: 1 }] });
  mocks.addresses.mockResolvedValue([{ id: "address", userId: user.id, name: "Customer", line: "Studio road", city: "Mumbai", state: "Maharashtra", postalCode: "400001", phone: "9876543210" }]);
  mocks.create.mockResolvedValue(order);
  mocks.resume.mockResolvedValue(order);
  mocks.clearCart.mockResolvedValue(undefined);
});

describe("checkout payment labels and totals", () => {
  it("submits the second saved address rather than the first", async () => {
    mocks.addresses.mockResolvedValue(savedAddresses);
    const { container } = mount();
    fireEvent.click(await screen.findByRole("button", { name: /Second recipient Craft lane/ }));
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ userId: user.id, items: mocks.cart, address: {
      name: "Second recipient", line: "Craft lane", city: "Pune", state: "Maharashtra", postalCode: "411001", phone: "9876543211",
    } }));
  });

  it("selects the second saved address and can reselect it after using a new address", async () => {
    mocks.addresses.mockResolvedValue(savedAddresses);
    const { container } = mount();
    const first = await screen.findByRole("button", { name: /Customer Studio road/ });
    const second = screen.getByRole("button", { name: /Second recipient Craft lane/ });
    const newAddress = screen.getByRole("button", { name: /Use a new address/ });
    expect(first).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(newAddress);
    expect(newAddress).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("textbox", { name: "Full name" })).toBeVisible();
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("textbox", { name: "Full name" })).not.toBeInTheDocument();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ address: expect.objectContaining({ line: "Craft lane" }) })));
  });

  it("submits the entered new address instead of the selected saved address", async () => {
    mocks.addresses.mockResolvedValue(savedAddresses);
    const { container } = mount();
    fireEvent.click(await screen.findByRole("button", { name: /Second recipient Craft lane/ }));
    fireEvent.click(screen.getByRole("button", { name: /Use a new address/ }));
    const fields = { "Full name": "New recipient", "Email address": "new@example.test", Address: "New delivery road", City: "Jaipur", State: "Rajasthan", "PIN code": "302001", "Phone number": "9876543212" };
    for (const [name, value] of Object.entries(fields)) fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ userId: user.id, items: mocks.cart, address: {
      name: "New recipient", line: "New delivery road", city: "Jaipur", state: "Rajasthan", postalCode: "302001", phone: "9876543212",
    } }));
  });

  it("falls back to the first remaining address when the selected address is removed", async () => {
    mocks.addresses.mockResolvedValue(savedAddresses);
    const { rerender, container } = mount();
    fireEvent.click(await screen.findByRole("button", { name: /Second recipient Craft lane/ }));
    mocks.addresses.mockResolvedValue([savedAddresses[0]]);
    rerender(<MemoryRouter><Cart /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Your thoughtful finds." });
    rerender(<MemoryRouter><Cart checkout /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /Customer Studio road/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ address: expect.objectContaining({ line: "Studio road" }) })));
  });

  it("offers resume only when the server confirms an unpaid resumable checkout", async () => {
    mocks.reconcile.mockResolvedValue({ status: "pending", checkout: { attemptId: "attempt-1" } });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Resume sandbox payment" }));
    expect(await screen.findByText("ELS-1001")).toBeVisible();
    expect(mocks.resume).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.clearCart).not.toHaveBeenCalled();
  });

  it("shows the sandbox warning, free bookmark shipping and the verified receipt total", async () => {
    const refresh = vi.spyOn(window, "dispatchEvent");
    const { container } = mount();
    expect(await screen.findByText(/Razorpay sandbox/)).toHaveTextContent(/no real money is charged/i);
    const total = screen.getByText("Total").closest("div")!;
    expect(within(total).getByText("₹1")).toBeVisible();
    expect(screen.getByText("Complimentary")).toBeVisible();
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Payment status")).toBeVisible();
    expect(screen.getByText("Verified sandbox payment")).toBeVisible();
    expect(screen.getByText("Sandbox total").closest("div")).toHaveTextContent("₹1");
    expect(mocks.clearCart).not.toHaveBeenCalled();
    expect(refresh.mock.calls.some(([event]) => event.type === "elysian-session-change")).toBe(true);
    refresh.mockRestore();
  });

  it("keeps demo copy in disabled mode without claiming money was paid", async () => {
    mocks.config.mockResolvedValue({ enabled: false, mode: "test" });
    const { container } = mount();
    expect(await screen.findByText("Payment is simulated.")).toBeVisible();
    expect(screen.queryByText(/Razorpay sandbox/)).not.toBeInTheDocument();
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Recorded demo · no money charged")).toBeVisible();
    expect(screen.queryByText("Total paid")).not.toBeInTheDocument();
    expect(mocks.clearCart).toHaveBeenCalledOnce();
  });

  it("restores a completed receipt after reload without clearing a newer bag", async () => {
    mocks.reconcile.mockResolvedValue({ status: "completed", order });
    mount();
    expect(await screen.findByText("ELS-1001")).toBeVisible();
    expect(screen.getByText("Verified sandbox payment")).toBeVisible();
    expect(mocks.clearCart).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("shows a pending payment and checks again rather than creating another attempt", async () => {
    mocks.reconcile.mockResolvedValue({ status: "pending" });
    mount();
    expect(await screen.findByText(/verification is pending/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Pay in sandbox" })).toBeDisabled();
    mocks.reconcile.mockResolvedValue({ status: "completed", order });
    fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
    expect(await screen.findByText("ELS-1001")).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps the bag and enables retry after a dismissed gateway", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Sandbox checkout closed. You can try again."));
    const { container } = mount();
    await screen.findByText(/Razorpay sandbox/);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("Sandbox checkout closed. You can try again."));
    expect(screen.getByRole("button", { name: "Pay in sandbox" })).toBeEnabled();
    expect(mocks.clearCart).not.toHaveBeenCalled();
  });
});