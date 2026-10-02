import type {
  CartItem,
  CollaborationInput,
  Product,
  ProductFilters,
  PageResult,
} from "../types/domain";
export const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
export function filterProducts(
  products: Product[],
  filters: ProductFilters = {},
): PageResult<Product> {
  const q = (filters.search ?? "").trim().toLowerCase();
  const matches = products.filter(
    (p) =>
      p.status === "active" &&
      (!q ||
        `${p.name} ${p.description} ${p.material}`.toLowerCase().includes(q)) &&
      (!filters.category || p.categoryId === filters.category) &&
      (filters.maxPrice === undefined || p.price <= filters.maxPrice),
  );
  if (filters.sort === "price-asc") matches.sort((a, b) => a.price - b.price);
  if (filters.sort === "price-desc") matches.sort((a, b) => b.price - a.price);
  if (filters.sort === "name")
    matches.sort((a, b) => a.name.localeCompare(b.name));
  const pageSize = Math.max(1, filters.pageSize || 9),
    pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.max(1, Math.min(filters.page || 1, pages));
  return {
    items: matches.slice((page - 1) * pageSize, page * pageSize),
    total: matches.length,
    pages,
    page,
  };
}
export function normalizeCart(items: CartItem[], products: Product[]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const product = products.find(
      (p) => p.id === item.productId && p.status === "active",
    );
    if (
      !product ||
      product.stock < 1 ||
      !Number.isFinite(item.quantity) ||
      item.quantity < 1
    )
      continue;
    quantities.set(
      item.productId,
      Math.min(
        product.stock,
        (quantities.get(item.productId) || 0) + Math.floor(item.quantity),
      ),
    );
  }
  return [...quantities].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}
export function cartTotal(items: CartItem[], products: Product[]) {
  return items.reduce(
    (total, item) =>
      total +
      (products.find((p) => p.id === item.productId)?.price || 0) *
        item.quantity,
    0,
  );
}
export function checkoutShipping(subtotal: number, items: CartItem[]): number {
  return (items.length > 0 && items.every((item) => item.productId === "expo-demo-bookmark")) || subtotal >= 3000 ? 0 : 150;
}
export function validateCollaboration(input: CollaborationInput) {
  const errors: Partial<Record<keyof CollaborationInput, string>> = {};
  if (input.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    errors.email = "Enter a valid email address.";
  if (!input.categoryId) errors.categoryId = "Choose your craft.";
  if (input.portfolio) {
    try {
      const url = new URL(input.portfolio);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      errors.portfolio = "Enter a full http or https URL.";
    }
  }
  if (input.description.trim().length < 30)
    errors.description = "Tell us about your work in at least 30 characters.";
  if (input.reason.trim().length < 15)
    errors.reason =
      "Add at least 15 characters about why you would like to join.";
  if (!input.sample.trim())
    errors.sample = "Describe one product you would like to share.";
  if (!input.terms) errors.terms = "Please agree to the collaboration terms.";
  return errors;
}
