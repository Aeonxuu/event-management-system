Project Instructions: School Event Management System (EMS)
1. The Core Mission

The goal of this system is to replace the "Paper-Routing" method of event approvals with a digital Sequential Workflow Engine. The app must eliminate the need for student leaders to physically walk folders between offices.
2. Technical Implementation Standards (CRITICAL)
A. Data Modeling & Schema Design

When designing the database (MongoDB/Mongoose), follow these optimization strategies:

    Normalization: Store Users, Organizations, and Venues in separate collections. Use References (ObjectId) for relationships (e.g., an Event refers to a venueId and an organizerId).

    Schema Validation: Every field must have strict Mongoose validation (e.g., required: true, enum for statuses, min/max for dates).

    Indexing Strategies: * Create indexes on status and organizerId for fast dashboard filtering.

        Use a compound index for venueId + eventDate to prevent double-booking at the database level.

    Data Types: Use ISO 8601 strings or Date objects for timestamps; use Decimals for budget items to avoid floating-point errors.

B. Input Validation & Defensive Programming

Never trust data coming from the frontend.

    Validation Layer: Use a library like Zod or Joi to validate the req.body before it reaches the controller.

    Missing/Invalid Data: Detect and reject inconsistent inputs (e.g., an "End Date" that occurs before the "Start Date").

    Defensive Checks: Before processing an approval, verify the current user actually has the role permitted to sign off on that specific stage of the workflow.

C. Robust Error Handling

    Standardized Responses: All errors must return a consistent JSON structure: { "success": false, "error": "Clear error message", "code": "ERROR_CODE" }.

    Scenarios: Explicitly handle 404 (Invalid IDs), 400 (Malformed JSON), and 403 (Unauthorized access).

    Global Middleware: Implement a centralized Express error-handling middleware to catch system exceptions and prevent the server from crashing.

D. Performance & Query Optimization

    Lean Queries: Use .lean() for read-only operations to improve execution time.

    Pagination: Implement pagination for the "Admin Archives" to prevent loading thousands of events at once.

    Bottleneck Identification: Avoid "N+1" query problems. Use .populate() strategically to fetch related data in a single round-trip where possible.

3. The Functional Workflow
Status State Machine

Every event must have a status field. Use this logic:

    DRAFT -> PENDING_ADVISER -> PENDING_DEAN -> PENDING_FACILITIES -> PENDING_OSA -> APPROVED.

    Include REVISION_REQUIRED for the "Return to Student" loop.

Role-Based Access Control (RBAC)

    Student Leader: Create/Edit.

    Approver: View Queue/Approve/Request Revision.

    Admin: Oversee system, manage Venues/Users.

4. UI/UX Priorities

    The Progress Tracker: A visual "stepper" showing exactly where the proposal is (e.g., "Step 2 of 4: Dean Review").

    The "Audit Trail": Every approval or rejection must be logged with a timestamp and the User ID of the person who took the action.