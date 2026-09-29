import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

export const ORDER_STATUSES = ["Delivered", "In transit", "Processing"] as const;

const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    date: { type: String, required: true },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: "Processing" },
  },
  baseSchemaOptions,
);

orderSchema.index({ userId: 1 });

export type OrderShape = InferSchemaType<typeof orderSchema>;
export const Order = model("Order", orderSchema);
