import { InferSchemaType, Model, Schema, model, models } from "mongoose";
import { AUDIT_ACTIONS, EVENT_STATUSES } from "@/models/enums";

const auditLogSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fromStatus: {
      type: String,
      enum: EVENT_STATUSES,
      required: true,
    },
    toStatus: {
      type: String,
      enum: EVENT_STATUSES,
      required: true,
    },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    notes: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    versionKey: false,
  },
);

auditLogSchema.index({ eventId: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>;

export const AuditLog: Model<AuditLogDocument> =
  (models.AuditLog as Model<AuditLogDocument>) || model<AuditLogDocument>("AuditLog", auditLogSchema);
