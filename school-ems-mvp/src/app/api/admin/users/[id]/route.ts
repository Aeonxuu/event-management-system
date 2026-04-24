import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, parseObjectId, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { USER_ROLES } from "@/models/enums";
import { User } from "@/models/user.model";
import { Organization } from "@/models/organization.model";

type Params = {
  params: Promise<{ id: string }>;
};

const patchUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(USER_ROLES).optional(),
  organizationId: z.union([z.string().regex(/^[0-9a-fA-F]{24}$/), z.null()]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const { id } = await context.params;
    const userId = parseObjectId(id, "user id");
    const payload = patchUserSchema.parse(await request.json());

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    const nextRole = payload.role ?? user.role;
    let nextOrganizationId: string | undefined;

    if (nextRole === "STUDENT_LEADER") {
      const candidateOrg = payload.organizationId === null ? undefined : payload.organizationId ?? String(user.organizationId ?? "");
      if (!candidateOrg) {
        throw Object.assign(new Error("Organization is required for student leaders"), {
          statusCode: 400,
          code: "VALIDATION_ERROR",
        });
      }

      const organization = await Organization.findById(candidateOrg).select("_id").lean();
      if (!organization) {
        throw Object.assign(new Error("Organization not found"), {
          statusCode: 404,
          code: "NOT_FOUND",
        });
      }

      nextOrganizationId = candidateOrg;
    }

    if (payload.name !== undefined) user.name = payload.name;
    if (payload.email !== undefined) user.email = payload.email.toLowerCase();
    if (payload.role !== undefined) user.role = payload.role;
    if (payload.isActive !== undefined) user.isActive = payload.isActive;

    if (nextRole === "STUDENT_LEADER") {
      user.organizationId = nextOrganizationId;
    } else {
      user.organizationId = undefined;
    }

    await user.save();

    const updated = await User.findById(user._id)
      .select("_id name email role organizationId isActive createdAt updatedAt")
      .populate({ path: "organizationId", select: "name code" })
      .lean();

    return jsonSuccess({ data: updated });
  });
}
