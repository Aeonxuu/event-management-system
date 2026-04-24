import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Event } from "@/models/event.model";
import { WORKFLOW_STATUS_SEQUENCE } from "@/lib/workflow";
import { serializeEvent } from "@/lib/serializers";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADVISER", "DEAN", "FACILITIES", "OSA"]);

    await connectToDatabase();

    const expectedStatus = WORKFLOW_STATUS_SEQUENCE[authUser.role as keyof typeof WORKFLOW_STATUS_SEQUENCE];

    const queue = await Event.find({
      currentApproverRole: authUser.role,
      status: expectedStatus,
    })
      .select(
        "_id title organizerId venueId status startAt endAt budget expectedAttendees submittedAt updatedAt",
      )
      .populate({ path: "organizerId", select: "name email organizationId" })
      .populate({ path: "venueId", select: "name location" })
      .sort({ submittedAt: 1, updatedAt: 1 })
      .lean();

    return jsonSuccess({ data: queue.map((event) => serializeEvent(event)) });
  });
}
