import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

const addressSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    line: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    phone: { type: String, required: true },
  },
  baseSchemaOptions,
);

addressSchema.index({ userId: 1 });

export type AddressShape = InferSchemaType<typeof addressSchema>;
export const Address = model("Address", addressSchema);
