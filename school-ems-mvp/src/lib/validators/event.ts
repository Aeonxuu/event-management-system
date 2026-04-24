import { z } from "zod";

const eventFieldsSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  organizationId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  venueId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  budget: z.coerce.number().min(0),
  expectedAttendees: z.coerce.number().int().min(1),
});

export const eventCreateSchema = eventFieldsSchema.refine((data) => data.endAt > data.startAt, {
  message: "endAt must be after startAt",
  path: ["endAt"],
});

export const eventPatchSchema = eventFieldsSchema
  .partial()
  .refine(
    (data) => {
      if (!data.startAt || !data.endAt) {
        return true;
      }

      return data.endAt > data.startAt;
    },
    {
      message: "endAt must be after startAt",
      path: ["endAt"],
    },
  );
