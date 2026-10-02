import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";

const password = "elysian123";

async function register(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: `Welcome back, ${name.split(" ")[0]}.` })).toBeVisible();
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/(?:login)?$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Shopping bag, 0 items", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wishlist, 0 saved items", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeHidden();
  await page.goto("/cart");
  await expect(page.locator(".cartItem")).toHaveCount(0);
}

async function addProduct(page: Page, id: string, quantity: number) {
  await page.goto(`/products/${id}`);
  for (let index = 1; index < quantity; index++) {
    await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
  }
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Added to your bag");
}

async function expectMergedBag(page: Page) {
  await page.goto("/cart");
  const vase = page.locator(".cartItem").filter({ hasText: "The Sunday Vase" });
  const throwItem = page.locator(".cartItem").filter({ hasText: "Slow Mornings Throw" });
  await expect(vase.locator(".quantity span")).toHaveText("3");
  await expect(throwItem.locator(".quantity span")).toHaveText("1");
  await expect(page.locator(".cartItem")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Shopping bag, 4 items", exact: true })).toBeVisible();
}

async function toggleWishlist(page: Page, label: string) {
  const saved = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/wishlist" &&
    response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  expect((await saved).ok()).toBe(true);
}

test("REST bag merges anonymous quantities once, persists across browsers, and isolates logout", async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  const email = `bag-${randomUUID()}@example.test`;
  await register(page, "Bag Collector", email);
  await addProduct(page, "sunset-vase", 1);
  await expect(page.getByRole("link", { name: "Shopping bag, 1 items", exact: true })).toBeVisible();

  const secondSession = await browser.newContext({ baseURL });
  try {
    const secondPage = await secondSession.newPage();
    await addProduct(secondPage, "sunset-vase", 2);
    await addProduct(secondPage, "woven-throw", 1);
    await expect(secondPage.getByRole("link", { name: "Shopping bag, 3 items", exact: true })).toBeVisible();
    await login(secondPage, email);
    await expectMergedBag(secondPage);
    await secondPage.reload();
    await expectMergedBag(secondPage);
    await expectMergedBag(page);

    await logout(secondPage);
    await secondPage.goto("/account/orders");
    await expect(secondPage).toHaveURL(/\/login$/);
    await register(secondPage, "Other Collector", `other-bag-${randomUUID()}@example.test`);
    await expect(secondPage.getByRole("link", { name: "Shopping bag, 0 items", exact: true })).toBeVisible();
    await secondPage.goto("/cart");
    await expect(secondPage.locator(".cartItem")).toHaveCount(0);
    await logout(secondPage);
    await login(secondPage, email);
    await expectMergedBag(secondPage);
  } finally {
    await secondSession.close();
  }

  const freshSession = await browser.newContext({ baseURL });
  try {
    const freshPage = await freshSession.newPage();
    await login(freshPage, email);
    await expect(freshPage.getByRole("heading", { name: "Welcome back, Bag." })).toBeVisible();
    await expectMergedBag(freshPage);
  } finally {
    await freshSession.close();
  }
});

test("REST wishlist persists in a second browser and never leaks into another account", async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  const email = `wishlist-${randomUUID()}@example.test`;
  await register(page, "Wishlist Collector", email);
  await page.goto("/products/sunset-vase");
  await toggleWishlist(page, "Save to wishlist");
  await expect(page.getByRole("button", { name: "Remove from wishlist", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove from wishlist", exact: true })).toHaveAttribute("aria-pressed", "true");

  const secondSession = await browser.newContext({ baseURL });
  try {
    const secondPage = await secondSession.newPage();
    await login(secondPage, email);
    await secondPage.goto("/account/wishlist");
    await expect(secondPage.getByRole("heading", { name: "The Sunday Vase", exact: true })).toBeVisible();
    await expect(secondPage.getByRole("link", { name: "Wishlist, 1 saved items", exact: true })).toBeVisible();
    await toggleWishlist(secondPage, "Remove The Sunday Vase from wishlist");
    await expect(secondPage.getByRole("heading", { name: "Keep a little inspiration here.", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Save to wishlist", exact: true })).toHaveAttribute("aria-pressed", "false");

    await page.goto("/products/woven-throw");
    await toggleWishlist(page, "Save to wishlist");
    await logout(page);
    await page.goto("/products/woven-throw");
    await expect(page.getByRole("button", { name: "Save to wishlist", exact: true })).toHaveAttribute("aria-pressed", "false");
    await register(page, "Isolated Collector", `other-wishlist-${randomUUID()}@example.test`);
    await page.goto("/account/wishlist");
    await expect(page.getByRole("heading", { name: "Keep a little inspiration here.", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Wishlist, 0 saved items", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Keep a little inspiration here.", exact: true })).toBeVisible();

    await secondPage.reload();
    await expect(secondPage.getByRole("heading", { name: "Slow Mornings Throw", exact: true })).toBeVisible();
    await expect(secondPage.getByRole("heading", { name: "The Sunday Vase", exact: true })).toHaveCount(0);
    await expect(secondPage.getByRole("link", { name: "Wishlist, 1 saved items", exact: true })).toBeVisible();
    await logout(secondPage);
    await login(secondPage, email);
    await secondPage.goto("/account/wishlist");
    await expect(secondPage.getByRole("heading", { name: "Slow Mornings Throw", exact: true })).toBeVisible();
  } finally {
    await secondSession.close();
  }
});