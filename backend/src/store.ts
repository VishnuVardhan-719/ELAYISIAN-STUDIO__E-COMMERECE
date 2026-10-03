import { hashSync } from "bcryptjs";
import mongoose, { type ClientSession } from "mongoose";
import type {
  Address,
  CartItem,
  Category,
  Collaboration,
  CollaborationInput,
  Collection,
  Creator,
  Order,
  PageResult,
  Payment,
  Product,
  ProductFilters,
  User,
} from "../../frontend/src/types/domain";
import {
  checkoutShipping,
  filterProducts,
  normalizeCart,
  validateCollaboration,
} from "../../frontend/src/utils/commerce";
import { Address as AddressModel } from "../../database/src/models/Address";
import { Cart as CartModel } from "../../database/src/models/Cart";
import { Category as CategoryModel } from "../../database/src/models/Category";
import { Collaboration as CollaborationModel } from "../../database/src/models/Collaboration";
import { Collection as CollectionModel } from "../../database/src/models/Collection";
import { Creator as CreatorModel } from "../../database/src/models/Creator";
import { Order as OrderModel } from "../../database/src/models/Order";
import { Payment as PaymentModel } from "../../database/src/models/Payment";
import { Product as ProductModel } from "../../database/src/models/Product";
import { User as UserModel } from "../../database/src/models/User";
import { DEMO_PASSWORD, seedDatabase } from "../../database/src/seed";
import { supportsTransactions } from "../../database/src/db";
import { assets } from "../../frontend/src/data/assets";
import { HttpError } from "./middleware/errors";

export { DEMO_PASSWORD };

export interface StoredUser {
  user: User;
  passwordHash: string;
}

export interface CheckoutInput {
  userId: string;
  items: CartItem[];
  address: Omit<Address, "id" | "userId">;
}

export type PaymentProvider = (input: {
  orderId: string;
  amount: number;
}) => Promise<Payment>;

type StoredUserDoc = User & { passwordHash: string };

function plainAll<T>(docs: unknown[]): T[] {
  return docs.map((doc) => {
    const value = doc as Record<string, unknown>;
    delete value._id;
    delete value.__v;
    return value as T;
  });
}

function plainOne<T>(doc: unknown): T | null {
  if (!doc) return null;
  const value = doc as Record<string, unknown>;
  delete value._id;
  delete value.__v;
  return value as T;
}

function nextSequentialId(existing: string[], prefix: string, width: number): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highest = existing.reduce((max, id) => {
    const match = pattern.exec(id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(width, "0")}`;
}

async function allProducts(): Promise<Product[]> {
  return plainAll<Product>(await ProductModel.find().lean());
}

export async function resetStore(): Promise<void> {
  await seedDatabase();
}

export async function listProducts(
  filters: ProductFilters = {},
  creatorId?: string,
): Promise<PageResult<Product>> {
  const docs = await ProductModel.find(creatorId ? { creatorId } : {}).lean();
  return filterProducts(plainAll<Product>(docs), filters);
}

export async function listAllProducts(): Promise<Product[]> {
  return allProducts();
}

export async function getProductById(id: string): Promise<Product | null> {
  return plainOne<Product>(
    await ProductModel.findOne({ id, status: "active" }).lean(),
  );
}

export async function listRelatedProducts(id: string): Promise<Product[]> {
  const product = (await ProductModel.findOne({ id })
    .select("categoryId")
    .lean()) as { categoryId?: string } | null;
  if (!product) return [];
  const docs = await ProductModel.find({
    id: { $ne: id },
    status: "active",
    categoryId: product.categoryId,
  })
    .limit(4)
    .lean();
  return plainAll<Product>(docs);
}

export async function listProductsForCreator(
  creatorId: string,
): Promise<Product[]> {
  return plainAll<Product>(await ProductModel.find({ creatorId }).lean());
}

export async function listProductsByIds(ids: string[]): Promise<Product[]> {
  return plainAll<Product>(await ProductModel.find({ id: { $in: ids } }).lean());
}

export async function saveProduct(product: Product): Promise<Product> {
  if (
    !product.name.trim() ||
    !Number.isFinite(product.price) ||
    product.price <= 0 ||
    !Number.isInteger(product.stock) ||
    product.stock < 0
  )
    throw new Error("Enter a name, positive price and valid stock.");
  await ProductModel.findOneAndUpdate(
    { id: product.id },
    {
      $set: { ...product },
      ...(product.featured === undefined ? { $unset: { featured: 1 } } : {}),
    },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" },
  ).lean();
  return structuredClone(product);
}

export async function listCategories(): Promise<Category[]> {
  return plainAll<Category>(await CategoryModel.find().lean());
}

export async function listCollections(): Promise<Collection[]> {
  return plainAll<Collection>(await CollectionModel.find().lean());
}

export async function getCollectionBySlug(
  slug: string,
): Promise<Collection | null> {
  return plainOne<Collection>(await CollectionModel.findOne({ slug }).lean());
}

export async function listCreators(): Promise<Creator[]> {
  return plainAll<Creator>(await CreatorModel.find().lean());
}

export async function getCreatorById(id: string): Promise<Creator | null> {
  return plainOne<Creator>(await CreatorModel.findOne({ id }).lean());
}

export async function updateCreator(
  id: string,
  patch: Partial<Omit<Creator, "id">>,
): Promise<Creator | null> {
  const doc = await CreatorModel.findOneAndUpdate(
    { id },
    { $set: { ...patch } },
    { returnDocument: "after" },
  ).lean();
  return plainOne<Creator>(doc);
}

export async function listCollaborations(): Promise<Collaboration[]> {
  return plainAll<Collaboration>(await CollaborationModel.find().lean());
}

export async function getCollaborationFor(
  userId: string,
): Promise<Collaboration | null> {
  return plainOne<Collaboration>(
    await CollaborationModel.findOne({ userId })
      .sort({ _id: -1 })
      .lean(),
  );
}

export async function createCollaboration(
  input: CollaborationInput,
  userId: string,
): Promise<Collaboration> {
  if (Object.keys(validateCollaboration(input)).length)
    throw new Error("Please check the application fields.");
  const user = await UserModel.findOne({ id: userId }).lean<User>();
  if (!user) throw new HttpError(401, "Authentication required.");
  if (input.email.trim().toLowerCase() !== user.email)
    throw new HttpError(400, "Use your account email for the application.");
  const ids = (await CollaborationModel.find().select("id").lean()).map(
    (entry) => (entry as unknown as { id: string }).id,
  );
  const collaboration: Collaboration = {
    id: nextSequentialId(ids, "COL", 3),
    creatorName: input.name,
    email: user.email,
    categoryId: input.categoryId,
    description: input.description,
    status: "pending",
    date: new Date().toISOString().slice(0, 10),
  };
  await CollaborationModel.create({ ...collaboration, userId });
  return collaboration;
}

export async function reviewCollaboration(
  id: string,
  status: Collaboration["status"],
): Promise<Collaboration | null> {
  if (status !== "approved") {
    const updated = await CollaborationModel.findOneAndUpdate(
      { id, status: { $ne: "approved" } },
      { $set: { status } },
      { returnDocument: "after" },
    ).lean();
    if (updated) return plainOne<Collaboration>(updated);
    if (await CollaborationModel.exists({ id }))
      throw new HttpError(409, "Approved applications cannot be reopened or declined.");
    return null;
  }
  const application = await CollaborationModel.findOne({ id }).select("+userId").lean<Collaboration & { userId?: string }>();
  if (!application) return null;
  if (!application.userId) {
    if (application.status === "approved") {
      const { userId: _userId, ...publicApplication } = application;
      return plainOne<Collaboration>(publicApplication);
    }
    throw new HttpError(409, "The applicant must sign in and resubmit this application.");
  }
  if (!(await supportsTransactions()))
    throw new HttpError(503, "Creator approval requires a transaction-capable database.");
  return mongoose.connection.transaction(async (session) => {
    const current = await CollaborationModel.findOne({ id }).select("+userId").session(session).lean<Collaboration & { userId?: string }>();
    if (!current) return null;
    if (!current.userId)
      throw new HttpError(409, "The applicant must sign in and resubmit this application.");
    const user = await UserModel.findOne({ id: current.userId }).session(session).lean<User>();
    if (!user || user.role === "admin")
      throw new HttpError(409, "This applicant cannot be provisioned as a creator.");
    const category = await CategoryModel.findOne({ id: current.categoryId }).session(session).lean<Category>();
    if (!category) throw new HttpError(409, "The application craft is no longer available.");
    const creatorId = user.creatorId || `creator-${user.id}`;
    if (await UserModel.exists({ id: { $ne: user.id }, creatorId }).session(session))
      throw new HttpError(409, "This creator profile is already linked to another account.");
    await CreatorModel.updateOne({ id: creatorId }, { $setOnInsert: {
      id: creatorId,
      name: current.creatorName,
      studio: current.creatorName,
      specialty: category.name,
      location: "Profile setup pending",
      bio: current.description,
      image: assets.collaboration,
      cover: assets.studio,
      since: new Date().getFullYear(),
    } }, { upsert: true, runValidators: true, session });
    const linked = await UserModel.updateOne(
      { id: user.id, role: user.role },
      { $set: { role: "creator", creatorId } },
      { runValidators: true, session },
    );
    if (linked.matchedCount !== 1)
      throw new HttpError(409, "The applicant account changed during review.");
    return plainOne<Collaboration>(await CollaborationModel.findOneAndUpdate(
      { id }, { $set: { status: "approved" } }, { returnDocument: "after", session },
    ).lean());
  });
}

export async function listUsers(): Promise<User[]> {
  return plainAll<User>(await UserModel.find().lean());
}

export async function getUserById(id: string): Promise<User | null> {
  return plainOne<User>(await UserModel.findOne({ id }).lean());
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  const normalized = email.trim().toLowerCase();
  const doc = await UserModel.findOne({ email: normalized })
    .select("+passwordHash")
    .lean();
  if (!doc) return null;
  const record = plainOne<StoredUserDoc>(doc);
  if (!record) return null;
  const { passwordHash, ...user } = record;
  return { user: user as User, passwordHash };
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (input.name.trim().length < 2) throw new Error("Enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  if (input.password.length < 8)
    throw new Error("Choose a password of at least 8 characters.");
  if (Buffer.byteLength(input.password, "utf8") > 72)
    throw new Error("Choose a password of at most 72 bytes.");
  if (await UserModel.exists({ email }))
    throw new Error("An account already exists for that email.");
  const user: User = {
    id: `user-${Date.now().toString(36)}`,
    name: input.name.trim(),
    email,
    role: "customer",
  };
  await UserModel.create({
    ...user,
    passwordHash: hashSync(input.password, 10),
  });
  return user;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "name" | "email">>,
): Promise<User | null> {
  const existing = (await UserModel.findOne({ id })
    .select("email")
    .lean()) as { email?: string } | null;
  if (!existing) return null;
  const email = patch.email?.trim().toLowerCase();
  if (email && (await UserModel.exists({ email, id: { $ne: id } })))
    throw new Error("An account already exists for that email.");
  return plainOne<User>(
    await UserModel.findOneAndUpdate(
      { id },
      {
        $set: {
          ...patch,
          email: email ?? existing.email,
        },
      },
      { returnDocument: "after" },
    ).lean(),
  );
}

export async function listAddresses(userId?: string): Promise<Address[]> {
  return plainAll<Address>(
    await AddressModel.find(userId ? { userId } : {}).lean(),
  );
}

export async function saveAddress(
  userId: string,
  address: Omit<Address, "userId">,
): Promise<Address[]> {
  const existing = (await AddressModel.findOne({ id: address.id })
    .select("userId")
    .lean()) as { userId?: string } | null;
  if (existing && existing.userId !== userId)
    throw new Error("Address not found.");
  await AddressModel.findOneAndUpdate(
    { id: address.id },
    { $set: { ...address, userId } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" },
  ).lean();
  return listAddresses(userId);
}

export async function removeAddress(
  userId: string,
  id: string,
): Promise<Address[]> {
  const removed = await AddressModel.deleteOne({ id, userId });
  if (!removed.deletedCount) throw new Error("Address not found.");
  return listAddresses(userId);
}

async function setCart(userId: string, items: CartItem[]): Promise<CartItem[]> {
  const normalized = normalizeCart(items, await allProducts());
  await CartModel.findOneAndUpdate(
    { userId },
    { $set: { items: normalized } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" },
  ).lean();
  return normalized;
}

export async function getCart(userId: string): Promise<CartItem[]> {
  const doc = (await CartModel.findOne({ userId }).select("items").lean()) as {
    items?: CartItem[];
  } | null;
  const items = (doc?.items ?? []).map(({ productId, quantity }) => ({ productId, quantity }));
  return normalizeCart(items, await allProducts());
}

export async function addCartItem(
  userId: string,
  productId: string,
  quantity = 1,
): Promise<CartItem[]> {
  const found = (await ProductModel.findOne({
    id: productId,
    status: "active",
  }).lean()) as { stock: number } | null;
  if (!found || found.stock === 0)
    throw new Error("This piece is currently unavailable.");
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error("Choose a valid quantity.");
  const cart = await getCart(userId);
  const inBag = cart.find((item) => item.productId === productId)?.quantity ?? 0;
  if (inBag + quantity > found.stock)
    throw new Error(
      `Only ${found.stock} available. You already have ${inBag} in your bag.`,
    );
  return setCart(userId, [...cart, { productId, quantity }]);
}

export async function updateCartItem(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartItem[]> {
  const cart = await getCart(userId);
  return setCart(
    userId,
    cart.map((item) =>
      item.productId === productId ? { ...item, quantity } : item,
    ),
  );
}

export async function removeCartItem(
  userId: string,
  productId: string,
): Promise<CartItem[]> {
  const cart = await getCart(userId);
  return setCart(
    userId,
    cart.filter((item) => item.productId !== productId),
  );
}

export async function clearCart(userId: string): Promise<CartItem[]> {
  return setCart(userId, []);
}

export async function getWishlist(userId: string): Promise<string[]> {
  const doc = (await CartModel.findOne({ userId })
    .select("wishlist")
    .lean()) as { wishlist?: string[] } | null;
  return doc?.wishlist ? [...doc.wishlist] : [];
}

export async function setWishlist(
  userId: string,
  productIds: string[],
): Promise<string[]> {
  const wishlist = [...new Set(productIds)];
  await CartModel.findOneAndUpdate(
    { userId },
    { $set: { wishlist } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" },
  ).lean();
  return wishlist;
}

export async function listOrders(): Promise<Order[]> {
  return plainAll<Order>(await OrderModel.find().lean());
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  return plainAll<Order>(await OrderModel.find({ userId }).lean());
}

export async function getOrderById(id: string): Promise<Order | null> {
  return plainOne<Order>(await OrderModel.findOne({ id }).lean());
}

export async function listOrdersForCreator(
  creatorId: string,
): Promise<Order[]> {
  const productIds = (
    await ProductModel.find({ creatorId }).select("id").lean()
  ).map((entry) => (entry as unknown as { id: string }).id);
  const orders = await listOrders();
  return orders.flatMap((order) => {
    const items = order.items.filter((item) =>
      productIds.includes(item.productId),
    );
    return items.length
      ? [
          {
            ...order,
            items,
            total: items.reduce(
              (sum, item) => sum + item.quantity * item.unitPrice,
              0,
            ),
          },
        ]
      : [];
  });
}

export async function listPayments(): Promise<Payment[]> {
  return plainAll<Payment>(await PaymentModel.find().lean());
}

const recordDemoPayment: PaymentProvider = async ({ orderId, amount }) => {
  const ids = (await PaymentModel.find().select("id").lean()).map(
    (entry) => (entry as unknown as { id: string }).id,
  );
  return {
    id: nextSequentialId(ids, "PAY", 3),
    orderId,
    amount,
    method: "UPI (sample)",
    status: "Recorded demo",
  };
};

let checkoutQueue = Promise.resolve();

export async function createCheckout(
  input: CheckoutInput,
  paymentProvider: PaymentProvider = recordDemoPayment,
): Promise<Order> {
  const run = checkoutQueue.then(() => performCheckout(input, paymentProvider));
  checkoutQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function performCheckout(
  input: CheckoutInput,
  paymentProvider: PaymentProvider,
): Promise<Order> {
  if (!input.items.length) throw new Error("Your bag is empty.");
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1)
      throw new Error("Choose a valid quantity.");
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity,
    );
  }
  const catalogue = plainAll<Product>(
    await ProductModel.find({
      id: { $in: [...quantities.keys()] },
      status: "active",
    }).lean(),
  );
  const lines: Order["items"] = [...quantities].flatMap(
    ([productId, quantity]) => {
      const product = catalogue.find((entry) => entry.id === productId);
      if (!product) return [];
      if (quantity > product.stock)
        throw new Error(`Only ${product.stock} of ${product.name} remain.`);
      return [
        {
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice: product.price,
        },
      ];
    },
  );
  if (!lines.length)
    throw new Error("None of these pieces are available any more.");

  const subtotal = lines.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const total = subtotal + checkoutShipping(subtotal, lines);
  const orderIds = (await OrderModel.find().select("id").lean()).map(
    (entry) => (entry as unknown as { id: string }).id,
  );
  const order: Order = {
    id: nextSequentialId(orderIds, "ELS", 4),
    userId: input.userId,
    date: new Date().toISOString().slice(0, 10),
    items: lines,
    total,
    status: "Processing",
  };
  const payment = await paymentProvider({ orderId: order.id, amount: total });

  const reserved: Order["items"] = [];
  const previousCart = await getCart(input.userId);
  let clearingCart = false;
  const orderDoc = new OrderModel(order);
  const paymentDoc = new PaymentModel(payment);
  const persist = async (session?: ClientSession) => {
    reserved.length = 0;
    for (const line of lines) {
      const result = await ProductModel.updateOne(
        { id: line.productId, status: "active", stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } },
        { session },
      );
      if (!result.matchedCount)
        throw new Error(`Stock changed for ${line.name}. Please check your bag.`);
      reserved.push(line);
    }
    await OrderModel.create([orderDoc], { session });
    await PaymentModel.create([paymentDoc], { session });
    clearingCart = true;
    await CartModel.updateOne(
      { userId: input.userId },
      { $set: { items: [] } },
      { session },
    );
  };
  if (await supportsTransactions()) {
    await mongoose.connection.transaction(persist);
  } else {
    try {
      await persist();
    } catch (error) {
      const rollback = await Promise.allSettled([
        OrderModel.deleteOne({ _id: orderDoc._id }),
        PaymentModel.deleteOne({ _id: paymentDoc._id }),
        ...(clearingCart ? [CartModel.updateOne(
          { userId: input.userId, items: { $size: 0 } },
          { $set: { items: previousCart } },
        )] : []),
        ...reserved.map((line) => ProductModel.updateOne(
          { id: line.productId },
          { $inc: { stock: line.quantity } },
        )),
      ]);
      if (rollback.some((result) => result.status === "rejected"))
        throw new AggregateError([error, ...rollback.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        )], "Checkout failed and rollback was incomplete. Manual reconciliation is required.");
      throw error;
    }
  }
  return order;
}

export async function getAdminSummary(): Promise<{
  products: number;
  creators: number;
  orders: number;
  pending: number;
  lowStock: number;
}> {
  const [productCounts, creatorCounts, orderCounts, pendingCounts] = await Promise.all([
    ProductModel.aggregate([{
      $facet: {
        products: [{ $count: "count" }],
        lowStock: [{ $match: { stock: { $lt: 4 } } }, { $count: "count" }],
      },
    }]),
    CreatorModel.aggregate([{ $count: "count" }]),
    OrderModel.aggregate([{ $count: "count" }]),
    CollaborationModel.aggregate([{ $match: { status: "pending" } }, { $count: "count" }]),
  ]);
  return {
    products: productCounts[0]?.products[0]?.count ?? 0,
    creators: creatorCounts[0]?.count ?? 0,
    orders: orderCounts[0]?.count ?? 0,
    pending: pendingCounts[0]?.count ?? 0,
    lowStock: productCounts[0]?.lowStock[0]?.count ?? 0,
  };
}

export async function getAdminAnalytics(): Promise<{
  revenueByCreator: { creatorId: string; creatorName: string; revenue: number }[];
  lowStock: Product[];
  pendingCollaborations: Collaboration[];
}> {
  const [revenueByCreator, lowStock, pendingCollaborations] = await Promise.all([
    OrderModel.aggregate<{ creatorId: string; creatorName: string; revenue: number }>([
      { $unwind: "$items" },
      { $lookup: {
        from: ProductModel.collection.name,
        localField: "items.productId",
        foreignField: "id",
        as: "product",
      } },
      { $unwind: "$product" },
      { $group: {
        _id: "$product.creatorId",
        revenue: { $sum: { $multiply: ["$items.quantity", "$items.unitPrice"] } },
      } },
      { $lookup: {
        from: CreatorModel.collection.name,
        localField: "_id",
        foreignField: "id",
        as: "creator",
      } },
      { $unwind: "$creator" },
      { $project: { _id: 0, creatorId: "$_id", creatorName: "$creator.name", revenue: 1 } },
      { $sort: { creatorId: 1 } },
    ]),
    ProductModel.aggregate<Product>([
      { $match: { stock: { $lt: 4 } } },
      { $sort: { id: 1 } },
      { $project: { _id: 0, __v: 0 } },
    ]),
    CollaborationModel.aggregate<Collaboration>([
      { $match: { status: "pending" } },
      { $sort: { id: 1 } },
      { $project: { _id: 0, __v: 0, userId: 0 } },
    ]),
  ]);
  return { revenueByCreator, lowStock, pendingCollaborations };
}
