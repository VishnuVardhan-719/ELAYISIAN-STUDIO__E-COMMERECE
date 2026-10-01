import type { SchemaOptions } from "mongoose";

/**
 * Shared schema options. Every document keeps the application's own string `id`
 * (e.g. "sunset-vase") so the API returns the exact shapes the frontend already
 * expects; Mongo's `_id` and `__v` are stripped on serialisation.
 */
export const baseSchemaOptions: SchemaOptions = {
  versionKey: false,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      return ret;
    },
  },
};
