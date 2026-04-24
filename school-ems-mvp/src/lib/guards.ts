import { NextRequest } from "next/server";
import { getTokenFromRequest, verifyAuthToken, type AuthUser } from "@/lib/auth";
import { APPROVER_ROLES, type ApproverRole, type EventStatus, type UserRole } from "@/models/enums";

const nextApproverByStatus: Partial<Record<EventStatus, UserRole>> = {
  PENDING_ADVISER: "ADVISER",
  PENDING_DEAN: "DEAN",
  PENDING_FACILITIES: "FACILITIES",
  PENDING_OSA: "OSA",
};

export function requireAuth(request: NextRequest): AuthUser {
  const token = getTokenFromRequest(request);
  if (!token) {
    throw Object.assign(new Error("Unauthorized"), {
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }

  return verifyAuthToken(token);
}

export function requireRole(userRole: UserRole, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(userRole)) {
    throw Object.assign(new Error("Forbidden"), {
      statusCode: 403,
      code: "FORBIDDEN_ROLE",
    });
  }
}

export function assertCanAct(userRole: UserRole, eventStatus: EventStatus): void {
  const requiredRole = nextApproverByStatus[eventStatus];
  if (!requiredRole || requiredRole !== userRole) {
    throw Object.assign(new Error("Forbidden workflow action"), {
      statusCode: 403,
      code: "FORBIDDEN_ROLE",
    });
  }
}

export function canRequestRevision(userRole: UserRole, eventStatus: EventStatus): boolean {
  const requiredRole = nextApproverByStatus[eventStatus];
  if (!requiredRole) {
    return false;
  }

  const requiredRoleIndex = APPROVER_ROLES.indexOf(requiredRole as ApproverRole);
  const userRoleIndex = APPROVER_ROLES.indexOf(userRole as ApproverRole);

  return userRoleIndex >= requiredRoleIndex;
}

