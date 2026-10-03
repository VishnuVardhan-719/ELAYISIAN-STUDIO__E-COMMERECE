import { Schema, model, type InferSchemaType } from "mongoose";
import { baseSchemaOptions } from "./helpers";

export const COLLABORATION_STATUSES = ["pending", "approved", "declined"] as const;

const collaborationSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, select: false },
    creatorName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    categoryId: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: COLLABORATION_STATUSES,
      default: "pending",
    },
    date: { type: String, required: true },
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.userId;
        return ret;
      },
    },
  },
);

collaborationSchema.index({ status: 1 });
collaborationSchema.index({ email: 1 });
collaborationSchema.index({ userId: 1 });

export type CollaborationShape = InferSchemaType<typeof collaborationSchema>;
export const Collaboration = model("Collaboration", collaborationSchema);
