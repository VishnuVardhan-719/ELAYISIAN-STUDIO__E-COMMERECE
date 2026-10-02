import { describe, expect, it } from "vitest";
import {
  cartTotal,
  checkoutShipping,
  filterProducts,
  formatPrice,
  normalizeCart,
  validateCollaboration,
} from "../utils/commerce";
import { products } from "../data/mock";
import {
  adminService,
  creatorService,
  orderService,
  productService,
} from "../services/api";
import type { CollaborationInput } from "../types/domain";
const valid: CollaborationInput = {
  name: "Asha Rao",
  email: "asha@example.test",
  categoryId: "ceramics",
  portfolio: "https://example.test/asha",
  description:
    "I make hand-thrown stoneware in a small independent Jaipur studio.",
  reason: "I want to reach people who value thoughtful craft.",
  sample: "A hand-thrown teacup, ₹900",
  terms: true,
};
describe("Commerce rules", () => {
  it("waives shipping only for a nonempty bookmark-only bag or the subtotal threshold", () => {
    const bookmark = { productId: "expo-demo-bookmark", quantity: 1 };
    expect(checkoutShipping(1, [bookmark])).toBe(0);
    expect(checkoutShipping(2, [bookmark, bookmark])).toBe(0);
    expect(checkoutShipping(0, [])).toBe(150);
    expect(checkoutShipping(2999, [bookmark, { productId: "studio-cup", quantity: 1 }])).toBe(150);
    expect(checkoutShipping(3000, [{ productId: "studio-cup", quantity: 4 }])).toBe(0);
  });
  it("formats prices using INR and Indian grouping", () =>
    expect(formatPrice(123450)).toBe("₹1,23,450"));
  it("combines search, category and maximum price", () => {
    const result = filterProducts(products, {
      search: "stoneware",
      category: "ceramics",
      maxPrice: 2300,
    });
    expect(result.items.map((p) => p.id)).toEqual([
      "breakfast-bowls",
      "studio-cup",
    ]);
  });
  it("sorts before pagination and bounds an invalid page", () => {
    const result = filterProducts(products, {
      sort: "price-asc",
      pageSize: 3,
      page: 2,
    });
    expect(result.items.map((p) => p.price)).toEqual([1650, 1850, 2100]);
    expect(filterProducts(products, { page: 999, pageSize: 3 }).page).toBe(4);
  });
  it("has a useful empty search result", () =>
    expect(
      filterProducts(products, { search: "no-matching-artwork" }),
    ).toMatchObject({ total: 0, pages: 1, items: [] }));
  it("coalesces quantities, caps inventory and removes stale or unavailable items", () => {
    expect(
      normalizeCart(
        [
          { productId: "sunset-vase", quantity: 5 },
          { productId: "sunset-vase", quantity: 20 },
          { productId: "brass-pendant", quantity: 1 },
          { productId: "missing", quantity: 3 },
          { productId: "studio-cup", quantity: -1 },
        ],
        products,
      ),
    ).toEqual([{ productId: "sunset-vase", quantity: 8 }]);
  });
  it("calculates cart totals from catalog prices", () =>
    expect(
      cartTotal(
        [
          { productId: "sunset-vase", quantity: 2 },
          { productId: "studio-cup", quantity: 1 },
        ],
        products,
      ),
    ).toBe(5850));
});
describe("Collaboration boundaries", () => {
  it("accepts an original craft application", () =>
    expect(validateCollaboration(valid)).toEqual({}));
  it("rejects malformed links and missing consent", () =>
    expect(
      validateCollaboration({
        ...valid,
        portfolio: "javascript:alert(1)",
        terms: false,
      }),
    ).toMatchObject({
      portfolio: expect.any(String),
      terms: expect.any(String),
    }));
  it("records the application in the review queue", async () => {
    const created = await creatorService.createCollaborationDraft(valid);
    expect(created).toMatchObject({
      creatorName: "Asha Rao",
      status: "pending",
    });
    expect(created.id).toMatch(/^COL-\d{3}$/);
    const queue = await adminService.listCollaborations();
    expect(queue.some((entry) => entry.id === created.id)).toBe(true);
  });
  it("rejects invalid drafts at the service boundary", async () => {
    await expect(
      creatorService.createCollaborationDraft({ ...valid, name: "" }),
    ).rejects.toThrow("check the application");
  });
});
describe("Service boundaries", () => {
  it("returns null for an unknown piece", async () =>
    expect(await productService.getById("missing")).toBeNull());
  it("returns defensive copies", async () => {
    const p = await productService.getById("sunset-vase");
    p!.name = "Changed";
    expect((await productService.getById("sunset-vase"))?.name).toBe(
      "The Sunday Vase",
    );
  });
  it("isolates creator order lines and totals", async () => {
    const orders = await orderService.listForCreator("mira");
    expect(orders).toHaveLength(2);
    expect(orders.reduce((s, o) => s + o.total, 0)).toBe(6850);
  });
});
