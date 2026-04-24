import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { Organization } from "@/models/organization.model";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(32),
  description: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    await connectToDatabase();

    const organizations = await Organization.find({})
      .select("_id name code description createdAt updatedAt")
      .sort({ name: 1 })
      .lean();

    return jsonSuccess({ data: organizations });
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const payload = organizationSchema.parse(await request.json());

    await connectToDatabase();

    const organization = await Organization.create({
      name: payload.name,
      code: payload.code.toUpperCase(),
      description: payload.description ?? "",
    });

    return jsonSuccess({ data: organization.toObject() }, 201);
  });
}
