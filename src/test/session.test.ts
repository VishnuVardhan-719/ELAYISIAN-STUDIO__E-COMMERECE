import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PASSWORD,
  accountService,
  adminService,
  authService,
  orderService,
  productService,
  resetDemoData,
} from "../services/api";
import type { Address } from "../types/domain";

const address: Omit<Address, "id" | "userId"> = {
  name: "Ananya Rao",
  line: "24, Gulmohar Lane",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560001",
  phone: "9876543210",
};

describe("Authentication", () => {
  beforeEach(() => resetDemoData());

  it("signs in a seeded demo account and restores it by token", async () => {
    const { token, user } = await authService.login(
      "ananya@example.test",
      DEMO_PASSWORD,
    );
    expect(user.role).toBe("customer");
    expect(await authService.me(token)).toMatchObject({ id: user.id });
  });

  it("rejects a wrong password", async () => {
    await expect(
      authService.login("ananya@example.test", "not-the-password"),
    ).rejects.toThrow();
  });

  it("registers a customer once and refuses a duplicate email", async () => {
    const { user } = await authService.register({
      name: "New Maker",
      email: "new@example.test",
      password: "longenough1",
    });
    expect(user.role).toBe("customer");
    expect((await authService.me(`demo.${user.id}`))?.email).toBe(
      "new@example.test",
    );
    await expect(
      authService.register({
        name: "New Maker",
        email: "new@example.test",
        password: "longenough1",
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("links the seeded creator account to a studio", async () => {
    const { user } = await authService.login("mira@example.test", DEMO_PASSWORD);
    expect(user.creatorId).toBe("mira");
  });
});

describe("Checkout", () => {
  beforeEach(() => resetDemoData());

  it("creates an order and a payment, and reduces stock", async () => {
    const before = await productService.getById("sunset-vase");
    const order = await orderService.create({
      userId: "demo-customer",
      items: [{ productId: "sunset-vase", quantity: 2 }],
      address,
    });
    expect(order.id).toMatch(/^ELS-\d{4}$/);
    expect(order.total).toBe((before?.price ?? 0) * 2);
    expect(order.status).toBe("Processing");

    const after = await productService.getById("sunset-vase");
    expect(after?.stock).toBe((before?.stock ?? 0) - 2);

    const payments = await adminService.listPayments();
    expect(payments.some((payment) => payment.orderId === order.id)).toBe(true);
  });

  it("adds the new order to the buyer's history", async () => {
    const order = await orderService.create({
      userId: "demo-customer",
      items: [{ productId: "studio-cup", quantity: 1 }],
      address,
    });
    const history = await orderService.listForUser("demo-customer");
    expect(history.map((entry) => entry.id)).toContain(order.id);
  });

  it("refuses an empty bag and a quantity beyond stock", async () => {
    await expect(
      orderService.create({
        userId: "demo-customer",
        items: [],
        address,
      }),
    ).rejects.toThrow(/empty/);
    await expect(
      orderService.create({
        userId: "demo-customer",
        items: [{ productId: "sunset-vase", quantity: 999 }],
        address,
      }),
    ).rejects.toThrow(/Only/);
  });
});

describe("Account ownership", () => {
  beforeEach(() => resetDemoData());

  it("scopes addresses to the signed-in user", async () => {
    const mine = await accountService.listAddresses("demo-customer");
    expect(mine.length).toBeGreaterThan(0);
    expect(await accountService.listAddresses("someone-else")).toHaveLength(0);
  });

  it("persists a profile change", async () => {
    await accountService.updateProfile("demo-customer", { name: "Ananya R." });
    const profile = await accountService.getProfile("demo-customer");
    expect(profile?.name).toBe("Ananya R.");
  });
});
