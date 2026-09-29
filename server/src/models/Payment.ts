import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

const paymentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, required: true },
    status: { type: String, required: true, default: "Recorded demo" },
  },
  baseSchemaOptions,
);

paymentSchema.index({ orderId: 1 });

export type PaymentShape = InferSchemaType<typeof paymentSchema>;
export const Payment = model("Payment", paymentSchema);
