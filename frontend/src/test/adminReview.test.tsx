import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "../pages/Admin";

const mocks = vi.hoisted(() => ({ review: vi.fn(), notify: vi.fn(), collaborations: vi.fn() }));
vi.mock("../context/StudioContext", () => ({ useStudio: () => ({ notify: mocks.notify }) }));
vi.mock("../services/api", () => ({ adminService: {
  getSummary: async () => ({}), listUsers: async () => [], listCreators: async () => [],
  listProducts: async () => [], listCategories: async () => [], listOrders: async () => [],
  listPayments: async () => [], listCollaborations: mocks.collaborations, reviewDemo: mocks.review,
} }));

const application = { id: "COL-test", creatorName: "Test Maker", email: "maker@example.test", categoryId: "art", description: "Original handmade prints.", status: "pending", date: "2026-10-02" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_API_MODE", "rest");
  mocks.collaborations.mockResolvedValue([application]);
});

describe("admin application decisions", () => {
  it("describes real access and exposes the provider's actionable review error", async () => {
    mocks.review.mockRejectedValue(new Error("The applicant must sign in and resubmit this application."));
    render(<MemoryRouter initialEntries={["/admin/collaborations"]}><Admin /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Review Test Maker" }));
    expect(screen.getByText(/Approval creates a creator profile/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Approve application" }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("The applicant must sign in and resubmit this application."));
    expect(screen.getByRole("dialog", { name: "Review collaboration" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve application" })).not.toBeDisabled();
  });

  it("refreshes the queue and closes a successful review", async () => {
    mocks.review.mockImplementation(async () => { mocks.collaborations.mockResolvedValue([{ ...application, status: "approved" }]); });
    render(<MemoryRouter initialEntries={["/admin/collaborations"]}><Admin /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Review Test Maker" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve application" }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("Request approved."));
    expect(await screen.findByText("approved")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Review collaboration" })).not.toBeInTheDocument();
  });
});