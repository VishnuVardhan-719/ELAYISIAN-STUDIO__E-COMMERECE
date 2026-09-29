import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

const collectionSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    productIds: { type: [String], default: [] },
  },
  baseSchemaOptions,
);

export type CollectionShape = InferSchemaType<typeof collectionSchema>;
export const Collection = model("Collection", collectionSchema);
