import { InferSchemaType, Model, Schema, model, models } from "mongoose";
import { APPROVER_ROLES, EVENT_STATUSES } from "@/models/enums";

const statusesRequiringVenue = [
  "PENDING_ADVISER",
  "PENDING_DEAN",
  "PENDING_FACILITIES",
  "PENDING_OSA",
  "APPROVED",
] as const;

function statusRequiresVenue(status?: string): boolean {
  return Boolean(status && statusesRequiringVenue.includes(status as (typeof statusesRequiringVenue)[number]));
}

const eventSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: false,
      validate: {
        validator: function (this: { status?: string }, value?: unknown) {
          if (!statusRequiresVenue(this.status)) {
            return true;
          }

          return Boolean(value);
        },
        message: "venueId is required before submission and approval stages",
      },
    },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      required: true,
      default: "DRAFT",
      index: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: { startAt?: Date }, value: Date) {
          if (!this.startAt || !value) {
            return true;
          }

          return value > this.startAt;
        },
        message: "endAt must be after startAt",
      },
    },
    budget: {
      type: Schema.Types.Decimal128,
      required: true,
      validate: {
        validator: (value: unknown) => Number.parseFloat(String(value)) >= 0,
        message: "budget must be non-negative",
      },
    },
    expectedAttendees: {
      type: Number,
      required: true,
      min: 1,
    },
    submittedAt: {
      type: Date,
      required: false,
    },
    currentApproverRole: {
      type: String,
      enum: APPROVER_ROLES,
      required: false,
      index: true,
    },
    lastActionBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    revisionNotes: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

eventSchema.index({ status: 1, organizerId: 1 });
eventSchema.index({ venueId: 1, startAt: 1, endAt: 1 });
eventSchema.index({ currentApproverRole: 1, status: 1 });
eventSchema.index({ updatedAt: -1 });

export type EventDocument = InferSchemaType<typeof eventSchema>;

export const Event: Model<EventDocument> =
  (models.Event as Model<EventDocument>) || model<EventDocument>("Event", eventSchema);
