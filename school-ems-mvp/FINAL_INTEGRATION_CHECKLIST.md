# Final Integration and Testing Flow

This checklist validates the School Event Management System MVP end to end against the blueprint.

## 1. Prerequisites

1. MongoDB is running locally.
2. Environment file exists at `.env.local` with valid values.
3. Dependencies installed via `npm install`.
4. Demo data seeded via `npm run seed:demo`.

## 2. Start App

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Confirm redirect to `/login`.

## 3. Authentication

1. Log in using each seeded account and password `demo123`.
2. Confirm role-based redirect works:
   - Student Leader -> `/student`
   - Adviser/Dean/Facilities/OSA -> `/approver`
   - Admin -> `/admin`
3. Click Log out and confirm return to login.

## 4. Student Flow

1. Create a new draft event from `/student`.
2. Save draft and confirm event appears in My Events.
3. Submit draft and confirm status moves from `DRAFT` to `PENDING_ADVISER`.
4. Open event detail and verify audit contains `CREATE`, `UPDATE` (if edited), and `SUBMIT`.

## 5. Approver Flow

1. Adviser sees event in queue and approves.
2. Dean sees same event in queue and approves.
3. Facilities sees same event in queue and approves.
4. OSA sees same event in queue and approves.
5. Confirm final status is `APPROVED`.

## 6. Revision Loop

1. Submit another event as Student Leader.
2. At any approver stage, click Request Revision with notes.
3. Confirm status becomes `REVISION_REQUIRED`.
4. Student edits event and re-submits.
5. Confirm workflow restarts at `PENDING_ADVISER`.

## 7. Venue Management

1. Admin creates a venue.
2. Admin updates venue values.
3. Admin attempts delete:
   - If in use by pending/approved event, venue is deactivated.
   - If unused, venue is deleted.

## 8. Double-Booking Protection

1. Create Event A for Venue X and approve it.
2. Attempt Event B for Venue X with overlapping time.
3. Confirm API returns conflict with `VENUE_DOUBLE_BOOKED` and status 409.

## 9. Admin Archive and Pagination

1. Open `/admin`.
2. Confirm all-events archive loads.
3. Confirm rows include status and date/budget fields.
4. Confirm pagination API is functional (`page`, `limit`, `total`, `totalPages`).

## 10. API Contract Validation

1. For invalid payloads, verify status 400 with:
   `{ "success": false, "error": "...", "code": "VALIDATION_ERROR" }`
2. For forbidden role/state actions, verify status 403.
3. For missing resources, verify status 404.
4. For conflicts (state/venue), verify status 409.

## 11. Optional Automated Smoke Test

1. Keep app running on `http://localhost:3000`.
2. Run `npm run test:smoke`.
3. Expect output ending with `Smoke workflow passed`.

## 12. Release Readiness

1. `npm run lint` passes.
2. Core workflow is green:
   - Draft -> Submit -> Sequential approvals -> Approved
3. Audit trail records all transitions.
4. No out-of-scope features introduced (email, uploads, websockets, realtime).
