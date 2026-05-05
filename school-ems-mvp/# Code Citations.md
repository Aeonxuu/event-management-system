# Code Citations

## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```


## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```


## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```


## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```


## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```


## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```


## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```


## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```


## License: unknown
https://github.com/csaramos/snapgram/blob/6ad90486503b7dd4c4b86b0598aea894a46bc69c/src/main.tsx

```
## Plan: Migrate from Next.js to Express (Keep React Frontend)

**TL;DR:** Your project will transition from Next.js (frontend + backend monolith) to a **separate React SPA + Express API** architecture. Since you can have downtime and prefer chunked migration, I recommend a **5-phase approach**:

1. Set up Express project structure alongside Next.js (can delete Next.js later)
2. Migrate auth layer (JWT, guards, middleware)
3. Migrate workflow + database logic (Mongoose models, business rules)
4. Migrate all API routes to Express
5. Rebuild React frontend as a standalone SPA, point to Express backend

This allows testing & verification between chunks without a big-bang rewrite.

---

## Phase 1: Express Foundation & Repo Structure

**Goal:** Create Express server scaffold with proper folder hierarchy.

**Steps**
1. Install Express dependencies:
   - `express`, `express-cors`, `express-json-middleware`
   - Keep existing: `mongoose`, `jsonwebtoken`, `bcryptjs`, `zod`, `cookie-parser`
   - Add: `dotenv` (if not already used), `helmet` (security headers)

2. Create new folder structure:
   ```
   src/
     server/
       index.ts                 # Express app entry point
       middleware/
         auth.ts              # JWT verification (moved from guards.ts)
         errorHandler.ts      # Global error handler
       routes/
         auth.ts              # Login/logout
         events.ts            # Event CRUD + workflow
         venues.ts            # Venue management
         queues.ts            # Approval queues
         admin.ts             # Admin routes
       services/
         eventWorkflow.ts      # State machine logic (from workflow.ts)
         auditLog.ts          # Audit trail logic
       models/                # Keep existing Mongoose models, move to shared lib/models/
   ```

3. Create `server/index.ts`:
   - Initialize Express app
   - Register middleware (CORS, JSON, cookie-parser, auth)
   - Mount route handlers
   - Start listening on port 3001 (or configurable via `.env`)
   - Database connection (reuse [src/lib/db.ts](src/lib/db.ts) connection logic)

4. Update `package.json`:
   - Add `dev:server` script: `nodemon --watch src/server src/server/index.ts`
   - Keep existing `dev` (Next.js) for now, run in parallel during transition

5. Create `.env` variables for Express:
   ```
   EXPRESS_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/school-ems-mvp
   JWT_SECRET=[same as Next.js env]
   NODE_ENV=development
   ```

**Verification**
- Express server starts on port 3001 without errors
- Can hit `http://localhost:3001/health` (add a simple health check route)
- No database errors on startup

---

## Phase 2: Migrate Authentication Layer

**Goal:** Move JWT issuance, validation, and authorization guards to Express.

**Steps**
1. Move [src/lib/auth.ts](src/lib/auth.ts) to `src/server/middleware/auth.ts` (or create `src/server/utils/jwt.ts`):
   - `signToken()` — Generate JWT
   - `verifyToken()` — Validate JWT from cookie
   - `decodeToken()` — Extract claims without validation (for debugging)

2. Create `src/server/middleware/requireAuth.ts`:
   - Express middleware that calls `verifyToken()`
   - Attaches user object to `req.user` (replaces Next.js `req.auth`)
   - Throws 401 if invalid

3. Create `src/server/middleware/requireRole.ts`:
   - Express middleware that checks `req.user.role` against allowed roles
   - Throws 403 if unauthorized
   - Reuse role enum from [src/models/enums.ts](src/models/enums.ts)

4. Create `src/server/routes/auth.ts`:
   - `POST /api/auth/login` — Reuse validation from [src/lib/validators/auth.ts](src/lib/validators/auth.ts), sign JWT, set HTTP-only cookie
   - `POST /api/auth/logout` — Clear cookie
   - Copy logic from [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) and [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

5. Update database connection:
   - Move [src/lib/db.ts](src/lib/db.ts) logic to Express startup (or reuse directly)
   - Import [src/models/user.model.ts](src/models/user.model.ts) for user lookup during login

6. Test login/logout without other API routes:
   - `curl -X POST http://localhost:3001/api/auth/login -d '{"email":"user@school.edu","password":"demo123"}'`
   - Verify JWT cookie is set
   - Verify cookie is cleared on logout

**Relevant files**
- [src/lib/auth.ts](src/lib/auth.ts) — JWT signing/verification logic
- [src/lib/guards.ts](src/lib/guards.ts) — Authorization checks
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts) — Login handler (copy logic)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts) — Logout handler (copy logic)
- [src/models/user.model.ts](src/models/user.model.ts) — User schema for lookup
- [src/lib/validators/auth.ts](src/lib/validators/auth.ts) — Zod schema for login validation

**Verification**
- Auth routes respond with 200 + JWT cookie on valid credentials
- Returns 401 on invalid credentials
- Logout clears cookie
- Protected routes return 401 without valid cookie

---

## Phase 3: Migrate Workflow & Business Logic

**Goal:** Move event workflow state machine, validators, and audit trail to Express services.

**Steps**
1. Copy Mongoose models to `src/models/` (already there):
   - Keep [src/models/event.model.ts](src/models/event.model.ts), [src/models/user.model.ts](src/models/user.model.ts), [src/models/venue.model.ts](src/models/venue.model.ts), etc. **unchanged**
   - No schema changes needed (works with Express too)

2. Create `src/server/services/eventWorkflow.ts`:
   - Copy workflow logic from [src/lib/workflow.ts](src/lib/workflow.ts):
     - `WORKFLOW_STATUS_SEQUENCE`, `NEXT_STATUS_MAP`, `NEXT_APPROVER_MAP`
     - `ensureVenueAvailability()` — Venue double-booking check
     - `validateTransition()` — Role-based state machine validation
     - `appendAuditLog()` — Create audit trail entry
   - Export typed functions, not raw constants

3. Create `src/server/services/auditLog.ts`:
   - Helper to log audit events (used by workflow)
   - Imports [src/models/audit-log.model.ts](src/models/audit-log.model.ts)

4. Move validators to `src/lib/validators/` (already there, but ensure Express routes can import):
   - [src/lib/validators/event.ts](src/lib/validators/event.ts) — Zod schemas for event create/update
   - [src/lib/validators/venue.ts](src/lib/validators/venue.ts) — Venue validation
   - Export as shared code (no duplication needed)

5. Create `src/server/utils/errorHandler.ts`:
   - Map error types to HTTP status codes
   - Reuse error codes from [src/lib/api.ts](src/lib/api.ts): `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `VENUE_DOUBLE_BOOKED`, `INVALID_STATE`
   - Return standardized JSON: `{ success: false, error: "...", code: "ERROR_CODE" }`

6. Create `src/server/middleware/errorHandler.ts`:
   - Express error handling middleware (catches thrown errors from routes)
   - Logs errors, formats response

**Relevant files**
- [src/lib/workflow.ts](src/lib/workflow.ts) — State machine logic to move into service
- [src/models/audit-log.model.ts](src/models/audit-log.model.ts) — Audit schema (unchanged)
- [src/lib/validators/](src/lib/validators/) — Zod schemas (keep, reuse in Express)
- [src/lib/api.ts](src/lib/api.ts) — Error handling patterns

**Verification**
- Workflow validation functions accept/reject invalid state transitions
- Audit log entries are created on mock event mutations
- Error handler returns correct HTTP status codes
- Double-booking check prevents overlapping venue bookings (mock test)

---

## Phase 4: Migrate All API Routes to Express

**Goal:** Move all 20+ endpoints from Next.js API routes to Express route handlers.

**Steps** (*can be done in parallel or grouped by feature*)

1. **Event Routes** (`src/server/routes/events.ts`):
   - Copy handlers from [src/app/api/events/route.ts](src/app/api/events/route.ts), [src/app/api/events/[id]/route.ts](src/app/api/events/[id]/route.ts), etc.
   - Handlers already in [src/app/api/events](src/app/api/events/) folder (submit, approve, request-revision subdirs)
   - Use `requireAuth()` middleware on each route
   - Use `requireRole()` for role-based endpoints

2. **Venue Routes** (`src/server/routes/venues.ts`):
   - From [src/app/api/venues/route.ts](src/app/api/venues/route.ts), [src/app/api/venues/[id]/route.ts](src/app/api/venues/[id]/route.ts)
   - Admin-only endpoints

3. **Admin Routes** (`src/server/routes/admin.ts`):
   - From [src/app/api/admin/](src/app/api/admin/) (users, events, organizations, venues)

4. **Approval Queue** (`src/server/routes/queues.ts`):
   - From [src/app/api/queues/me/route.ts](src/app/api/queues/me/route.ts)

5. **Organization Routes** (`src/server/routes/organizations.ts`):
   - From [src/app/api/organizations/route.ts](src/app/api/organizations/route.ts), [src/app/api/admin/organizations](src/app/api/admin/organizations/)

6. **Me Route** (`src/server/routes/me.ts`):
   - From [src/app/api/me/route.ts](src/app/api/me/route.ts)
   - Returns current user profile from JWT token

7. Register all routes in `src/server/index.ts`:
   ```typescript
   app.use('/api/auth', authRoutes);
   app.use('/api/events', eventRoutes);
   app.use('/api/venues', venueRoutes);
   app.use('/api/organizations', orgRoutes);
   // ... etc
   ```

**Key Considerations**
- **Code reuse:** Handler logic in Next.js routes can be copied mostly as-is; just swap `NextRequest/NextResponse` for `req/res`
- **Middleware chain:** Instead of `requireAuth()` + `requireRole()` + `withApiHandler()`, use Express middleware stack:
  ```typescript
  router.post('/approve', requireAuth, requireRole(['ADVISER', 'DEAN']), (req, res, next) => { /* handler */ })
  ```
- **Error handling:** Throw errors in handlers; let `errorHandler` middleware catch them (instead of try/catch in each route)
- **Request body:** Express doesn't auto-parse by default; rely on `express.json()` middleware (add in `index.ts`)

**Relevant files**
- [src/app/api/](src/app/api/) — All Next.js route handlers to migrate

**Verification**
- Each route responds with correct status code and JSON structure (test with Postman or curl)
- Role-based access control works (401 unauthenticated, 403 forbidden)
- Workflow state transitions work (create → submit → approve → approved)
- Venue double-booking returns 409 conflict

---

## Phase 5: Migrate React Frontend to Standalone SPA

**Goal:** Build React frontend as a separate build artifact, served by Express.

**Steps**
1. Create `src/client/` folder structure (separate from `src/server/`):
   ```
   src/
     client/
       index.tsx              # React app entry point
       pages/
         Login.tsx            # (rename from src/app/login/page.tsx)
         Student.tsx
         Approver.tsx
         Admin.tsx
       components/            # (move from src/components/ but strip Next.js imports)
       lib/
         api.ts               # (from src/lib/client/api.ts)
         types.ts
     server/                  # (Express backend)
   ```

2. **Remove Next.js-specific imports** from React components:
   - Replace `next/navigation` imports (`useRouter`, `useSearchParams`) with `react-router-dom`
   - Remove `next/link` (use React Router `<Link>`)
   - Remove `import type { Metadata }` (metadata irrelevant in SPA)
   - Update [src/components/dashboard/event-form.tsx](src/components/dashboard/event-form.tsx), [src/app/approver/page.tsx](src/app/approver/page.tsx), etc.

3. **Create client entry point** `src/client/index.tsx`:
   ```typescript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { BrowserRouter } from 'react-router-dom';
   import App from './App';
   
   createRoot(document.getElementById('root')!).render(
     <BrowserRouter>
       <App />
     </BrowserRouter>
   );
   ```

4. **Create `src/client/App.tsx`
```

