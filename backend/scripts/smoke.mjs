const BASE = "http://127.0.0.1:4000/api";
let pass = 0;
let fail = 0;

async function call(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(BASE + path, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function check(label, condition, detail) {
  if (condition) {
    pass += 1;
    console.log("PASS  " + label);
  } else {
    fail += 1;
    console.log("FAIL  " + label + " -> " + detail);
  }
}

function login(email) {
  return call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "elysian123" }),
  });
}

const short = (value) => JSON.stringify(value).slice(0, 150);

(async () => {
  const health = await call("/health");
  check("health reports connected", health.body.database === "connected", short(health.body));

  const products = await call("/products");
  check(
    "GET /products reports 12 total",
    products.body.total === 12 &&
      Array.isArray(products.body.items) &&
      products.body.items.length > 0,
    "total=" + products.body.total + " len=" + (products.body.items ?? []).length,
  );
  check("products keep string ids", products.body.items?.[0]?.id === "sunset-vase", products.body.items?.[0]?.id);

  const single = await call("/products/sunset-vase");
  check("GET /products/:id works", single.body?.id === "sunset-vase", short(single.body));

  const related = await call("/products/sunset-vase/related");
  check("related capped at 4", Array.isArray(related.body) && related.body.length <= 4, "len=" + related.body?.length);

  const search = await call("/products?search=vase");
  check("search filter works", search.body.items?.length >= 1, "total=" + search.body.total);

  const customer = await login("ananya@example.test");
  check(
    "customer login works",
    customer.status === 200 && typeof customer.body.token === "string",
    customer.status + " " + short(customer.body),
  );

  const auth = { Authorization: "Bearer " + customer.body.token };
  const me = await call("/auth/me", { headers: auth });
  check("GET /auth/me returns the session user", me.body?.id === "demo-customer", short(me.body));
  check("me never leaks passwordHash", me.body?.passwordHash === undefined, "leaked");

  const cart0 = await call("/cart", { headers: auth });
  check("GET /cart starts empty", Array.isArray(cart0.body) && cart0.body.length === 0, short(cart0.body));

  const added = await call("/cart", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ productId: "sunset-vase", quantity: 2 }),
  });
  check(
    "POST /cart adds an item",
    added.body?.[0]?.productId === "sunset-vase" && added.body[0].quantity === 2,
    short(added.body),
  );

  const over = await call("/cart", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ productId: "sunset-vase", quantity: 99 }),
  });
  check(
    "stock guard rejects over-order",
    over.status === 400 && String(over.body?.error ?? "").includes("Only"),
    over.status + " " + short(over.body),
  );

  const wish = await call("/wishlist", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ productIds: ["sunset-vase", "sunset-vase"] }),
  });
  check("wishlist dedupes", Array.isArray(wish.body) && wish.body.length === 1, short(wish.body));

  const order = await call("/orders", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      userId: "demo-customer",
      items: [{ productId: "sunset-vase", quantity: 2 }],
      address: {
        name: "Ananya Rao",
        line: "12 Kilpauk",
        city: "Chennai",
        state: "TN",
        postalCode: "600010",
        phone: "9876543210",
      },
    }),
  });
  check("checkout creates an order", typeof order.body?.id === "string", order.status + " " + short(order.body));

  const stocked = await call("/products/sunset-vase");
  check("checkout decremented stock 8 to 6", stocked.body?.stock === 6, "stock=" + stocked.body?.stock);

  const cartAfter = await call("/cart", { headers: auth });
  check("checkout cleared the bag", cartAfter.body?.length === 0, short(cartAfter.body));

  const admin = await login("studio@example.test");
  const adminAuth = { Authorization: "Bearer " + admin.body.token };
  const summary = await call("/admin/summary", { headers: adminAuth });
  check("admin summary counts products", summary.body?.products === 12, short(summary.body));

  const payments = await call("/payments", { headers: adminAuth });
  check("payment was recorded", payments.body?.length === 4, "len=" + payments.body?.length);

  const creator = await login("mira@example.test");
  const creatorAuth = { Authorization: "Bearer " + creator.body.token };
  const manage = await call("/products/manage", { headers: creatorAuth });
  check(
    "creator sees own products (creatorId resolved)",
    Array.isArray(manage.body) && manage.body.length > 0,
    manage.status + " " + short(manage.body),
  );

  const forbidden = await call("/users", { headers: creatorAuth });
  check("creator blocked from /users", forbidden.status === 403, String(forbidden.status));

  const collab = await call("/collaborations", {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke Studio",
      email: "smoke@studio.test",
      categoryId: "ceramics",
      portfolio: "https://example.test",
      description: "A smoke test application record.",
      reason: "We would like to collaborate.",
      sample: "https://example.test/sample",
      terms: true,
    }),
  });
  check(
    "collaboration application accepted",
    collab.status === 201 && typeof collab.body?.id === "string",
    collab.status + " " + short(collab.body),
  );

  console.log("");
  console.log("=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail === 0 ? 0 : 1);
})().catch((error) => {
  console.log("SMOKE CRASHED -> " + error.message);
  process.exit(1);
});
