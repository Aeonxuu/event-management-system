import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Organization } from "@/models/organization.model";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["STUDENT_LEADER", "ADVISER", "DEAN", "ADMIN"]);

    await connectToDatabase();

    const organizations = await Organization.find({})
      .select("_id name code description")
      .sort({ name: 1 })
      .lean();

    return jsonSuccess({ data: organizations });
  });
}
