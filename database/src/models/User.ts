import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

export const USER_ROLES = ["customer", "creator", "admin"] as const;

const preferencesSchema = new Schema({
  makersAndCollections: { type: Boolean, default: true },
  studioStories: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "customer" },
    creatorId: { type: String },
    preferences: { type: preferencesSchema, select: false },
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.passwordHash;
        delete ret.preferences;
        return ret;
      },
    },
  },
);

export type UserShape = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
