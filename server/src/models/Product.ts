import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

export const PRODUCT_STATUSES = ["active", "draft"] as const;

const productSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    creatorId: { type: String, required: true },
    categoryId: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    images: { type: [String], default: [] },
    description: { type: String, required: true },
    material: { type: String, required: true },
    dimensions: { type: String, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: PRODUCT_STATUSES, default: "active" },
    featured: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

productSchema.index({ categoryId: 1 });
productSchema.index({ creatorId: 1 });
productSchema.index({ status: 1 });
productSchema.index({ name: "text", description: "text", material: "text" });

export type ProductShape = InferSchemaType<typeof productSchema>;
export const Product = model("Product", productSchema);
