import { hashSync } from "bcryptjs";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import {
  addresses,
  categories,
  collaborations,
  collections,
  creators,
  orders,
  payments,
  products,
  users,
} from "../../frontend/src/data/mock";
import { connectDb } from "./db";
import { Address as AddressModel } from "./models/Address";
import { Cart as CartModel } from "./models/Cart";
import { Category as CategoryModel } from "./models/Category";
import { Collaboration as CollaborationModel } from "./models/Collaboration";
import { Collection as CollectionModel } from "./models/Collection";
import { Creator as CreatorModel } from "./models/Creator";
import { Order as OrderModel } from "./models/Order";
import { Payment as PaymentModel } from "./models/Payment";
import { Product as ProductModel } from "./models/Product";
import { User as UserModel } from "./models/User";

export const DEMO_PASSWORD = "elysian123";

export async function seedDatabase(): Promise<void> {
  const passwordHash = hashSync(DEMO_PASSWORD, 10);
  const seededUsers = users.map((user) => ({ ...user }));
  const creator = seededUsers.find((user) => user.role === "creator");
  if (creator) creator.creatorId = creators[0]?.id;

  await Promise.all([
    AddressModel.deleteMany({}),
    CartModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    CollaborationModel.deleteMany({}),
    CollectionModel.deleteMany({}),
    CreatorModel.deleteMany({}),
    OrderModel.deleteMany({}),
    PaymentModel.deleteMany({}),
    ProductModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);

  await Promise.all([
    CategoryModel.insertMany(categories),
    CollectionModel.insertMany(collections),
    CreatorModel.insertMany(creators),
    ProductModel.insertMany(products),
    CollaborationModel.insertMany(collaborations),
    OrderModel.insertMany(orders),
    PaymentModel.insertMany(payments),
    AddressModel.insertMany(
      addresses.map((address) => ({ ...address, userId: "demo-customer" })),
    ),
    UserModel.insertMany(
      seededUsers.map((user) => ({ ...user, passwordHash })),
    ),
  ]);

  await Promise.all([
    AddressModel.createIndexes(),
    CartModel.createIndexes(),
    CategoryModel.createIndexes(),
    CollaborationModel.createIndexes(),
    CollectionModel.createIndexes(),
    CreatorModel.createIndexes(),
    OrderModel.createIndexes(),
    PaymentModel.createIndexes(),
    ProductModel.createIndexes(),
    UserModel.createIndexes(),
  ]);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  connectDb()
    .then(seedDatabase)
    .then(async () => {
      console.log("[seed] demo catalogue written");
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[seed] failed: ${message}`);
      await mongoose.disconnect();
      process.exit(1);
    });
}
