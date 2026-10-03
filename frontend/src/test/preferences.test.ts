import { describe, expect, it, vi } from "vitest";
import { accountService } from "../services/mockAdapter";

const defaults = { makersAndCollections: true, studioStories: true };

describe("account preference adapters", () => {
  it("defaults both choices on and persists only for the selected account across reloads", async () => {
    expect(await accountService.getPreferences("demo-customer")).toEqual(defaults);
    const saved = { makersAndCollections: false, studioStories: true };
    expect(await accountService.savePreferences("demo-customer", saved)).toEqual(saved);
    vi.resetModules();
    const reloaded = await import("../services/mockAdapter");
    expect(await reloaded.accountService.getPreferences("demo-customer")).toEqual(saved);
    expect(await reloaded.accountService.getPreferences("demo-admin")).toEqual(defaults);
    expect(await reloaded.accountService.getProfile("demo-customer")).not.toHaveProperty("preferences");
  });

  it("does not claim a preference save succeeded when browser storage fails", async () => {
    vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => { throw new Error("Storage unavailable"); });
    await expect(accountService.savePreferences("demo-customer", defaults)).rejects.toThrow("Storage unavailable");
  });

  it("uses the authenticated REST endpoint without sending a requested user id", async () => {
    const saved = { makersAndCollections: false, studioStories: false };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(saved), {
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("elysian-session-v1", "preference-token");
    const rest = await import("../services/restAdapter");
    expect(await rest.accountService.getPreferences("other-user")).toEqual(saved);
    expect(await rest.accountService.savePreferences("other-user", saved)).toEqual(saved);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/users/me/preferences");
    const [path, options] = fetchMock.mock.calls[1];
    expect(path).toBe("/api/users/me/preferences");
    expect(options?.method).toBe("PUT");
    expect(JSON.parse(String(options?.body))).toEqual(saved);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer preference-token");
  });
});