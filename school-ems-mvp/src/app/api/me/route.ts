import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, withApiHandler } from "@/lib/api";
import { requireAuth } from "@/lib/guards";
import { User } from "@/models/user.model";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const user = requireAuth(request);

    await connectToDatabase();

    const me = await User.findById(user.sub)
      .select("_id name email role organizationId isActive")
      .lean();

    if (!me) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    return jsonSuccess({ data: me });
  });
}
