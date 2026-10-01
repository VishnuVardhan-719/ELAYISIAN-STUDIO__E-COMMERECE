import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

const cartItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    wishlist: { type: [String], default: [] },
  },
  baseSchemaOptions,
);

export type CartShape = InferSchemaType<typeof cartSchema>;
export const Cart = model("Cart", cartSchema);
