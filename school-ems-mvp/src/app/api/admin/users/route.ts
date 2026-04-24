import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { jsonSuccess, withApiHandler } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/guards";
import { USER_ROLES } from "@/models/enums";
import { User } from "@/models/user.model";
import { Organization } from "@/models/organization.model";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  organizationId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  isActive: z.boolean().optional(),
});

const DEFAULT_PASSWORD = "demo123";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    await connectToDatabase();

    const users = await User.find({})
      .select("_id name email role organizationId isActive createdAt updatedAt")
      .populate({ path: "organizationId", select: "name code" })
      .sort({ createdAt: -1 })
      .lean();

    return jsonSuccess({ data: users });
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const authUser = requireAuth(request);
    requireRole(authUser.role, ["ADMIN"]);

    const payload = createUserSchema.parse(await request.json());

    await connectToDatabase();

    let organizationId = payload.organizationId;
    if (payload.role === "STUDENT_LEADER") {
      if (!organizationId) {
        throw Object.assign(new Error("Organization is required for student leaders"), {
          statusCode: 400,
          code: "VALIDATION_ERROR",
        });
      }

      const organization = await Organization.findById(organizationId).select("_id").lean();
      if (!organization) {
        throw Object.assign(new Error("Organization not found"), {
          statusCode: 404,
          code: "NOT_FOUND",
        });
      }
    } else {
      organizationId = undefined;
    }

    const existing = await User.findOne({ email: payload.email.toLowerCase() }).select("_id").lean();
    if (existing) {
      throw Object.assign(new Error("Email is already in use"), {
        statusCode: 409,
        code: "CONFLICT",
      });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

    const created = await User.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      role: payload.role,
      organizationId,
      isActive: payload.isActive ?? true,
      passwordHash,
    });

    const user = await User.findById(created._id)
      .select("_id name email role organizationId isActive createdAt updatedAt")
      .populate({ path: "organizationId", select: "name code" })
      .lean();

    return jsonSuccess({ data: user }, 201);
  });
}
