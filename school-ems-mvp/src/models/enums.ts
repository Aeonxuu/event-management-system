export const USER_ROLES = [
  "STUDENT_LEADER",
  "ADVISER",
  "DEAN",
  "FACILITIES",
  "OSA",
  "ADMIN",
] as const;

export const EVENT_STATUSES = [
  "DRAFT",
  "PENDING_ADVISER",
  "PENDING_DEAN",
  "PENDING_FACILITIES",
  "PENDING_OSA",
  "APPROVED",
  "REVISION_REQUIRED",
] as const;

export const APPROVER_ROLES = ["ADVISER", "DEAN", "FACILITIES", "OSA"] as const;

export const AUDIT_ACTIONS = [
  "SUBMIT",
  "APPROVE",
  "REQUEST_REVISION",
  "CREATE",
  "UPDATE",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type ApproverRole = (typeof APPROVER_ROLES)[number];
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
