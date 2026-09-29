import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Signs in through the demo buttons on /login, then lands on the role's home. */
async function signInAs(page: Page, label: "collector" | "maker" | "admin") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`\\(${label}\\)`) }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

/** The homepage entrance door covers the page until it is skipped. */
async function skipEntrance(page: Page) {
  const skip = page.getByRole("button", { name: "Skip intro" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(
    page.getByRole("dialog", { name: "Enter Elysian Studio" }),
  ).toBeHidden();
}

test('collaboration links reach the process section while the header stays visible', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  await skipEntrance(page);
  await page.getByRole('link', { name: 'How collaboration works', exact: true }).first().click();
  await expect(page).toHaveURL(/become-a-creator#how-it-works/);
  await expect(page.locator('#how-it-works')).toBeInViewport();
  await expect(page.locator('.siteHeader')).toBeInViewport();
});
const routes = [
  "/",
  "/shop",
  "/products/sunset-vase",
  "/collections",
  "/collections/objects-for-slow-living",
  "/creators",
  "/creators/mira",
  "/become-a-creator",
  "/login",
  "/register",
  "/cart",
  "/checkout",
  "/account",
  "/account/orders",
  "/account/wishlist",
  "/account/addresses",
  "/account/settings",
  "/creator-dashboard",
  "/creator-dashboard/products",
  "/creator-dashboard/add-product",
  "/creator-dashboard/orders",
  "/creator-dashboard/collaboration",
  "/creator-dashboard/profile",
  "/admin",
  "/admin/users",
  "/admin/creators",
  "/admin/collaborations",
  "/admin/products",
  "/admin/categories",
  "/admin/inventory",
  "/admin/orders",
  "/admin/payments",
  "/about",
  "/contact",
  "/shipping",
  "/privacy",
  "/terms",
  "/missing",
];
test("browse to bag, sign in, place an order, and see it in order history", async ({
  page,
}) => {
  await page.goto("/collections/objects-for-slow-living");
  await page
    .getByRole("heading", { name: "The Sunday Vase" })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: "The Sunday Vase", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View image 2", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "The Sunday Vase, view 2", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save to wishlist", exact: true })
    .click();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByRole("status")).toContainText("Added to your bag");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove from wishlist", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Shopping bag, 2 items" }).click();
  await expect(page.getByText("₹4,900").first()).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();

  // The bag is safe, but an order needs an account.
  await expect(page.getByText(/Please sign in to place an order/)).toBeVisible();
  await page.locator("#main").getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: /\(collector\)/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  // The saved address is offered, so the manual fields are not required.
  await expect(
    page.getByRole("button", { name: /Ananya Rao/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(
    page.getByRole("heading", { name: "Thank you — your order is in." }),
  ).toBeVisible();
  const confirmation = page.locator(".successPanel");
  await expect(confirmation.getByText(/ELS-\d{4}/)).toBeVisible();
  const orderId = (await confirmation.locator("strong").innerText()).trim();
  await expect(
    page.getByRole("link", { name: "Shopping bag, 0 items" }),
  ).toBeVisible();

  // The order is now part of the buyer's history.
  await page.getByRole("link", { name: "View your orders" }).click();
  await expect(page).toHaveURL(/\/account\/orders$/);
  await expect(page.getByRole("row").filter({ hasText: orderId })).toBeVisible();
});
test("mobile menu, focus trap, search and filter drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await skipEntrance(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog", { name: "Explore Elysian" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Search the shop" }).click();
  await page
    .getByLabel("Products, materials, little things you love")
    .fill("stoneware");
  await page.getByRole("button", { name: "Submit search" }).click();
  await expect(page).toHaveURL(/q=stoneware/);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Ceramics & pottery").click();
  await expect(page.getByRole("dialog").getByLabel("Ceramics & pottery")).toBeChecked();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page).toHaveURL(/category=ceramics/);
  await expect(
    page.getByRole("heading", { name: "The Studio Cup" }),
  ).toBeVisible();
});
test("creator application is validated and lands in the studio review queue", async ({
  page,
}) => {
  await page.goto("/become-a-creator");
  await page
    .getByRole("button", { name: "Preview collaboration request" })
    .click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await page.getByLabel("Full name").fill("Asha Rao");
  await page.getByLabel("Email address").fill("asha@example.test");
  await page.getByLabel("Your craft", { exact: true }).selectOption("ceramics");
  await page
    .getByLabel("Tell us about your work")
    .fill("I make hand-thrown ceramic objects in a small Jaipur studio.");
  await page
    .getByLabel("Why would you like to join Elysian?")
    .fill("I hope to meet people who love thoughtful handmade pieces.");
  await page
    .getByLabel("A piece you would like to share")
    .fill("Handmade stoneware cup, ₹900");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Preview collaboration request" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your application is with our studio team." }),
  ).toBeVisible();
  await expect(page.getByText(/COL-\d{3}/)).toBeVisible();

  await signInAs(page, "admin");
  await page.goto("/admin/collaborations");
  await expect(
    page.getByRole("row").filter({ hasText: "Asha Rao" }),
  ).toBeVisible();
});
test("a creator can publish a piece and it survives a reload", async ({
  page,
}) => {
  await signInAs(page, "maker");
  await page.goto("/creator-dashboard/add-product");
  await page.getByLabel("Product name").fill("Monsoon Tea Cup");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A hand-thrown tea cup with a quiet green glaze.");
  await page.getByLabel("Price (INR)").fill("1200");
  await page.getByLabel("Stock", { exact: true }).fill("4");
  await page.getByLabel("Materials", { exact: true }).fill("Glazed stoneware");
  await page.getByLabel("Dimensions").fill("8 × 8 cm");
  await page.getByLabel("Status", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByRole("link", { name: "Edit Monsoon Tea Cup" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Edit Monsoon Tea Cup" }),
  ).toBeVisible();
});
test("an admin decision persists across a reload", async ({ page }) => {
  await signInAs(page, "admin");
  await page.goto("/admin/collaborations");
  await page.getByRole("button", { name: "Review Devika Nair" }).click();
  await page.getByRole("button", { name: "Approve in demo" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Devika Nair" }),
  ).toContainText("approved");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Devika Nair" }),
  ).toContainText("approved");
});
test("workspace routes require the matching role", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);

  await signInAs(page, "collector");
  await page.goto("/admin");
  await expect(
    page.getByText("This workspace is for a different role."),
  ).toBeVisible();

  await page.goto("/creator-dashboard");
  await expect(
    page.getByText("This workspace is for a different role."),
  ).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Rowan Vale");
  await page.getByLabel("Email address").fill("rowan@example.test");
  await page.getByLabel("Password").fill("longenough1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
});
for (const width of [1440, 1280, 1024, 768, 430, 390, 375])
  test(`all routes render without overflow or broken assets at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("main"), route).not.toContainText(
        "Loading the studio",
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `Overflow on ${route} at ${width}`).toBe(false);
      const broken = await page
        .locator("img")
        .evaluateAll((imgs) =>
          (imgs as HTMLImageElement[])
            .filter((i) => i.complete && i.naturalWidth === 0)
            .map((i) => i.src),
        );
      expect(broken, `Broken image on ${route}`).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
for (const route of [
  "/",
  "/shop",
  "/products/sunset-vase",
  "/become-a-creator",
  "/login",
  "/account",
  "/admin",
])
  test(`accessibility: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('main')).not.toContainText('Loading the studio');
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
test("captures desktop and mobile pages, and respects reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "screenshots/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "screenshots/home-mobile.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
});
