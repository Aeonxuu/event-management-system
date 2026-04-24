import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, parseObjectId, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Event } from "@/models/event.model";
import { appendAuditLog, ensureVenueAvailability } from "@/lib/workflow";
import { serializeEvent } from "@/lib/serializers";
import { Types } from "mongoose";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["STUDENT_LEADER", "ADVISER", "DEAN"]);

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

    if (String(event.organizerId) !== authUser.sub) {
      throw Object.assign(new Error("Forbidden"), {
        statusCode: 403,
        code: "FORBIDDEN_ROLE",
      });
    }

    if (! ["DRAFT", "REVISION_REQUIRED"].includes(event.status)) {
      throw Object.assign(new Error("Invalid event status"), {
        statusCode: 409,
        code: "INVALID_STATE",
      });
    }

    if (!event.venueId) {
      throw Object.assign(new Error("venueId is required before submission"), {
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

    if (authUser.role === "DEAN") {
      event.status = "PENDING_FACILITIES";
      event.currentApproverRole = "FACILITIES";
    } else if (authUser.role === "ADVISER") {
      event.status = "PENDING_DEAN";
      event.currentApproverRole = "DEAN";
    } else {
      event.status = "PENDING_ADVISER";
      event.currentApproverRole = "ADVISER";
    }

    event.submittedAt = new Date();
    event.lastActionBy = new Types.ObjectId(authUser.sub);

    await event.save();

    await appendAuditLog({
      eventId: event._id as Types.ObjectId,
      actorId: new Types.ObjectId(authUser.sub),
      fromStatus,
      toStatus: event.status,
      action: "SUBMIT",
    });

    const updated = await Event.findById(eventId).lean();

    return jsonSuccess({ data: updated ? serializeEvent(updated) : null }, 200);
  });
}
