import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Event } from "@/models/event.model";
import { Organization } from "@/models/organization.model";
import { eventCreateSchema } from "@/lib/validators/event";
import { appendAuditLog } from "@/lib/workflow";
import { serializeEvent } from "@/lib/serializers";
import { Types } from "mongoose";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);

    await connectToDatabase();

    const query = authUser.role === "ADMIN" ? {} : { organizerId: authUser.sub };

    const events = await Event.find(query)
      .select(
        "_id title description organizationId venueId status startAt endAt budget expectedAttendees submittedAt currentApproverRole updatedAt createdAt",
      )
      .populate({ path: "organizationId", select: "name code" })
      .populate({ path: "venueId", select: "name location" })
      .sort({ updatedAt: -1 })
      .lean();

    return jsonSuccess({ data: events.map((event) => serializeEvent(event)) });
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["STUDENT_LEADER", "ADVISER", "DEAN"]);

    const body = await request.json();
    const payload = eventCreateSchema.parse(body);

    const selectedOrganizationId =
      authUser.role === "STUDENT_LEADER"
        ? authUser.organizationId
        : payload.organizationId ?? authUser.organizationId;

    if (!selectedOrganizationId) {
      throw Object.assign(new Error("Organization is required"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    await connectToDatabase();

    const organization = await Organization.findById(selectedOrganizationId).select("_id").lean();
    if (!organization) {
      throw Object.assign(new Error("Organization not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    const event = await Event.create({
      ...payload,
      budget: Types.Decimal128.fromString(String(payload.budget)),
      organizerId: new Types.ObjectId(authUser.sub),
      organizationId: new Types.ObjectId(selectedOrganizationId),
      status: "DRAFT",
      currentApproverRole: undefined,
      submittedAt: undefined,
    });

    await appendAuditLog({
      eventId: event._id as Types.ObjectId,
      actorId: new Types.ObjectId(authUser.sub),
      fromStatus: "DRAFT",
      toStatus: "DRAFT",
      action: "CREATE",
    });

    const created = await Event.findById(event._id).lean();

    return jsonSuccess({ data: created ? serializeEvent(created) : null }, 201);
  });
}

