# Final Integration and Testing Flow

This checklist validates the School Event Management System MVP end to end against the blueprint.

## 1. Prerequisites

1. MongoDB is running locally.
2. Environment file exists at `.env.local` with valid values.
3. Dependencies installed via `npm install`.
4. Demo data seeded via `npm run seed:demo`.

## 2. Start App

1. Run `npm run dev:server` (Express API on port 3001) in one terminal.
2. Run `npm run dev` (Next.js UI on port 3000) in another terminal.
3. Open `http://localhost:3000`.
4. Confirm redirect to `/login`.

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

## Run & Test (Express backend + Next.js frontend)

**Note:** The backend has been migrated to Express.js. MongoDB must be running and `.env.local` must be configured before starting.

### Prerequisites

1. **MongoDB running** (local or Docker):
   ```bash
   docker run --name mongo-school-ems -p 27017:27017 -d mongo:6
   ```

2. **`.env.local` configured** in `school-ems-mvp/` folder:
   ```
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=replace_with_a_secure_secret_at_least_16_chars
   JWT_EXPIRES_IN=7d
   AUTH_COOKIE_NAME=school_ems_token
   APP_URL=http://localhost:3000
   EXPRESS_PORT=3001
   ```

3. **Dependencies installed and demo data seeded** (run from `school-ems-mvp/`):
   ```bash
   npm install
   npm run seed:demo
   ```

### Demo Accounts

All demo accounts use password: **`demo123`**

| Email | Role | Purpose |
|-------|------|---------|
| `student.dsc@school.demo` | Student Leader | Create and submit events |
| `student.mastech@school.demo` | Student Leader | Create and submit events |
| `adviser@school.demo` | Adviser | First approver in workflow |
| `dean@school.demo` | Dean | Second approver in workflow |
| `facilities@school.demo` | Facilities | Third approver in workflow |
| `osa@school.demo` | OSA | Fourth approver in workflow |
| `admin@school.demo` | Admin | Manage users, venues, organizations |

### Starting the Servers

Run these commands in **separate terminal windows** from the `school-ems-mvp/` folder:

**Terminal 1 — Start Express API** (port 3001):
```bash
npm run dev:server
```
Output should include: `Express server listening on http://localhost:3001`

**Terminal 2 — Start Next.js UI** (port 3000):
```bash
npm run dev
```
Output should include: `- Local: http://localhost:3000`

### Quick API Smoke Tests

From a third terminal, verify endpoints:

```bash
# Health check
powershell -Command "Invoke-WebRequest http://localhost:3001/api/health -UseBasicParsing | ConvertFrom-Json"

# Login (returns JWT in Set-Cookie header)
powershell -Command "@{email='admin@school.demo';password='demo123'} | ConvertTo-Json | Invoke-WebRequest -Uri http://localhost:3001/api/auth/login -Method POST -ContentType 'application/json' -UseBasicParsing | ConvertFrom-Json"

# Events (requires auth cookie)
powershell -Command "Invoke-WebRequest http://localhost:3001/api/events -UseBasicParsing | ConvertFrom-Json"
```

### UI Testing

1. Open `http://localhost:3000` in browser.
2. Follow the **Sections 3–12** of this checklist (Authentication, Student Flow, Approver Flow, etc.).

### Troubleshooting

- **"Cannot find module" errors**: Ensure relative imports in `src/server/` and `src/lib/` are correct. All imports should use relative paths (e.g., `../lib/db`).
- **Environment variable errors**: Ensure `.env.local` is in the `school-ems-mvp/` folder and contains all required keys.
- **Port already in use**: If port 3001 or 3000 is busy, update `EXPRESS_PORT` in `.env.local` or use `lsof -i :PORT` / `netstat -ano | findstr :PORT` to identify and stop conflicting processes.
- **PowerShell curl security prompt**: Use `powershell -Command "Invoke-WebRequest -UseBasicParsing"` to suppress script execution warnings.

### Optional: Single-Server Deployment (Future)

A pre-built SPA client exists in `dist/client/` (built via `npm run build:client`). Express can serve it directly by building the client and then running the Express server alone on port 3001, which will serve both API and static UI. This is useful for production deployments.
