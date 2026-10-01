import { compareSync } from "bcryptjs";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Cart as CartModel } from "../../database/src/models/Cart";
import { Order as OrderModel } from "../../database/src/models/Order";
import { Payment as PaymentModel } from "../../database/src/models/Payment";
import { Product as ProductModel } from "../../database/src/models/Product";
import {
  addCartItem,
  createCheckout,
  createCollaboration,
  createUser,
  getCart,
  getAdminSummary,
  getProductById,
  getUserByEmail,
  listAddresses,
  listOrders,
  listPayments,
  listProducts,
  removeAddress,
  resetStore,
  reviewCollaboration,
  saveAddress,
  saveProduct,
} from "../src/store";

const TEST_URI = "mongodb://127.0.0.1:27017/elysian_test_store";

const address = {
  name: "Ananya Rao",
  line: "24, Gulmohar Lane",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560001",
  phone: "9876543210",
};

describe("mongoose server store", () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rebuilds declared indexes when reseeding without dropping collections", async () => {
    await ProductModel.collection.dropIndex("categoryId_1");
    await resetStore();
    const indexes = await ProductModel.collection.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { id: 1 }, unique: true }),
      expect.objectContaining({ key: { categoryId: 1 } }),
      expect.objectContaining({ key: { creatorId: 1 } }),
      expect.objectContaining({ key: { status: 1 } }),
      expect.objectContaining({ weights: { name: 1, description: 1, material: 1 } }),
    ]));
  });

  it("projects legacy nested cart documents to the exact cart contract", async () => {
    await CartModel.collection.insertOne({
      userId: "demo-customer",
      items: [{ productId: "sunset-vase", quantity: 2, _id: new mongoose.Types.ObjectId(), __v: 1 }],
    });
    expect(await getCart("demo-customer")).toEqual([
      { productId: "sunset-vase", quantity: 2 },
    ]);
  });

  it("aggregates the exact five-field summary including empty collections", async () => {
    const aggregate = vi.spyOn(ProductModel, "aggregate");
    const expected = {
      products: await ProductModel.countDocuments(),
      creators: await mongoose.model("Creator").countDocuments(),
      orders: await OrderModel.countDocuments(),
      pending: await mongoose.model("Collaboration").countDocuments({ status: "pending" }),
      lowStock: await ProductModel.countDocuments({ stock: { $lt: 4 } }),
    };
    expect(await getAdminSummary()).toEqual(expected);
    expect(aggregate).toHaveBeenCalled();
    await Promise.all([
      ProductModel.deleteMany({}),
      mongoose.model("Creator").deleteMany({}),
      OrderModel.deleteMany({}),
      mongoose.model("Collaboration").deleteMany({}),
    ]);
    expect(await getAdminSummary()).toEqual({ products: 0, creators: 0, orders: 0, pending: 0, lowStock: 0 });
  });

  it("seeds isolated catalogue, users, and owned addresses", async () => {
    const first = await listProducts({ category: "ceramics", pageSize: 100 });
    first.items[0].name = "Changed outside the store";

    expect(
      (await listProducts({ category: "ceramics", pageSize: 100 })).items[0].name,
    ).toBe("The Sunday Vase");
    expect((await getUserByEmail("MIRA@EXAMPLE.TEST"))?.user.creatorId).toBe(
      "mira",
    );
    expect(await listAddresses("demo-customer")).toMatchObject([
      { id: "addr-1", userId: "demo-customer" },
    ]);
  });

  it("matches the product filtering and pagination contract", async () => {
    const result = await listProducts({
      search: "stoneware",
      category: "ceramics",
      maxPrice: 2500,
      sort: "price-desc",
      pageSize: 1,
      page: 99,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(result.pages);
    expect(result.items[0].status).toBe("active");
  });

  it("normalizes carts and enforces inventory", async () => {
    expect(await addCartItem("demo-customer", "sunset-vase", 2)).toEqual([
      { productId: "sunset-vase", quantity: 2 },
    ]);
    expect(await addCartItem("demo-customer", "sunset-vase", 1)).toEqual([
      { productId: "sunset-vase", quantity: 3 },
    ]);
    await expect(
      addCartItem("demo-customer", "sunset-vase", 99),
    ).rejects.toThrow("Only 8 available. You already have 3 in your bag.");
    expect(await getCart("demo-customer")).toEqual([
      { productId: "sunset-vase", quantity: 3 },
    ]);
  });

  it("creates sequential collaboration records and reviews them", async () => {
    const created = await createCollaboration({
      name: "Leela Rao",
      email: "leela@example.test",
      categoryId: "art",
      portfolio: "https://example.test/leela",
      description: "Original botanical prints made by hand in small editions.",
      reason: "I want to meet collectors who value slow printmaking.",
      sample: "A hand-pulled monsoon fern print.",
      terms: true,
    });

    expect(created.id).toBe("COL-023");
    expect(await reviewCollaboration(created.id, "approved")).toMatchObject({
      id: "COL-023",
      status: "approved",
    });
  });

  it("stores bcrypt password hashes without exposing them on users", async () => {
    const created = await createUser({
      name: "New Collector",
      email: "NEW@EXAMPLE.TEST",
      password: "longenough1",
    });
    const stored = await getUserByEmail("new@example.test");

    expect(created).toMatchObject({ email: "new@example.test", role: "customer" });
    expect(stored?.user).not.toHaveProperty("passwordHash");
    expect(stored?.passwordHash).not.toBe("longenough1");
    expect(compareSync("longenough1", stored?.passwordHash ?? "")).toBe(true);
  });

  it("matches registration and product validation errors", async () => {
    await expect(
      createUser({ name: "N", email: "invalid", password: "short" }),
    ).rejects.toThrow("Enter your full name.");
    await expect(
      saveProduct({
        ...(await getProductById("sunset-vase"))!,
        name: "",
        price: 0,
      }),
    ).rejects.toThrow("Enter a name, positive price and valid stock.");
  });

  it("keeps address writes scoped to their owner", async () => {
    await saveAddress("someone-else", { id: "addr-other", ...address });

    expect(await listAddresses("someone-else")).toHaveLength(1);
    await expect(removeAddress("demo-customer", "addr-other")).rejects.toThrow(
      "Address not found.",
    );
    expect(await listAddresses("someone-else")).toHaveLength(1);
  });

  it("creates an order, simulated payment, stock change, and clears the cart", async () => {
    const before = (await getProductById("sunset-vase"))!;
    await addCartItem("demo-customer", "sunset-vase", 1);
    const order = await createCheckout(
      {
        userId: "demo-customer",
        items: [{ productId: "sunset-vase", quantity: 1 }],
        address,
      },
      async ({ orderId, amount }) => ({
        id: "PAY-004",
        orderId,
        amount,
        method: "UPI (sample)",
        status: "Recorded demo",
      }),
    );

    expect(order.total).toBe(before.price);
    expect((await getProductById("sunset-vase"))?.stock).toBe(before.stock - 1);
    expect((await listPayments()).at(-1)).toMatchObject({
      id: "PAY-004",
      orderId: order.id,
      amount: order.total,
    });
    expect(await getCart("demo-customer")).toEqual([]);
  });

  it.each(["order", "payment", "cart", "cart-after-write"])("compensates %s persistence failure without changing order/payment/stock/cart", async (failure) => {
    await addCartItem("demo-customer", "sunset-vase", 2);
    const before = {
      orders: await listOrders(),
      payments: await listPayments(),
      product: await getProductById("sunset-vase"),
      cart: await getCart("demo-customer"),
    };
    if (failure === "order") vi.spyOn(OrderModel, "create").mockRejectedValueOnce(new Error("Persistence failed."));
    if (failure === "payment") vi.spyOn(PaymentModel, "create").mockRejectedValueOnce(new Error("Persistence failed."));
    if (failure === "cart") {
      vi.spyOn(CartModel, "updateOne").mockImplementationOnce(() => {
        throw new Error("Persistence failed.");
      });
    }
    if (failure === "cart-after-write") {
      const update = CartModel.updateOne.bind(CartModel);
      vi.spyOn(CartModel, "updateOne").mockImplementationOnce(() =>
        update({ userId: "demo-customer" }, { $set: { items: [] } }).then(() => {
          throw new Error("Persistence failed.");
        }) as unknown as ReturnType<typeof CartModel.updateOne>,
      );
    }
    await expect(createCheckout({ userId: "demo-customer", items: before.cart, address })).rejects.toThrow("Persistence failed.");
    expect(await listOrders()).toEqual(before.orders);
    expect(await listPayments()).toEqual(before.payments);
    expect(await getProductById("sunset-vase")).toEqual(before.product);
    expect(await getCart("demo-customer")).toEqual(before.cart);
  });

  it("uses conditional stock reservations and releases only its own deltas on a race", async () => {
    const second = (await listProducts({ pageSize: 100 })).items.find((product) => product.id !== "sunset-vase" && product.stock > 0)!;
    await addCartItem("demo-customer", "sunset-vase", 1);
    await addCartItem("demo-customer", second.id, 1);
    const cart = await getCart("demo-customer");
    const orders = await listOrders();
    const payments = await listPayments();
    const first = await getProductById("sunset-vase");
    await expect(createCheckout({ userId: "demo-customer", items: cart, address }, async ({ orderId, amount }) => {
      await ProductModel.updateOne({ id: second.id }, { $set: { stock: 0 } });
      return { id: "PAY-004", orderId, amount, method: "UPI (sample)", status: "Recorded demo" };
    })).rejects.toThrow();
    expect(await getProductById("sunset-vase")).toEqual(first);
    expect((await getProductById(second.id))?.stock).toBe(0);
    expect(await listOrders()).toEqual(orders);
    expect(await listPayments()).toEqual(payments);
    expect(await getCart("demo-customer")).toEqual(cart);
  });

  it("rolls back checkout when the payment provider fails", async () => {
    const before = (await getProductById("sunset-vase"))!;
    const orderCount = (await listOrders()).length;
    const paymentCount = (await listPayments()).length;

    await expect(
      createCheckout(
        {
          userId: "demo-customer",
          items: [{ productId: "sunset-vase", quantity: 1 }],
          address,
        },
        async () => {
          throw new Error("Payment provider unavailable.");
        },
      ),
    ).rejects.toThrow("Payment provider unavailable.");

    expect((await getProductById("sunset-vase"))?.stock).toBe(before.stock);
    expect(await listOrders()).toHaveLength(orderCount);
    expect(await listPayments()).toHaveLength(paymentCount);
  });

  it("combines duplicate checkout lines before validating and reducing stock", async () => {
    const before = (await getProductById("sunset-vase"))!;
    const order = await createCheckout({
      userId: "demo-customer",
      items: [
        { productId: "sunset-vase", quantity: 2 },
        { productId: "sunset-vase", quantity: 3 },
      ],
      address,
    });

    expect(order.items).toMatchObject([{ productId: "sunset-vase", quantity: 5 }]);
    expect((await getProductById("sunset-vase"))?.stock).toBe(before.stock - 5);
  });

  it("serializes concurrent checkouts so stock cannot go negative", async () => {
    const checkout = () =>
      createCheckout({
        userId: "demo-customer",
        items: [{ productId: "sunset-vase", quantity: 5 }],
        address,
      });

    const results = await Promise.allSettled([checkout(), checkout()]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await getProductById("sunset-vase"))?.stock).toBe(3);
  });
});