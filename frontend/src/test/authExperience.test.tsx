import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "../pages/Auth";

const mocks = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), notify: vi.fn() }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: mocks.login, register: mocks.register }),
  HOME_BY_ROLE: { customer: "/account", creator: "/creator-dashboard", admin: "/admin" },
}));
vi.mock("../context/StudioContext", () => ({ useStudio: () => ({ notify: mocks.notify }) }));
vi.mock("../services/api", () => ({ DEMO_PASSWORD: "fixture-demo-password" }));

function Destination() {
  const location = useLocation();
  return <output aria-label="Destination">{location.pathname}{location.hash}</output>;
}

function mount(mode: "login" | "register", from?: string) {
  return render(<MemoryRouter initialEntries={[{ pathname: `/${mode}`, state: { from } }]}>
    <Auth mode={mode} /><Destination />
  </MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_API_MODE", "rest");
  mocks.login.mockResolvedValue({ name: "Vishnu", role: "admin" });
  mocks.register.mockResolvedValue({ name: "New Maker", role: "customer" });
});
afterEach(() => vi.useRealTimers());

describe("account entry experience", () => {
  it.each(["login", "register"] as const)("reveals password on request for three seconds on %s", (mode) => {
    vi.useFakeTimers();
    mount(mode);
    const input = screen.getByLabelText("Password");
    fireEvent.change(input, { target: { value: "private-fixture" } });
    expect(input).toHaveAttribute("type", "password");
    const reveal = screen.getByRole("button", { name: "Show password for 3 seconds" });
    expect(reveal).toHaveAttribute("type", "button");
    fireEvent.click(reveal);
    expect(input).toHaveAttribute("type", "text");
    act(() => vi.advanceTimersByTime(2999));
    expect(input).toHaveAttribute("type", "text");
    act(() => vi.advanceTimersByTime(1));
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("private-fixture");
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("allows immediate hiding and hides when focus leaves the password controls", () => {
    mount("login");
    const input = screen.getByLabelText("Password");
    fireEvent.click(screen.getByRole("button", { name: "Show password for 3 seconds" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password for 3 seconds" }));
    fireEvent.blur(input, { relatedTarget: screen.getByLabelText("Email address") });
    expect(input).toHaveAttribute("type", "password");
  });

  it("offers only customer and creator at registration and sends no privileged role", async () => {
    const { container } = mount("register");
    const account = screen.getByRole("combobox", { name: "Account type" });
    expect(account).toHaveValue("customer");
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Customer", "Creator"]);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Maker" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "maker@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "private-fixture" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByLabelText("Destination")).toHaveTextContent(/^\/account$/));
    expect(mocks.register).toHaveBeenCalledWith({ name: "New Maker", email: "maker@example.test", password: "private-fixture" });
  });

  it("takes creator signup to its application without granting seller permissions", async () => {
    const { container } = mount("register", "/checkout");
    fireEvent.change(screen.getByRole("combobox", { name: "Account type" }), { target: { value: "creator" } });
    expect(screen.getByText(/Creator access requires/)).toBeVisible();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByLabelText("Destination")).toHaveTextContent("/become-a-creator#application"));
    expect(mocks.register.mock.calls[0][0]).not.toHaveProperty("role");
  });

  it.each([
    ["admin", "/admin"], ["creator", "/creator-dashboard"],
  ])("routes verified %s credentials straight to the role dashboard", async (role, destination) => {
    mocks.login.mockResolvedValue({ name: "Account Owner", role });
    const { container } = mount("login", "/checkout");
    expect(screen.queryByRole("combobox", { name: "Account type" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Studio team/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show password for 3 seconds" }));
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    await waitFor(() => expect(screen.getByLabelText("Destination")).toHaveTextContent(destination));
  });

  it("retains the customer's checkout destination", async () => {
    mocks.login.mockResolvedValue({ name: "Customer", role: "customer" });
    const { container } = mount("login", "/checkout");
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByLabelText("Destination")).toHaveTextContent("/checkout"));
  });
});