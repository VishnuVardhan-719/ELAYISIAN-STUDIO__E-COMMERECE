import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Account from "../pages/Account";

const mocks = vi.hoisted(() => ({
  wishlist: [] as string[],
  user: { id: "customer-one", name: "Ananya", email: "ananya@example.test", role: "customer" },
  preferences: { makersAndCollections: false, studioStories: true },
  getPreferences: vi.fn(), savePreferences: vi.fn(), updateProfile: vi.fn(), notify: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../context/StudioContext", () => ({ useStudio: () => ({ wishlist: mocks.wishlist, notify: mocks.notify }) }));
vi.mock("../services/api", () => ({
  SESSION_KEY: "elysian-session-v1",
  accountService: {
    getProfile: async () => mocks.user,
    getPreferences: mocks.getPreferences,
    savePreferences: mocks.savePreferences,
    updateProfile: mocks.updateProfile,
  },
  orderService: { listForUser: async () => [] },
  productService: { listByIds: async () => [] },
  creatorService: { list: async () => [] }, resetDemoData: vi.fn(),
}));

beforeEach(() => {
  mocks.preferences = { makersAndCollections: false, studioStories: true };
  mocks.getPreferences.mockReset().mockImplementation(async () => ({ ...mocks.preferences }));
  mocks.savePreferences.mockReset().mockImplementation(async (_id, preferences) => {
    mocks.preferences = preferences;
    return preferences;
  });
  mocks.updateProfile.mockReset().mockResolvedValue(mocks.user);
  mocks.notify.mockReset();
});
const renderSettings = () => render(<MemoryRouter initialEntries={["/account/settings"]}><Account /></MemoryRouter>);

describe("account preference settings", () => {
  it.each(["token change", "session event", "unmount"])("does not continue a profile save after %s", async (change) => {
    let finish!: () => void;
    mocks.updateProfile.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    localStorage.setItem("elysian-session-v1", "account-a");
    const view = renderSettings();
    await screen.findByRole("checkbox", { name: "New makers and collections" });
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    if (change === "token change") localStorage.setItem("elysian-session-v1", "account-b");
    else if (change === "session event") act(() => window.dispatchEvent(new Event("elysian-session-change")));
    else view.unmount();
    await act(async () => finish());
    expect(mocks.savePreferences).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it.each([true, false])("ignores a preference response after session changes (success: %s)", async (success) => {
    let finish!: () => void;
    let fail!: (error: Error) => void;
    mocks.savePreferences.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; }));
    localStorage.setItem("elysian-session-v1", "account-a");
    renderSettings();
    await screen.findByRole("checkbox", { name: "New makers and collections" });
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledOnce());
    localStorage.setItem("elysian-session-v1", "account-b");
    await act(async () => { if (success) finish(); else fail(new Error("Old session failure")); });
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.getPreferences).toHaveBeenCalledOnce();
  });

  it("loads controlled named choices and saves/reloads them through the account service", async () => {
    const user = userEvent.setup();
    const view = renderSettings();
    const makers = await screen.findByRole("checkbox", { name: "New makers and collections" });
    expect(makers).not.toBeChecked();
    expect(makers).toHaveAttribute("name", "makersAndCollections");
    expect(screen.getByRole("checkbox", { name: "Stories from the studio" })).toBeChecked();
    await user.click(makers);
    await user.click(screen.getByRole("checkbox", { name: "Stories from the studio" }));
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledWith("customer-one", {
      makersAndCollections: true, studioStories: false,
    }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("Your details were saved."));
    view.unmount();
    renderSettings();
    expect(await screen.findByRole("checkbox", { name: "New makers and collections" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Stories from the studio" })).not.toBeChecked();
  });

  it("reports partial success honestly when preferences fail after profile save", async () => {
    mocks.savePreferences.mockRejectedValueOnce(new Error("Offline"));
    renderSettings();
    await screen.findByRole("checkbox", { name: "New makers and collections" });
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("Your profile was saved, but preferences could not be saved. Try again."));
    expect(mocks.notify).not.toHaveBeenCalledWith("Your details were saved.");
  });

  it("does not save preferences or claim success when the profile update fails", async () => {
    mocks.updateProfile.mockRejectedValueOnce(new Error("Duplicate email"));
    renderSettings();
    await screen.findByRole("checkbox", { name: "New makers and collections" });
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("Your details could not be saved. Try again."));
    expect(mocks.savePreferences).not.toHaveBeenCalled();
  });

  it("hides browser reset and describes account persistence in REST mode", async () => {
    vi.stubEnv("VITE_API_MODE", "rest");
    renderSettings();
    await screen.findByRole("checkbox", { name: "New makers and collections" });
    expect(screen.getByText("Edit your profile. Changes are saved to your account.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset demo data" })).not.toBeInTheDocument();
  });

  it("shows preference load errors and reloads fresh choices on retry", async () => {
    mocks.getPreferences.mockRejectedValueOnce(new Error("Preferences unavailable"));
    renderSettings();
    expect(await screen.findByText("Preferences unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save preferences" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("checkbox", { name: "New makers and collections" })).not.toBeChecked();
  });
});