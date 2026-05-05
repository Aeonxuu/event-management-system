import { Router } from "express";
import mongoose from "mongoose";
import { Event } from "../../models/event.model";
import { User } from "../../models/user.model";
import { eventCreateSchema, eventPatchSchema } from "../../lib/validators/event";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import {
  ensureVenueAvailability,
  appendAuditLog,
  WORKFLOW_STATUS_SEQUENCE,
  NEXT_STATUS_MAP,
  NEXT_APPROVER_MAP,
  VENUE_BLOCKING_STATUSES,
} from "../services/eventWorkflow";

const router = Router();

// List events for current user (basic)
router.get("/", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user.sub;
    const docs = await Event.find({ organizerId: userId }).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, data: { events: docs } });
  } catch (err) {
    return next(err);
  }
});

// Create event (DRAFT)
router.post("/", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  const session = await mongoose.startSession();
  try {
    const parsed = eventCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      const err: any = new Error(parsed.error.message);
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const payload = parsed.data;
    const user = await User.findById(req.user.sub);
    if (!user) {
      const err: any = new Error("User not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    await session.withTransaction(async () => {
      const ev = await Event.create([
        {
          ...payload,
          organizerId: user._id,
          organizationId: payload.organizationId ?? user.organizationId,
          status: "DRAFT",
        },
      ]);

      await appendAuditLog({
        eventId: (ev as any)[0]._id,
        actorId: user._id,
        fromStatus: "DRAFT",
        toStatus: "DRAFT",
        action: "CREATE",
      });

      return res.status(201).json({ success: true, data: { event: (ev as any)[0] } });
    });
  } catch (err) {
    return next(err);
  } finally {
    session.endSession();
  }
});

// Get event by id
router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const ev = await Event.findById(req.params.id).lean();
    if (!ev) {
      const err: any = new Error("Event not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    return res.json({ success: true, data: { event: ev } });
  } catch (err) {
    return next(err);
  }
});

// Patch event (owner only, only editable in DRAFT or REVISION_REQUIRED)
router.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  const session = await mongoose.startSession();
  try {
    const parsed = eventPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      const err: any = new Error(parsed.error.message);
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const ev = await Event.findById(req.params.id).session(session);
    if (!ev) {
      const err: any = new Error("Event not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    if (String(ev.organizerId) !== String(req.user.sub)) {
      const err: any = new Error("Forbidden");
      err.status = 403;
      err.code = "FORBIDDEN_ROLE";
      throw err;
    }

    if (!(ev.status === "DRAFT" || ev.status === "REVISION_REQUIRED")) {
      const err: any = new Error("Event cannot be edited in its current state");
      err.status = 409;
      err.code = "INVALID_STATE";
      throw err;
    }

    await session.withTransaction(async () => {
      Object.assign(ev, parsed.data);
      await ev.save({ session });

      await appendAuditLog({
        eventId: ev._id,
        actorId: new mongoose.Types.ObjectId(req.user.sub),
        fromStatus: ev.status as any,
        toStatus: ev.status as any,
        action: "UPDATE",
      });

      return res.json({ success: true, data: { event: ev } });
    });
  } catch (err) {
    return next(err);
  } finally {
    session.endSession();
  }
});

// Submit event -> moves to first approver pending status
router.post("/:id/submit", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  const session = await mongoose.startSession();
  try {
    const ev = await Event.findById(req.params.id).session(session);
    if (!ev) {
      const err: any = new Error("Event not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    if (String(ev.organizerId) !== String(req.user.sub)) {
      const err: any = new Error("Forbidden");
      err.status = 403;
      err.code = "FORBIDDEN_ROLE";
      throw err;
    }

    if (!(ev.status === "DRAFT" || ev.status === "REVISION_REQUIRED")) {
      const err: any = new Error("Event cannot be submitted in its current state");
      err.status = 409;
      err.code = "INVALID_STATE";
      throw err;
    }

    // If venue required, check availability
    if (ev.venueId) {
      await ensureVenueAvailability({
        venueId: ev.venueId as any,
        startAt: ev.startAt,
        endAt: ev.endAt,
        excludeEventId: ev._id,
        session,
      });
    }

    await session.withTransaction(async () => {
      const first = WORKFLOW_STATUS_SEQUENCE[ (req.user.role as any) ] ?? WORKFLOW_STATUS_SEQUENCE.ADVISER;
      ev.status = first as any;
      ev.submittedAt = new Date();
      ev.currentApproverRole = first as any;
      await ev.save({ session });

      await appendAuditLog({
        eventId: ev._id,
        actorId: new mongoose.Types.ObjectId(req.user.sub),
        fromStatus: "DRAFT",
        toStatus: ev.status as any,
        action: "SUBMIT",
      });

      return res.json({ success: true, data: { event: ev } });
    });
  } catch (err) {
    return next(err);
  } finally {
    session.endSession();
  }
});

  // Approve event (approver roles)
  router.post("/:id/approve", requireAuth, requireRole(["ADVISER", "DEAN", "FACILITIES", "OSA"]), async (req: AuthenticatedRequest, res, next) => {
    const session = await mongoose.startSession();
    try {
      const ev = await Event.findById(req.params.id).session(session);
      if (!ev) {
        const err: any = new Error("Event not found");
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }

      // Only allow approvers when status is a pending approver status
      if (!Object.keys(NEXT_STATUS_MAP).includes(ev.status as string) && ev.status !== "PENDING_OSA") {
        const err: any = new Error("Event is not pending approval");
        err.status = 409;
        err.code = "INVALID_STATE";
        throw err;
      }

      // Check that the req.user.role matches currentApproverRole
      if (String(ev.currentApproverRole) !== String(req.user.role)) {
        const err: any = new Error("Not authorized to approve this event");
        err.status = 403;
        err.code = "FORBIDDEN_ROLE";
        throw err;
      }

      // Ensure venue still available if required
      if (ev.venueId && VENUE_BLOCKING_STATUSES.includes(ev.status as any)) {
        await ensureVenueAvailability({
          venueId: ev.venueId as any,
          startAt: ev.startAt,
          endAt: ev.endAt,
          excludeEventId: ev._id,
          session,
        });
      }

      await session.withTransaction(async () => {
        const nextStatus = NEXT_STATUS_MAP[ev.status as any] ?? "APPROVED";
        const nextApprover = NEXT_APPROVER_MAP[ev.status as any] ?? undefined;

        const fromStatus = ev.status as any;
        ev.status = nextStatus as any;
        ev.currentApproverRole = nextApprover as any;
        ev.lastActionBy = new mongoose.Types.ObjectId(req.user.sub);
        await ev.save({ session });

        await appendAuditLog({
          eventId: ev._id,
          actorId: new mongoose.Types.ObjectId(req.user.sub),
          fromStatus,
          toStatus: ev.status as any,
          action: "APPROVE",
        });

        return res.json({ success: true, data: { event: ev } });
      });
    } catch (err) {
      return next(err);
    } finally {
      session.endSession();
    }
  });

  // Request revision (approver roles)
  router.post("/:id/request-revision", requireAuth, requireRole(["ADVISER", "DEAN", "FACILITIES", "OSA"]), async (req: AuthenticatedRequest, res, next) => {
    const session = await mongoose.startSession();
    try {
      const { notes } = req.body ?? {};
      const ev = await Event.findById(req.params.id).session(session);
      if (!ev) {
        const err: any = new Error("Event not found");
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }

      if (!Object.keys(NEXT_STATUS_MAP).includes(ev.status as string) && ev.status !== "PENDING_OSA") {
        const err: any = new Error("Event is not pending approval");
        err.status = 409;
        err.code = "INVALID_STATE";
        throw err;
      }

      if (String(ev.currentApproverRole) !== String(req.user.role)) {
        const err: any = new Error("Not authorized to request revision for this event");
        err.status = 403;
        err.code = "FORBIDDEN_ROLE";
        throw err;
      }

      await session.withTransaction(async () => {
        const fromStatus = ev.status as any;
        ev.status = "REVISION_REQUIRED" as any;
        ev.revisionNotes = notes ?? "";
        ev.lastActionBy = new mongoose.Types.ObjectId(req.user.sub);
        await ev.save({ session });

        await appendAuditLog({
          eventId: ev._id,
          actorId: new mongoose.Types.ObjectId(req.user.sub),
          fromStatus,
          toStatus: ev.status as any,
          action: "REQUEST_REVISION",
          notes: notes,
        });

        return res.json({ success: true, data: { event: ev } });
      });
    } catch (err) {
      return next(err);
    } finally {
      session.endSession();
    }
  });

export default router;
