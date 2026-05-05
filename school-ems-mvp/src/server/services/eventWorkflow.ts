import mongoose from "mongoose";
import { AuditLog } from "../../models/audit-log.model";
import { Event } from "../../models/event.model";
import { APPROVER_ROLES, type ApproverRole, type EventStatus } from "../../models/enums";

export const WORKFLOW_STATUS_SEQUENCE: Record<ApproverRole, EventStatus> = {
  ADVISER: "PENDING_ADVISER",
  DEAN: "PENDING_DEAN",
  FACILITIES: "PENDING_FACILITIES",
  OSA: "PENDING_OSA",
};

export const NEXT_STATUS_MAP: Partial<Record<EventStatus, EventStatus>> = {
  PENDING_ADVISER: "PENDING_DEAN",
  PENDING_DEAN: "PENDING_FACILITIES",
  PENDING_FACILITIES: "PENDING_OSA",
  PENDING_OSA: "APPROVED",
};

export const NEXT_APPROVER_MAP: Partial<Record<EventStatus, ApproverRole>> = {
  PENDING_ADVISER: "DEAN",
  PENDING_DEAN: "FACILITIES",
  PENDING_FACILITIES: "OSA",
};

export const VENUE_BLOCKING_STATUSES: EventStatus[] = [
  "PENDING_ADVISER",
  "PENDING_DEAN",
  "PENDING_FACILITIES",
  "PENDING_OSA",
  "APPROVED",
];

export function firstApproverRole(): ApproverRole {
  return APPROVER_ROLES[0];
}

export async function ensureVenueAvailability(args: {
  venueId: mongoose.Types.ObjectId;
  startAt: Date;
  endAt: Date;
  excludeEventId?: mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}): Promise<void> {
  const query = Event.findOne({
    _id: args.excludeEventId ? { $ne: args.excludeEventId } : { $exists: true },
    venueId: args.venueId,
    status: { $in: VENUE_BLOCKING_STATUSES },
    startAt: { $lt: args.endAt },
    endAt: { $gt: args.startAt },
  })
    .session(args.session ?? null)
    .lean();

  const conflict = await query;

  if (conflict) {
    const err: any = new Error("Venue is already booked for this time range");
    err.status = 409;
    err.code = "VENUE_DOUBLE_BOOKED";
    throw err;
  }
}

export async function appendAuditLog(args: {
  session?: mongoose.ClientSession;
  eventId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  fromStatus: EventStatus;
  toStatus: EventStatus;
  action: "SUBMIT" | "APPROVE" | "REQUEST_REVISION" | "CREATE" | "UPDATE";
  notes?: string;
}): Promise<void> {
  await AuditLog.create(
    [
      {
        eventId: args.eventId,
        actorId: args.actorId,
        fromStatus: args.fromStatus,
        toStatus: args.toStatus,
        action: args.action,
        notes: args.notes,
        timestamp: new Date(),
      },
    ],
    { session: args.session },
  );
}
