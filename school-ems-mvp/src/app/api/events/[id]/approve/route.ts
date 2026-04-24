import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, parseObjectId, withApiHandler } from "@/lib/api";
import { assertCanAct, requireAuth, requireRole } from "@/lib/guards";
import { Event } from "@/models/event.model";
import {
  NEXT_APPROVER_MAP,
  NEXT_STATUS_MAP,
  appendAuditLog,
  ensureVenueAvailability,
} from "@/lib/workflow";
import { serializeEvent } from "@/lib/serializers";
import { Types } from "mongoose";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADVISER", "DEAN", "FACILITIES", "OSA"]);

    const { id } = await context.params;
    const eventId = parseObjectId(id, "event id");

    await connectToDatabase();

    const event = await Event.findById(eventId);

    if (!event) {
      throw Object.assign(new Error("Event not found"), {
        statusCode: 404,
        code: "EVENT_NOT_FOUND",
      });
    }

    assertCanAct(authUser.role, event.status);

    const toStatus = NEXT_STATUS_MAP[event.status];
    if (!toStatus) {
      throw Object.assign(new Error("Invalid event status"), {
        statusCode: 409,
        code: "INVALID_STATE",
      });
    }

    if (!event.venueId) {
      throw Object.assign(new Error("venueId is required before approval"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    await ensureVenueAvailability({
      venueId: event.venueId as Types.ObjectId,
      startAt: event.startAt,
      endAt: event.endAt,
      excludeEventId: event._id as Types.ObjectId,
    });

    const fromStatus = event.status;

    event.status = toStatus;
    event.currentApproverRole = NEXT_APPROVER_MAP[fromStatus];
    event.lastActionBy = new Types.ObjectId(authUser.sub);

    await event.save();

    await appendAuditLog({
      eventId: event._id as Types.ObjectId,
      actorId: new Types.ObjectId(authUser.sub),
      fromStatus,
      toStatus,
      action: "APPROVE",
    });

    const updated = await Event.findById(eventId).lean();

    return jsonSuccess({ data: updated ? serializeEvent(updated) : null });
  });
}
