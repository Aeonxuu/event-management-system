import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, parseObjectId, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Organization } from "@/models/organization.model";
import { User } from "@/models/user.model";
import { Event } from "@/models/event.model";

type Params = {
  params: Promise<{ id: string }>;
};

const patchOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  code: z.string().trim().min(2).max(32).optional(),
  description: z.string().trim().max(500).optional(),
});

export async function PATCH(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const { id } = await context.params;
    const organizationId = parseObjectId(id, "organization id");
    const payload = patchOrganizationSchema.parse(await request.json());

    await connectToDatabase();

    const update: Record<string, unknown> = {};
    if (payload.name !== undefined) update.name = payload.name;
    if (payload.code !== undefined) update.code = payload.code.toUpperCase();
    if (payload.description !== undefined) update.description = payload.description;

    const organization = await Organization.findByIdAndUpdate(organizationId, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!organization) {
      throw Object.assign(new Error("Organization not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    return jsonSuccess({ data: organization });
  });
}

export async function DELETE(request: NextRequest, context: Params) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const { id } = await context.params;
    const organizationId = parseObjectId(id, "organization id");

    await connectToDatabase();

    const [hasUsers, hasEvents] = await Promise.all([
      User.findOne({ organizationId }).select("_id").lean(),
      Event.findOne({ organizationId }).select("_id").lean(),
    ]);

    if (hasUsers || hasEvents) {
      throw Object.assign(new Error("Cannot delete organization that is in use"), {
        statusCode: 409,
        code: "CONFLICT",
      });
    }

    const deleted = await Organization.findByIdAndDelete(organizationId).lean();
    if (!deleted) {
      throw Object.assign(new Error("Organization not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    return jsonSuccess({ data: deleted });
  });
}
