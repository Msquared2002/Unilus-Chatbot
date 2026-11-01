/*
Changes: Supplies dashboard and ticket operations through the in-memory contract adapter.
Affects: js/admin.js dashboard metrics, queue, details, updates, and internal notes.
Purpose: Keeps the dashboard data boundary replaceable when an approved persistent ticket API is connected.
*/
/*
Changes:
Defines the department routing catalog and keyword policy for the demo classifier.
Affects:
Department page, role filters, ticket routing suggestions, and routing overview counts.
Purpose:
Makes the AI-to-department handoff reviewable while keeping classification deterministic.
*/
const departments = [
  { id: "academic-office", name: "Academic Office", category: "Academic", keywords: ["timetable", "exam", "examination", "results", "registration", "course", "semester", "module", "transcript", "academic"] },
  { id: "finance", name: "Finance Office", category: "Finance", keywords: ["fees", "fee", "payment", "receipt", "invoice", "balance", "tuition", "clearance", "account"] },
  { id: "ict", name: "ICT Support", category: "ICT", keywords: ["password", "login", "portal", "lms", "website", "error", "technical", "account access"] },
  { id: "admissions", name: "Admissions Office", category: "Admissions", keywords: ["application", "admission", "acceptance", "requirements", "intake", "offer letter"] },
  { id: "student-affairs", name: "Student Affairs", category: "Student Affairs", keywords: ["accommodation", "hostel", "welfare", "clubs", "student life"] },
  { id: "library", name: "Library", category: "Library", keywords: ["book", "borrowing", "library", "journal", "resource"] },
];
const tickets = [];

const copy = (ticket) => ({
  ...ticket,
  student: { ...ticket.student },
  conversation: (ticket.conversation || []).map((message) => ({ ...message })),
  internalNotes: (ticket.internalNotes || []).map((note) => ({ ...note })),
  attachments: (ticket.attachments || []).map((attachment) => ({ ...attachment })),
  aiEscalationContext: ticket.aiEscalationContext ? { ...ticket.aiEscalationContext } : null,
  activity: (ticket.activity || []).map((event) => ({ ...event })),
});

const transitions = {
  New: ["Assigned"],
  Assigned: ["In Progress", "Waiting for Student"],
  "In Progress": ["Waiting for Student", "Resolved"],
  "Waiting for Student": ["In Progress", "Resolved"],
  Resolved: ["In Progress", "Closed"],
  Closed: ["In Progress"],
};

/*
Changes:
Matches student wording against department keywords and returns a confidence preview.
Affects:
Department routing page and ticket detail classification summary.
Purpose:
Demonstrates predictable frontend routing without calling an AI model.
*/
function classifyDepartment(text) {
  const normalizedText = String(text || "").toLowerCase();
  const keywordPattern = (keyword) => {
    if (keyword === "registration") return /\b(registration|register(?:ed|ing|s)?)\b/i;
    const expression = keyword.replaceAll(" ", "\\s+");
    const plural = ["course", "fee", "exam", "book"].includes(keyword) ? "s?" : "";
    return new RegExp(`\\b${expression}${plural}\\b`, "i");
  };
  const matches = departments.map((department) => ({
    department,
    matchedKeywords: department.keywords.filter((keyword) => keywordPattern(keyword).test(normalizedText)),
  })).filter((item) => item.matchedKeywords.length > 0).sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length);
  const best = matches[0];
  if (!best) return { departmentId: null, department: null, departmentName: null, category: null, confidence: "unclassified", matchedKeywords: [] };
  const confidence = best.matchedKeywords.length > 1 ? "high" : "medium";
  return { departmentId: best.department.id, department: best.department.id, departmentName: best.department.name, category: best.department.category, confidence, matchedKeywords: best.matchedKeywords };
}

function suggestDepartment(ticket) {
  const classification = classifyDepartment(`${ticket.subject} ${ticket.description}`);
  if (!classification.departmentId) return { ...classification, departmentName: null, reason: "No routing rule matched. Please choose a department." };
  return { ...classification, reason: `Matched ${classification.matchedKeywords.join(", ")} for ${classification.departmentName}.` };
}

function findTicket(id) {
  return tickets.find((ticket) => ticket.id === id);
}

function recordActivity(ticket, type, message, actor = "Support Staff", visibility = "ticket") {
  const index = ticket.activity.length + 1;
  ticket.activity.push({ eventId: `${ticket.id}-event-${index}`, type, actor, message, visibility, createdAt: new Date().toISOString() });
}

function validateTicketUpdate(ticket, patch) {
  if (patch.status && patch.status !== ticket.status && !transitions[ticket.status]?.includes(patch.status)) {
    throw new Error(`Status cannot move from ${ticket.status} to ${patch.status}.`);
  }
  if (patch.departmentId && !departments.some((department) => department.id === patch.departmentId)) {
    throw new Error("Choose a valid department before saving.");
  }
  const nextStatus = patch.status || ticket.status;
  const nextAssignee = Object.hasOwn(patch, "assignedTo") ? patch.assignedTo : ticket.assignedTo;
  const nextDepartment = Object.hasOwn(patch, "departmentId") ? patch.departmentId : ticket.departmentId;
  if (["Assigned", "In Progress"].includes(nextStatus) && (!nextAssignee || !nextDepartment)) {
    throw new Error("Assign the ticket to a staff member and department before starting work.");
  }
}

export const ticketService = {
  // Deterministic classifier for the routing demonstration; production classification belongs behind this adapter.
  async classifyDepartment(text) { return classifyDepartment(text); },
  // TODO(API): Replace empty metrics with server-computed values; retain this response shape for admin.js.
  async getDashboard() {
    const open = tickets.filter((ticket) => !["Resolved", "Closed"].includes(ticket.status));
    return {
      openTickets: open.length,
      assigned: tickets.filter((ticket) => ticket.assignedTo && ticket.status === "Assigned").length,
      waiting: tickets.filter((ticket) => ticket.status === "Waiting for Student").length,
      resolvedToday: 0,
      averageResponseTimeMinutes: null,
      recentActivity: [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
        .map(({ id, subject, status, updatedAt }) => ({ ticketId: id, subject, status, updatedAt })),
    };
  },
  // TODO(API): Return the department IDs and labels used by the dashboard filters and ticket routing controls.
  async listDepartments() { return departments.map((department) => ({ ...department })); },
  // TODO(API): Implement the same filters, sort keys, and pagination on the service side.
  async listTickets(options = {}) {
    const query = String(options.search || "").toLowerCase();
    const rows = tickets.filter((ticket) =>
      (!query || [ticket.id, ticket.subject, ticket.student.name, ticket.student.email, ticket.departmentId, ticket.assignedTo]
        .some((value) => String(value || "").toLowerCase().includes(query))) &&
      (!options.status || ticket.status === options.status) &&
      (!options.departmentId || ticket.departmentId === options.departmentId) &&
      (!options.priority || ticket.priority === options.priority));
    const direction = options.order === "asc" ? 1 : -1;
    const sortKey = options.sort || "createdAt";
    rows.sort((a, b) => String(a[sortKey] || "").localeCompare(String(b[sortKey] || "")) * direction);
    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.max(1, Number(options.pageSize) || 10);
    return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(copy), total: rows.length, page, pageSize, pages: Math.max(1, Math.ceil(rows.length / pageSize)) };
  },
  // TODO(API): Return the complete detail contract, including activity and AI escalation context.
  async getTicket(id) { const ticket = findTicket(id); return ticket ? copy(ticket) : null; },
  async getAllowedTransitions(id) {
    const ticket = findTicket(id);
    return ticket ? [...(transitions[ticket.status] || [])] : [];
  },
  async suggestDepartment(id) {
    const ticket = findTicket(id);
    return ticket ? suggestDepartment(ticket) : null;
  },
  async routeTicket(id, departmentId) {
    const ticket = findTicket(id);
    if (!ticket) return null;
    if (!departments.some((department) => department.id === departmentId)) throw new Error("Choose a valid department before routing.");
    const previousDepartment = ticket.departmentId;
    ticket.departmentId = departmentId;
    ticket.updatedAt = new Date().toISOString();
    if (previousDepartment !== departmentId) recordActivity(ticket, "assigned", `Routed to ${departments.find((item) => item.id === departmentId)?.name || departmentId}.`);
    return copy(ticket);
  },
  // TODO(API): Persist validated changes and append corresponding audit/activity events.
  async updateTicket(id, patch) {
    const ticket = findTicket(id);
    if (!ticket) return null;
    validateTicketUpdate(ticket, patch);
    const previous = { status: ticket.status, departmentId: ticket.departmentId, assignedTo: ticket.assignedTo };
    Object.assign(ticket, patch, { updatedAt: new Date().toISOString() });
    if (previous.status !== ticket.status) recordActivity(ticket, "status_changed", `Status changed from ${previous.status} to ${ticket.status}.`);
    if (previous.assignedTo !== ticket.assignedTo || previous.departmentId !== ticket.departmentId) recordActivity(ticket, "assigned", `Assignment updated${ticket.assignedTo ? ` to ${ticket.assignedTo}` : ""}${ticket.departmentId ? ` · ${departments.find((item) => item.id === ticket.departmentId)?.name || ticket.departmentId}` : ""}.`);
    return copy(ticket);
  },
  // TODO(API): Persist staff-only notes with visibility enforced by the future service.
  async addInternalNote(id, body) {
    const ticket = findTicket(id);
    if (!ticket) return null;
    const text = String(body || "").trim();
    if (!text) throw new Error("Enter a note before saving.");
    if (["Resolved", "Closed"].includes(ticket.status)) throw new Error("Reopen this ticket before adding an internal note.");
    ticket.internalNotes.push({ body: text, author: "Support Staff", createdAt: new Date().toISOString() });
    ticket.updatedAt = new Date().toISOString();
    recordActivity(ticket, "internal_note", text, "Support Staff", "staff");
    return copy(ticket);
  },
  // TODO(API): Deliver the reply through the approved support channel and append it to ticket activity.
  async addStaffReply(id, body) {
    const ticket = findTicket(id);
    if (!ticket) return null;
    const text = String(body || "").trim();
    if (!text) throw new Error("Enter a reply before sending.");
    if (["Resolved", "Closed"].includes(ticket.status)) throw new Error("Reopen this ticket before replying to the student.");
    if (ticket.status === "Waiting for Student") {
      validateTicketUpdate(ticket, { status: "In Progress" });
      const previousStatus = ticket.status;
      ticket.status = "In Progress";
      recordActivity(ticket, "status_changed", `Status changed from ${previousStatus} to ${ticket.status}.`);
    }
    const now = new Date().toISOString();
    ticket.conversation.push({ role: "staff", author: "Support Staff", body: text, createdAt: now });
    ticket.updatedAt = now;
    recordActivity(ticket, "staff_reply", text);
    return copy(ticket);
  },
};
