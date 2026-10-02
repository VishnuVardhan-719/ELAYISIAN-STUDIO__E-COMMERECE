import { Schema, model } from "mongoose";
import type { Address, OrderItem } from "../../../frontend/src/types/domain";
import { baseSchemaOptions } from "./helpers";

export interface PaymentAttemptShape {
  id: string;
  userId: string;
  orderId: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  checkoutKey?: string;
  amount: number;
  currency: "INR";
  items: OrderItem[];
  address: Omit<Address, "id" | "userId">;
  status: "pending" | "completed" | "reconciliation_required";
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

const addressSchema = new Schema({
  name: { type: String, required: true },
  line: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  phone: { type: String, required: true },
}, { _id: false });

const schema = new Schema<PaymentAttemptShape>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  orderId: { type: String, required: true, unique: true },
  gatewayOrderId: { type: String, unique: true, sparse: true },
  gatewayPaymentId: { type: String, unique: true, sparse: true },
  checkoutKey: { type: String },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  currency: { type: String, enum: ["INR"], default: "INR" },
  items: { type: [itemSchema], required: true },
  address: { type: addressSchema, required: true },
  status: { type: String, enum: ["pending", "completed", "reconciliation_required"], default: "pending" },
}, { ...baseSchemaOptions, timestamps: true });

schema.index({ checkoutKey: 1 }, { unique: true, partialFilterExpression: { checkoutKey: { $type: "string" } } });

export const PaymentAttempt = model("PaymentAttempt", schema);