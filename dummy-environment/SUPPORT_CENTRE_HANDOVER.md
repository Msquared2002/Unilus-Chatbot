# Support Centre dashboard handover

The staff dashboard lives in `admin.html`, its controller is `js/admin.js`, its current mock adapter is `js/admin-ticket-service.js`, and its presentation is in `css/admin.css`. Keep the controller calling the adapter; future persistence work should replace adapter internals while preserving the methods and response shapes below. Ticket creation is owned by another developer and is outside this dashboard contract.

## Ticket record contract

`getTicket(id)` and `listTickets(options)` return a ticket with these fields:

| Field | Shape | Dashboard use |
|---|---|---|
| `id` | string | Stable ticket identifier. |
| `source` | `ai_escalation` or `student_submitted` | Source badge in the queue and details. |
| `student` | `{ name, email, programme }` | Student/request identity details. |
| `subject`, `description` | strings | Queue summary and request body. |
| `departmentId` | `academic-office`, `finance`, `ict`, `admissions`, `student-affairs`, `library`, or another string/null | Department routing and display; matches an ID from `listDepartments()`. Department role uses `finance`, `academic-office`, and `ict`. |
| `priority` | `Urgent`, `High`, `Normal`, or `Low` | Queue triage label. |
| `status` | `New`, `Assigned`, `In Progress`, `Waiting for Student`, `Resolved`, or `Closed` | Current workflow state. Transitions are validated by the adapter. |
| `assignedTo` | staff display name or `null` | Assignment UI. |
| `createdAt`, `updatedAt` | ISO 8601 timestamps | Queue and detail timestamps. |
| `conversation` | `{ role, author, body, createdAt }[]` | Student and staff-visible replies. |
| `internalNotes` | `{ author, body, createdAt }[]` | Staff-only notes. |
| `attachments` | `{ name }[]` | Current attachment display placeholder. A production response will need safe file metadata and authorized URLs. |
| `aiEscalationContext` | object or `null` | For AI escalations: `{ triggerReason, summary, confidence, reviewStatus }`; null for student-submitted tickets. |
| `aiEscalationContext.classification` | optional string | AI category shown separately from the routed department; use null when unavailable. |
| `activity` | `{ eventId, type, actor, message, visibility, createdAt }[]` | Staff timeline. `visibility` is `ticket` or `staff`. Types currently include `created`, `ai_escalated`, `assigned`, `staff_reply`, `student_reply`, `status_changed`, and `internal_note`. |

The empty adapter returns an empty activity list. A future implementation should return authoritative activity history from persisted events and append an event whenever assignment, status, or conversation changes.

The dashboard has a development-only role selector. `Super Admin` sees all departments; the Finance, Academic, and ICT roles are scoped to their configured `departmentId` values in the controller. This is a presentation simulation only. Production authorization must be enforced by the eventual service/API and must not rely on this selector or browser state.

The Departments page is an organisational directory showing unit responsibilities, active ticket counts, and an unconfigured staff count. Department-level role limits ticket and department views to the selected unit. Classification details remain visible on individual ticket details; the dashboard has no separate routing configuration page.

## Adapter methods used by the dashboard

- `getDashboard()` → `{ openTickets, assigned, waiting, resolvedToday, averageResponseTimeMinutes, recentActivity[] }`. With no ticket records, counts are zero, recent activity is empty, and response time is `null` until it can be calculated from real records.
- `listDepartments()` → `{ id, name }[]`.
- `classifyDepartment(text)` → `{ departmentId, department, departmentName, category, confidence, matchedKeywords[] }`; deterministic demo matching only, not a production AI or authorization decision.
- `listTickets({ search, status, departmentId, priority, sort, order, page, pageSize })` → `{ items, total, page, pageSize, pages }`.
- `getTicket(id)` → full ticket record or `null`.
- `getAllowedTransitions(id)` → valid next status strings for that ticket.
- `suggestDepartment(id)` → classification fields plus `departmentName` and `reason`, or null. This is a mock keyword suggestion and must not be treated as authoritative policy.
- `routeTicket(id, departmentId)` → updated ticket or null.
- `updateTicket(id, patch)` → updated ticket or null; currently accepts `status`, `departmentId`, and `assignedTo` and enforces the workflow/assignment rules.
- `addStaffReply(id, body)` → updated ticket or null.
- `addInternalNote(id, body)` → updated ticket or null.

Adapter methods reject invalid actions with an `Error` carrying a user-displayable message. The dashboard owns loading, success refresh, and error presentation. A real service should preserve these method signatures and rejection behavior, and add authorization, validation, concurrency handling, and durable audit events behind the adapter.

## Workflow enforced by the adapter

`New → Assigned → In Progress → Waiting for Student → In Progress → Resolved → Closed`. `Assigned` may also move to `Waiting for Student`; `In Progress` may move to `Resolved`; `Waiting for Student` may move to `Resolved`; `Resolved` can return to `In Progress`; and `Closed` can be reopened to `In Progress`. Entering `Assigned` or `In Progress` requires both a department and an assignee. These are development workflow rules and should be confirmed by Support Centre owners before being used as operational policy.

## Future service integration points

TODO markers are placed beside adapter operations in `js/admin-ticket-service.js`. Replace its empty reads/writes there with the approved client/service implementation. Keep API credentials, authorization, delivery, and enforcement outside page code. Do not make the UI depend on mock-only arrays or add ticket creation to this dashboard; the separate chatbot ticket submission work should produce records that satisfy the contract above.

The adapter currently starts with an empty ticket collection. Its department list, routing rules, workflow validation, contract fields, and method signatures remain available for the future service implementation.
