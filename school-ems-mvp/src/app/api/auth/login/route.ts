import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { handleApiError, withApiHandler } from "@/lib/api";
import { setAuthCookie, signAuthToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validators/auth";
import { User } from "@/models/user.model";

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const payload = loginSchema.parse(await request.json());

    await connectToDatabase();

    const user = await User.findOne({ email: payload.email.toLowerCase() })
      .select("_id name email role organizationId isActive passwordHash")
      .lean();

    if (!user || !user.passwordHash) {
      throw Object.assign(new Error("Invalid credentials"), {
        statusCode: 403,
        code: "FORBIDDEN",
      });
    }

    if (!user.isActive) {
      throw Object.assign(new Error("User account is inactive"), {
        statusCode: 403,
        code: "FORBIDDEN",
      });
    }

    const isValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isValid) {
      throw Object.assign(new Error("Invalid credentials"), {
        statusCode: 403,
        code: "FORBIDDEN",
      });
    }

    const token = signAuthToken({
      sub: String(user._id),
      role: user.role,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId ? String(user.organizationId) : undefined,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        },
      },
      { status: 200 },
    );

    return setAuthCookie(response, token);
  }).catch((error) => handleApiError(error));
}
