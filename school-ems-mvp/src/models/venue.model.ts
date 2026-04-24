import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const venueSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    notes: {
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

venueSchema.index({ name: 1, location: 1 }, { unique: true });

export type VenueDocument = InferSchemaType<typeof venueSchema>;

export const Venue: Model<VenueDocument> =
  (models.Venue as Model<VenueDocument>) || model<VenueDocument>("Venue", venueSchema);
