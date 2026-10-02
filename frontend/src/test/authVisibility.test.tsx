import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Auth from "../pages/Auth";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn(), register: vi.fn() }),
  HOME_BY_ROLE: { customer: "/account", creator: "/creator", admin: "/admin" },
}));
vi.mock("../context/StudioContext", () => ({ useStudio: () => ({ notify: vi.fn() }) }));
vi.mock("../services/api", () => ({ DEMO_PASSWORD: "test-demo-password" }));

describe("demo login shortcuts", () => {
  it("hides seeded account shortcuts in production REST without hiding normal login", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_MODE", "rest");
    render(<MemoryRouter><Auth mode="login" /></MemoryRouter>);
    expect(screen.queryByText("Demo accounts")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Studio team/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(screen.getByLabelText("Password")).toBeVisible();
  });

  it.each([[false, "rest"], [true, "mock"]] as const)("retains shortcuts for PROD=%s mode=%s", (prod, mode) => {
    vi.stubEnv("PROD", prod);
    vi.stubEnv("VITE_API_MODE", mode);
    render(<MemoryRouter><Auth mode="login" /></MemoryRouter>);
    expect(screen.getByText("Demo accounts")).toBeVisible();
    expect(screen.getByRole("button", { name: /Studio team/ })).toBeVisible();
  });
});