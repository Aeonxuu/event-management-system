import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Venue } from "@/models/venue.model";
import { venueCreateSchema } from "@/lib/validators/venue";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    requireAuth(request);

    await connectToDatabase();

    const venues = await Venue.find({})
      .select("_id name location capacity isActive notes createdAt updatedAt")
      .sort({ name: 1 })
      .lean();

    return jsonSuccess({ data: venues });
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const payload = venueCreateSchema.parse(await request.json());

    await connectToDatabase();

    const venue = await Venue.create(payload);

    return jsonSuccess({ data: venue.toObject() }, 201);
  });
}
