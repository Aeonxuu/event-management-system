export type UserRole =
  | "STUDENT_LEADER"
  | "ADVISER"
  | "DEAN"
  | "FACILITIES"
  | "OSA"
  | "ADMIN";

export type EventStatus =
  | "DRAFT"
  | "PENDING_ADVISER"
  | "PENDING_DEAN"
  | "PENDING_FACILITIES"
  | "PENDING_OSA"
  | "APPROVED"
  | "REVISION_REQUIRED";

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  isActive?: boolean;
};

export type Venue = {
  _id: string;
  name: string;
  location: string;
  capacity: number;
  isActive: boolean;
  notes?: string;
};

export type Organization = {
  _id: string;
  name: string;
  code: string;
  description?: string;
};

export type AdminUserRecord = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: Organization | string;
  isActive: boolean;
};

export type EventRecord = {
  _id: string;
  title: string;
  description: string;
  status: EventStatus;
  startAt: string;
  endAt: string;
  budget: number;
  expectedAttendees: number;
  submittedAt?: string;
  currentApproverRole?: UserRole;
  revisionNotes?: string;
  venueId?: Venue | string;
  organizationId?: Organization | string;
  organizerId?: { _id: string; name: string; email: string; role: UserRole } | string;
};

export type AuditLogRecord = {
  _id: string;
  action: "SUBMIT" | "APPROVE" | "REQUEST_REVISION" | "CREATE" | "UPDATE";
  fromStatus: EventStatus;
  toStatus: EventStatus;
  notes?: string;
  timestamp: string;
  actorId?: { name: string; email: string; role: UserRole } | string;
};
