import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, parseObjectId, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { User } from "@/models/user.model";

type Params = {
  params: Promise<{ id: string }>;
};

const passwordPatchSchema = z
  .object({
    newPassword: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function PATCH(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const { id } = await context.params;
    const userId = parseObjectId(id, "user id");
    const payload = passwordPatchSchema.parse(await request.json());

    await connectToDatabase();

    const user = await User.findById(userId).select("_id");
    if (!user) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);

    await User.findByIdAndUpdate(userId, { passwordHash });

    return jsonSuccess({ data: { ok: true } });
  });
}
