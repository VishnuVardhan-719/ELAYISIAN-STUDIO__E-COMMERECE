import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`product cards quick-add and persist the guest bag at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop?q=Sunday");
    const card = page.locator(".productGrid article").filter({ hasText: "The Sunday Vase" });
    const add = card.getByRole("button", { name: "Add The Sunday Vase to bag" });
    await expect(add).toBeVisible();
    await add.click();
    await expect(page).toHaveURL(/\/shop\?q=Sunday$/);
    await expect(page.getByRole("status")).toContainText("Added to your bag.");
    await expect(page.getByRole("link", { name: "Shopping bag, 1 items", exact: true })).toBeVisible();
    await expect(card.getByText("1 in bag", { exact: true })).toBeVisible();
    await page.reload();
    await expect(card.getByText("1 in bag", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Save The Sunday Vase to wishlist" }).click();
    await expect(card.getByRole("button", { name: "Remove The Sunday Vase from wishlist" })).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByRole("link", { name: "View bag", exact: true })).toBeVisible();
    const buttonBox = await add.boundingBox();
    expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`shopping-${width}.png`), fullPage: true });
    await card.getByRole("link", { name: "View bag", exact: true }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator(".cartItem .quantity span")).toHaveText("1");
  });
}

test("product detail limits additions to remaining stock already outside the bag", async ({ page }) => {
  await page.goto("/products/sunset-vase");
  const copy = page.locator(".productCopy");
  const increase = copy.getByRole("button", { name: "Increase quantity", exact: true });
  const add = copy.getByRole("button", { name: "Add to bag", exact: true });
  for (let index = 1; index < 8; index++) await increase.click();
  await expect(increase).toBeDisabled();
  await add.click();
  await expect(page.getByRole("status")).toContainText("Added to your bag.");
  await expect(copy.getByRole("button", { name: "Stock limit reached", exact: true })).toBeDisabled();
  await expect(increase).toBeDisabled();
  await page.goto("/shop?q=Sunday");
  await expect(page.getByRole("button", { name: "Stock limit reached for The Sunday Vase", exact: true })).toBeDisabled();
});