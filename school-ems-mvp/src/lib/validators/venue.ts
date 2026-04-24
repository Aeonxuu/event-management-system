import { z } from "zod";

export const venueCreateSchema = z.object({
  name: z.string().min(2).max(120),
  location: z.string().min(2).max(200),
  capacity: z.coerce.number().int().min(1),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const venuePatchSchema = venueCreateSchema.partial();

export const requestRevisionSchema = z.object({
  notes: z.string().max(2000).optional(),
});
