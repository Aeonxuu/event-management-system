import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Event } from "@/models/event.model";
import "@/models/organization.model";
import { serializeEvent } from "@/lib/serializers";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20), 100);
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const [events, total] = await Promise.all([
      Event.find({})
        .select(
          "_id title description organizerId organizationId venueId status startAt endAt budget expectedAttendees submittedAt currentApproverRole updatedAt createdAt",
        )
        .populate({ path: "organizerId", select: "name email role" })
        .populate({ path: "organizationId", select: "name code" })
        .populate({ path: "venueId", select: "name location" })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Event.countDocuments({}),
    ]);

    const serializedEvents = Array.isArray(events) ? events.map((event) => serializeEvent(event)) : [];

    return jsonSuccess({
      data: serializedEvents,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  });
}
