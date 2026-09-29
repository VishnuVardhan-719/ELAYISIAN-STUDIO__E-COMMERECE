import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

const creatorSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    studio: { type: String, required: true },
    specialty: { type: String, required: true },
    location: { type: String, required: true },
    bio: { type: String, required: true },
    image: { type: String, required: true },
    cover: { type: String, required: true },
    since: { type: Number, required: true },
  },
  baseSchemaOptions,
);

export type CreatorShape = InferSchemaType<typeof creatorSchema>;
export const Creator = model("Creator", creatorSchema);
