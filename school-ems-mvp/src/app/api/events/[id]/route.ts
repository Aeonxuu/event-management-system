import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, parseObjectId, withApiHandler } from "@/lib/api";
import { requireAuth } from "@/lib/guards";
import { Event } from "@/models/event.model";
import { Organization } from "@/models/organization.model";
import { eventPatchSchema } from "@/lib/validators/event";
import { appendAuditLog } from "@/lib/workflow";
import { serializeEvent } from "@/lib/serializers";
import { AuditLog } from "@/models/audit-log.model";
import { Types } from "mongoose";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    const { id } = await context.params;
    const eventId = parseObjectId(id, "event id");

    await connectToDatabase();

    const event = await Event.findById(eventId)
      .populate({ path: "organizerId", select: "name email role" })
      .populate({ path: "organizationId", select: "name code" })
      .populate({ path: "venueId", select: "name location capacity" })
      .lean();

    if (!event) {
      throw Object.assign(new Error("Event not found"), {
        statusCode: 404,
        code: "EVENT_NOT_FOUND",
      });
    }

    const isOwner = String(event.organizerId?._id ?? event.organizerId) === authUser.sub;
    const isApprover = ["ADVISER", "DEAN", "FACILITIES", "OSA"].includes(authUser.role);
    const canRead = authUser.role === "ADMIN" || isOwner || isApprover;

    if (!canRead) {
      throw Object.assign(new Error("Forbidden"), {
        statusCode: 403,
        code: "FORBIDDEN_ROLE",
      });
    }

    const audit = await AuditLog.find({ eventId })
      .sort({ timestamp: -1 })
      .populate({ path: "actorId", select: "name role email" })
      .lean();

    return jsonSuccess({
      data: {
        event: serializeEvent(event),
        audit,
      },
    });
  });
}

export async function PATCH(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    const { id } = await context.params;
    const eventId = parseObjectId(id, "event id");

    const payload = eventPatchSchema.parse(await request.json());

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

    if (!["DRAFT", "REVISION_REQUIRED"].includes(event.status)) {
      throw Object.assign(new Error("Event cannot be edited in its current status"), {
        statusCode: 403,
        code: "INVALID_STATE",
      });
    }

    const fromStatus = event.status;

    if (payload.title !== undefined) event.title = payload.title;
    if (payload.description !== undefined) event.description = payload.description;
    if (payload.startAt !== undefined) event.startAt = payload.startAt;
    if (payload.endAt !== undefined) event.endAt = payload.endAt;
    if (payload.organizationId !== undefined) {
      const resolvedOrganizationId =
        authUser.role === "STUDENT_LEADER" ? authUser.organizationId : payload.organizationId;

      if (!resolvedOrganizationId) {
        throw Object.assign(new Error("Organization is required"), {
          statusCode: 400,
          code: "VALIDATION_ERROR",
        });
      }

      const organization = await Organization.findById(resolvedOrganizationId).select("_id").lean();
      if (!organization) {
        throw Object.assign(new Error("Organization not found"), {
          statusCode: 404,
          code: "NOT_FOUND",
        });
      }

      event.organizationId = new Types.ObjectId(resolvedOrganizationId);
    }
    if (payload.venueId !== undefined) event.venueId = new Types.ObjectId(payload.venueId);
    if (payload.expectedAttendees !== undefined) event.expectedAttendees = payload.expectedAttendees;
    if (payload.budget !== undefined) {
      event.budget = Types.Decimal128.fromString(String(payload.budget));
    }

    event.lastActionBy = new Types.ObjectId(authUser.sub);

    await event.save();

    const updatedEventId = event._id as Types.ObjectId;

    await appendAuditLog({
      eventId: event._id as Types.ObjectId,
      actorId: new Types.ObjectId(authUser.sub),
      fromStatus,
      toStatus: event.status,
      action: "UPDATE",
    });

    const updated = await Event.findById(updatedEventId).lean();

    return jsonSuccess({ data: updated ? serializeEvent(updated) : null });
  });
}
