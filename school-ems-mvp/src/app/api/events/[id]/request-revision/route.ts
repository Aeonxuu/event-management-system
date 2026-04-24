import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, parseObjectId, withApiHandler } from "@/lib/api";
import { canRequestRevision, requireAuth, requireRole } from "@/lib/guards";
import { Event } from "@/models/event.model";
import { appendAuditLog } from "@/lib/workflow";
import { requestRevisionSchema } from "@/lib/validators/venue";
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
    const payload = requestRevisionSchema.parse(await request.json());

    await connectToDatabase();

    const event = await Event.findById(eventId);

    if (!event) {
      throw Object.assign(new Error("Event not found"), {
        statusCode: 404,
        code: "EVENT_NOT_FOUND",
      });
    }

    if (!canRequestRevision(authUser.role, event.status)) {
      throw Object.assign(new Error("Forbidden workflow action"), {
        statusCode: 403,
        code: "FORBIDDEN_ROLE",
      });
    }

    const fromStatus = event.status;
    event.status = "REVISION_REQUIRED";
    event.currentApproverRole = undefined;
    event.revisionNotes = payload.notes;
    event.lastActionBy = new Types.ObjectId(authUser.sub);

    await event.save();

    await appendAuditLog({
      eventId: event._id as Types.ObjectId,
      actorId: new Types.ObjectId(authUser.sub),
      fromStatus,
      toStatus: event.status,
      action: "REQUEST_REVISION",
      notes: payload.notes,
    });

    const updated = await Event.findById(eventId).lean();

    return jsonSuccess({ data: updated ? serializeEvent(updated) : null });
  });
}
