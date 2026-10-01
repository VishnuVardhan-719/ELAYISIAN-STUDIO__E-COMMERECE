import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

const categorySchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
  },
  baseSchemaOptions,
);

export type CategoryShape = InferSchemaType<typeof categorySchema>;
export const Category = model("Category", categorySchema);
