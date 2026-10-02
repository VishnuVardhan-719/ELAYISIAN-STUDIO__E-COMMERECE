import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Info from "../pages/Info";

describe("expo service disclosures", () => {
  it("explains server-side records and sandbox payments instead of claiming frontend-only storage", () => {
    render(<MemoryRouter initialEntries={["/privacy"]}><Info /></MemoryRouter>);
    expect(screen.getByText(/account and order records are stored in MongoDB/i)).toBeInTheDocument();
    expect(screen.getByText(/Razorpay test mode/i)).toBeInTheDocument();
    expect(screen.queryByText(/no .* account registrations are transmitted/i)).not.toBeInTheDocument();
  });
  it("discloses zero shipping for the sandbox bookmark", () => {
    render(<MemoryRouter initialEntries={["/shipping"]}><Info /></MemoryRouter>);
    expect(screen.getByText(/demo bookmark has zero shipping/i)).toBeInTheDocument();
    expect(screen.queryByText(/cannot accept orders/i)).not.toBeInTheDocument();
  });
});