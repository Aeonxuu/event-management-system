import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, parseObjectId, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Venue } from "@/models/venue.model";
import { venuePatchSchema } from "@/lib/validators/venue";
import { Event } from "@/models/event.model";
import { VENUE_BLOCKING_STATUSES } from "@/lib/workflow";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const { id } = await context.params;
    const venueId = parseObjectId(id, "venue id");
    const payload = venuePatchSchema.parse(await request.json());

    await connectToDatabase();

    const venue = await Venue.findByIdAndUpdate(venueId, payload, {
      new: true,
      runValidators: true,
    }).lean();

    if (!venue) {
      throw Object.assign(new Error("Venue not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    return jsonSuccess({ data: venue });
  });
}

export async function DELETE(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const { id } = await context.params;
    const venueId = parseObjectId(id, "venue id");

    await connectToDatabase();

    const inUse = await Event.findOne({
      venueId,
      status: { $in: VENUE_BLOCKING_STATUSES },
    })
      .select("_id")
      .lean();

    if (inUse) {
      const updated = await Venue.findByIdAndUpdate(
        venueId,
        { isActive: false },
        { new: true, runValidators: true },
      ).lean();

      if (!updated) {
        throw Object.assign(new Error("Venue not found"), {
          statusCode: 404,
          code: "NOT_FOUND",
        });
      }

      return jsonSuccess({ data: updated, mode: "DEACTIVATED" });
    }

    const deleted = await Venue.findByIdAndDelete(venueId).lean();
    if (!deleted) {
      throw Object.assign(new Error("Venue not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    return jsonSuccess({ data: deleted, mode: "DELETED" });
  });
}
