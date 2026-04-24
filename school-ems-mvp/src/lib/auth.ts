import { NextRequest, NextResponse } from "next/server";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/lib/env";
import { USER_ROLES, type UserRole } from "@/models/enums";

export type AuthUser = {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  organizationId?: string;
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function signAuthToken(payload: AuthUser): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyAuthToken(token: string): AuthUser {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!decoded || typeof decoded !== "object") {
      throw new Error("Invalid token payload");
    }

    const role = decoded.role as UserRole;
    if (!USER_ROLES.includes(role)) {
      throw new Error("Invalid token role");
    }

    return {
      sub: String(decoded.sub),
      role,
      email: String(decoded.email),
      name: String(decoded.name),
      organizationId: decoded.organizationId ? String(decoded.organizationId) : undefined,
    };
  } catch {
    throw Object.assign(new Error("Unauthorized"), {
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }
}

export function getTokenFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(env.AUTH_COOKIE_NAME)?.value;
}

export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(env.AUTH_COOKIE_NAME, token, cookieOptions);
  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(env.AUTH_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
