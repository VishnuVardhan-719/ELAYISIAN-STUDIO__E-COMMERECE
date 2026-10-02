import { test, expect } from "@playwright/test";

test("password visibility times out and signup offers no admin", async ({ page }) => {
  await page.goto("/register");
  const account = page.getByRole("combobox", { name: "Account type" });
  await expect(account).toHaveValue("customer");
  await expect(account.locator("option")).toHaveText(["Customer", "Creator"]);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("isolated-fixture-password");
  await page.getByRole("button", { name: "Show password for 3 seconds" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveAttribute("type", "password", { timeout: 5000 });
  await expect(password).toHaveValue("isolated-fixture-password");
  await account.selectOption("creator");
  await expect(page.getByText(/Creator access requires/)).toBeVisible();
  await page.getByLabel("Full name").fill("Expo New Maker");
  await page.getByLabel("Email address").fill(`maker-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/become-a-creator#application$/);
});

test("verified admin logs in directly without a public admin shortcut", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: /Studio team \(admin\)/ })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Account type" })).toHaveCount(0);
  await page.getByLabel("Email address").fill("studio@example.test");
  await page.getByLabel("Password", { exact: true }).fill("elysian123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "The studio at a glance." })).toBeVisible();
});