# School Event Management System MVP Blueprint

## 1. Project Overview

### Mission
Replace paper-based event routing with a minimal digital sequential workflow for school event proposals. The MVP should make it easy for student leaders to draft and submit proposals, let approvers review in order, and give admins visibility into venues and events.

### MVP Scope
- Student leaders can create, edit, save as draft, and submit event proposals.
- Approvers follow a fixed sequence: Adviser -> Dean -> Facilities -> OSA.
- Each approver can approve or request revision.
- Admin can manage venues with CRUD and view all events in a read-only dashboard.
- Every status transition is logged in an audit trail.
- Double-booking of venues is prevented for overlapping approved events.

### Core User Stories
- As a student leader, I can draft an event, edit it, and submit it for review.
- As an adviser, dean, facilities officer, or OSA user, I can see only my queue and act on the next pending proposal.
- As an approver, I can approve a proposal or return it for revision.
- As an admin, I can create and maintain venue records and inspect all events.
- As the system, I can prevent two approved events from occupying the same venue at overlapping times.

### Workflow Rules
- Status state machine: DRAFT -> PENDING_ADVISER -> PENDING_DEAN -> PENDING_FACILITIES -> PENDING_OSA -> APPROVED.
- Revision loop: any approver may set REVISION_REQUIRED, which sends the proposal back to DRAFT or a student-editable revision state.
- A user may act only if their role matches the next required approver.
- Actions on events in the wrong status must be rejected.

## 2. Tech Stack

### Recommended Stack
- Frontend: Next.js with React.
- Styling: Tailwind CSS or CSS modules, but the component system must follow the Linear-style tokens from DESIGN.md.
- Backend: Node.js + Express.
- Database: MongoDB with Mongoose.
- Validation: Zod on the backend request boundary.
- Auth: Session or JWT-based authentication, depending on existing infrastructure; keep the implementation minimal and role-based.

### Why This Stack
- Next.js fits the dark dashboard, role-based views, and shared UI component structure while remaining simple for an MVP.
- Express keeps workflow endpoints explicit and easy to reason about.
- MongoDB/Mongoose fits the reference-heavy data model and audit logging.
- Zod provides strict request validation without overcomplicating controller code.

### Design Requirements
- Dark theme must use the Linear-inspired palette from DESIGN.md.
- Global typography must use Inter Variable with OpenType features `cv01` and `ss03` enabled.
- CTAs must use the brand indigo accent.
- All dashboard surfaces should use semi-transparent borders and layered dark panels.
- A stepper component must show proposal progress and current reviewer stage.

## 3. Database Schema & Indexing

### Collections

#### Users
Fields:
- `_id`: ObjectId
- `name`: string, required
- `email`: string, required, unique, lowercase
- `role`: enum(`STUDENT_LEADER`, `ADVISER`, `DEAN`, `FACILITIES`, `OSA`, `ADMIN`), required
- `organizationId`: ObjectId reference to Organizations, optional for admins
- `isActive`: boolean, default `true`
- `createdAt`, `updatedAt`: Date

Validations:
- `name` required and trimmed.
- `email` required and validated as email.
- `role` required and restricted by enum.

Indexes:
- unique index on `email`
- index on `role`
- index on `organizationId`

#### Organizations
Fields:
- `_id`: ObjectId
- `name`: string, required, unique
- `code`: string, required, unique
- `createdAt`, `updatedAt`: Date

#### Venues
Fields:
- `_id`: ObjectId
- `name`: string, required
- `location`: string, required
- `capacity`: number, required, min `1`
- `isActive`: boolean, default `true`
- `notes`: string, optional
- `createdAt`, `updatedAt`: Date

Indexes:
- unique compound index on `name` + `location` if venue names are reused across campuses
- index on `isActive`

#### Events
Fields:
- `_id`: ObjectId
- `title`: string, required
- `description`: string, required
- `organizerId`: ObjectId reference to Users, required
- `organizationId`: ObjectId reference to Organizations, required
- `venueId`: ObjectId reference to Venues, required once submitted
- `status`: enum(`DRAFT`, `PENDING_ADVISER`, `PENDING_DEAN`, `PENDING_FACILITIES`, `PENDING_OSA`, `APPROVED`, `REVISION_REQUIRED`), required
- `startAt`: Date, required
- `endAt`: Date, required
- `budget`: Decimal128, required, min `0`
- `expectedAttendees`: number, required, min `1`
- `submittedAt`: Date, optional
- `currentApproverRole`: enum of workflow roles, derived or stored for fast queue reads
- `lastActionBy`: ObjectId reference to Users, optional
- `revisionNotes`: string, optional
- `createdAt`, `updatedAt`: Date

Validations:
- `endAt` must be after `startAt`.
- `budget` must be non-negative.
- `status` must follow the workflow.
- `venueId` should be required before submission and approval routing.

Indexes:
- index on `status` + `organizerId`
- compound index on `venueId` + `startAt` + `endAt`
- optional supporting index on `venueId` + `eventDate` if a derived day bucket is stored for fast same-day conflict checks
- index on `currentApproverRole` + `status` for approver queues
- index on `updatedAt` for admin dashboards

#### AuditLogs
Fields:
- `_id`: ObjectId
- `eventId`: ObjectId reference to Events, required
- `actorId`: ObjectId reference to Users, required
- `fromStatus`: enum of event statuses, required
- `toStatus`: enum of event statuses, required
- `action`: enum(`SUBMIT`, `APPROVE`, `REQUEST_REVISION`, `CREATE`, `UPDATE`), required
- `timestamp`: Date, default now
- `notes`: string, optional

Indexes:
- index on `eventId` + `timestamp`
- index on `actorId` + `timestamp`

### Data Modeling Notes
- Normalize relationships with references instead of embedding large subdocuments.
- Use ISO 8601 dates in the API and Date objects in MongoDB.
- Use Decimal128 for budget to avoid floating-point precision issues.
- Keep event status and workflow position explicit so queue queries stay simple.

## 4. API Endpoints

### Authentication and Identity
- `GET /api/me` - current user profile and role.

### Events
- `POST /api/events` - create a draft event.
- `PATCH /api/events/:id` - edit a draft or revision-required event.
- `POST /api/events/:id/submit` - move from DRAFT to PENDING_ADVISER.
- `GET /api/events/:id` - view one event with audit history.
- `GET /api/events` - list events for the current user or admin dashboard.

### Workflow Actions
- `GET /api/queues/me` - load the current approver queue.
- `POST /api/events/:id/approve` - approve the current stage.
- `POST /api/events/:id/request-revision` - request revision and return to the student.

### Venues
- `GET /api/venues` - list venues.
- `POST /api/venues` - create venue.
- `PATCH /api/venues/:id` - update venue.
- `DELETE /api/venues/:id` - delete venue if not in use or mark inactive.

### Admin Dashboard
- `GET /api/admin/events` - paginated all-events read-only view.

### Endpoint Rules
- REST is preferred for simplicity.
- Every mutating endpoint must validate payloads before controller logic.
- Every workflow action must verify role, status, and next approver.

## 5. UI Component Architecture

### Information Architecture
- Student dashboard
- Approver queue dashboard
- Admin dashboard
- Event form flow
- Venue management screens

### Core Components
- App shell with dark sidebar and top bar.
- Role-aware dashboard cards showing only relevant actions.
- Event form with sectioned inputs and autosave draft behavior.
- Status stepper showing current stage, next approver, and revision state.
- Audit trail list with timestamp, actor, action, and note.
- Queue table for approvers with primary CTA and secondary request-revision action.
- Venue CRUD table with create/edit dialog.
- Read-only admin event table with pagination and filters.

### Linear-Style UI Rules
- Backgrounds should use near-black and layered dark panels.
- Use Inter Variable globally with `cv01` and `ss03` enabled.
- Use semi-transparent borders instead of heavy outlines.
- Use brand indigo for primary CTAs and active states.
- Keep rounded corners modest and consistent.
- The stepper should be prominent and compact, with clear stage labeling.
- Avoid bright accent colors except for status cues and the brand CTA.

### Suggested UI Structure
- Student view: draft card, submit button, stepper, audit trail.
- Approver view: queue table, event detail drawer, approve/revision actions.
- Admin view: venue table, event archive table, filters, pagination.

## 6. Validation & Error Handling

### Validation Strategy
- Validate every request body with Zod before controller execution.
- Validate IDs as Mongo ObjectIds before querying.
- Validate date ordering and logical consistency.
- Reject negative budgets, missing venue references, and invalid status transitions.

### Example Zod Schemas
```ts
import { z } from 'zod';

export const eventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  organizerId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  organizationId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  venueId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  budget: z.coerce.number().min(0),
  expectedAttendees: z.coerce.number().int().min(1),
}).refine((data) => data.endAt > data.startAt, {
  message: 'endAt must be after startAt',
  path: ['endAt'],
});

export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(['STUDENT_LEADER', 'ADVISER', 'DEAN', 'FACILITIES', 'OSA', 'ADMIN']),
  organizationId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export const venueSchema = z.object({
  name: z.string().min(2).max(120),
  location: z.string().min(2).max(200),
  capacity: z.coerce.number().int().min(1),
  isActive: z.boolean().optional(),
});
```

### Error Response Format
All errors should return:
```json
{ "success": false, "error": "Clear error message", "code": "ERROR_CODE" }
```

### Required Error Cases
- 400 for malformed JSON or validation failure.
- 403 for unauthorized role or invalid workflow action.
- 404 for invalid or missing IDs.
- 409 for double-booking or conflicting state transitions.

### Centralized Error Middleware
- Use one Express error handler at the end of the middleware chain.
- Map Zod validation failures to 400.
- Map Mongoose cast errors and missing documents to 404.
- Keep controller code thin and let the middleware standardize output.

## 7. Performance & Query Optimisation

### Read Optimization
- Use `.lean()` for read-only dashboard, queue, and archive queries.
- Select only the fields needed for each view.
- Use `.populate()` selectively to avoid N+1 queries.

### Pagination
- Paginate admin all-events views by cursor or page/limit.
- Return counts only if the UI needs them.
- Default to a small page size such as 20 or 25 records.

### Queue Loading Optimization
- Query by `currentApproverRole` and `status`.
- Sort by `updatedAt` or `submittedAt` so the oldest pending items surface first.
- Populate only organizer name, event title, venue name, and workflow timestamps.
- Prefer one query for queue rows and one detail query on demand instead of loading full event trees everywhere.

### Bottlenecks to Watch
- Audit log writes on every action.
- Double-booking checks when a venue or time window changes.
- Large admin event archives if pagination is missing.

### Scaling Notes
- Start without Redis; add caching only if queue or archive queries become measurably slow.
- Configure MongoDB connection pooling for the expected concurrent dashboard traffic.
- Set query timeouts or server-side max execution time for expensive archive filters.

## 8. Defensive Programming & Security

### Workflow Guards
- Before approval, verify the current user role matches the next required approver.
- Reject approve/revision actions unless the event is in the exact expected pending status.
- Reject edits after submission except when the event is in REVISION_REQUIRED or an explicitly editable state.

### Double-Booking Protection
- On submit or venue change, check for overlapping approved or in-flight events using the same `venueId`.
- Prefer a transaction or serializable logic path when writing the event and audit log together.
- If the database cannot enforce overlap directly with a pure unique index, enforce it in the service layer and add a supporting compound index for fast lookup.

### Transactions
- Use a Mongoose session when updating the event status and inserting the audit log in the same workflow action.
- Commit only after both writes succeed.
- Abort the transaction if approval is rejected, validation fails, or the double-booking check detects a conflict.

### Input Safety
- Sanitize and validate all inbound strings.
- Do not trust frontend state for role, status, or approver identity.
- Derive permission checks from the authenticated user and persisted workflow state only.

### Example Status Guard
```ts
const nextApproverByStatus = {
  PENDING_ADVISER: 'ADVISER',
  PENDING_DEAN: 'DEAN',
  PENDING_FACILITIES: 'FACILITIES',
  PENDING_OSA: 'OSA',
};

function assertCanAct(userRole, eventStatus) {
  const requiredRole = nextApproverByStatus[eventStatus];
  if (!requiredRole || userRole !== requiredRole) {
    throw Object.assign(new Error('Forbidden workflow action'), { statusCode: 403, code: 'FORBIDDEN_ROLE' });
  }
}
```

## 9. Implementation Phases

### Phase 1: Auth + Event CRUD
- Set up authentication and role identity.
- Build student event draft creation and editing.
- Add submit action and base event detail view.
- Add request validation and global error handling.

### Phase 2: Workflow + Approval Queue
- Implement the sequential state machine.
- Build queue views for Adviser, Dean, Facilities, and OSA.
- Add approve and request revision actions.
- Write audit log entries for every transition.

### Phase 3: Venue Management + Double-Booking Prevention
- Add venue CRUD for admins.
- Add overlap checks before submit and approval.
- Add admin read-only event archive with pagination.
- Tune indexes and query projections.

## 10. Appendix - Sample Code Snippets

### Approval Guard
```ts
async function approveEvent(req, res, next) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const event = await Event.findById(req.params.id).session(session);
      if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404, code: 'EVENT_NOT_FOUND' });

      assertCanAct(req.user.role, event.status);

      const nextStatusMap = {
        PENDING_ADVISER: 'PENDING_DEAN',
        PENDING_DEAN: 'PENDING_FACILITIES',
        PENDING_FACILITIES: 'PENDING_OSA',
        PENDING_OSA: 'APPROVED',
      };

      const fromStatus = event.status;
      const toStatus = nextStatusMap[fromStatus];
      if (!toStatus) throw Object.assign(new Error('Invalid event status'), { statusCode: 409, code: 'INVALID_STATE' });

      event.status = toStatus;
      event.lastActionBy = req.user._id;
      await event.save({ session });

      await AuditLog.create([
        {
          eventId: event._id,
          actorId: req.user._id,
          fromStatus,
          toStatus,
          action: 'APPROVE',
          timestamp: new Date(),
        },
      ], { session });
    });

    return res.json({ success: true });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
}
```

### Double-Booking Check
```ts
async function ensureVenueAvailability({ venueId, startAt, endAt, excludeEventId, session }) {
  const conflict = await Event.findOne({
    _id: { $ne: excludeEventId },
    venueId,
    status: { $in: ['PENDING_ADVISER', 'PENDING_DEAN', 'PENDING_FACILITIES', 'PENDING_OSA', 'APPROVED'] },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  })
    .session(session)
    .lean();

  if (conflict) {
    throw Object.assign(new Error('Venue is already booked for this time range'), {
      statusCode: 409,
      code: 'VENUE_DOUBLE_BOOKED',
    });
  }
}
```

### Audit Log Middleware
```ts
async function appendAuditLog({ session, eventId, actorId, fromStatus, toStatus, action, notes }) {
  await AuditLog.create([
    {
      eventId,
      actorId,
      fromStatus,
      toStatus,
      action,
      notes,
      timestamp: new Date(),
    },
  ], { session });
}
```

### Central Error Handler
```ts
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR');
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    code,
  });
}
```

### Final MVP Principle
Keep the system narrow: no email notifications, no file attachments, no WebSockets, no real-time collaboration, and no extra approval branches beyond the required sequential workflow.