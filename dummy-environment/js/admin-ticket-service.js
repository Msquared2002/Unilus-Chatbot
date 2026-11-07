/*
Changes: Live adapter. Reads and updates tickets through the UNILUS backend (/api/admin/...).
Affects: js/admin.js. The exported ticketService keeps the same method names and ticket shape as the old demo adapter.
Purpose: Shows the real tickets the chatbot creates, and adds the "teach the chatbot" tools (ticketService.faq).
*/

// Backend address. Same origin when the page is served by the backend (port 5000); otherwise localhost:5000.
// Override by setting window.UNILUS_API_BASE before this module loads.
const API = window.UNILUS_API_BASE || (location.port === "5000" ? `${location.origin}/api` : "http://localhost:5000/api");
const KEY = "unilusAdminKey";
const NOT_YET = "The backend does not save this yet. Status changes and saved answers are saved.";

/* ---------------- Department catalogue and keyword routing (unchanged) ---------------- */
const departments = [
  { id: "academic-office", name: "Academic Office", category: "Academic", keywords: ["timetable", "exam", "examination", "results", "registration", "course", "semester", "module", "transcript", "academic"] },
  { id: "finance", name: "Finance Office", category: "Finance", keywords: ["fees", "fee", "payment", "receipt", "invoice", "balance", "tuition", "clearance", "account"] },
  { id: "ict", name: "ICT Support", category: "ICT", keywords: ["password", "login", "portal", "lms", "website", "error", "technical", "account access"] },
  { id: "admissions", name: "Admissions Office", category: "Admissions", keywords: ["application", "admission", "acceptance", "requirements", "intake", "offer letter"] },
  { id: "student-affairs", name: "Student Affairs", category: "Student Affairs", keywords: ["accommodation", "hostel", "welfare", "clubs", "student life"] },
  { id: "library", name: "Library", category: "Library", keywords: ["book", "borrowing", "library", "journal", "resource"] },
];

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

/* ---------------- Backend <-> panel mapping ---------------- */
// The backend tracks four statuses; the panel shows them with these labels.
const FROM_API = { Open: "New", "In Progress": "In Progress", Resolved: "Resolved", Closed: "Closed" };
const TO_API = { New: "Open", "In Progress": "In Progress", Resolved: "Resolved", Closed: "Closed" };
const transitions = {
  New: ["In Progress", "Resolved"],
  "In Progress": ["Resolved"],
  Resolved: ["In Progress", "Closed"],
  Closed: ["In Progress"],
};
const PRIORITY = { Critical: "Urgent", High: "High", Medium: "Normal", Low: "Low" };
const DEPARTMENT_IDS = {
  "academic office": "academic-office", registry: "academic-office",
  "finance office": "finance", finance: "finance",
  "ict support": "ict", ict: "ict",
  "admissions office": "admissions", admissions: "admissions",
  "student affairs": "student-affairs", library: "library",
};
const toDepartmentId = (name) => DEPARTMENT_IDS[String(name || "").toLowerCase()] || null;
const short = (text) => (String(text).length > 90 ? `${String(text).slice(0, 89)}…` : String(text));

function shape(row) {
  const status = FROM_API[row.status] || row.status;
  const activity = [{ eventId: `${row.ref}-escalated`, type: "ai_escalated", actor: "UNILUS chatbot", message: `Escalated under ${row.category}.`, visibility: "ticket", createdAt: row.created_at }];
  if (row.updated_at && row.updated_at !== row.created_at) {
    activity.push({ eventId: `${row.ref}-status`, type: "status_changed", actor: "Support Staff", message: `Status is now ${status}.`, visibility: "ticket", createdAt: row.updated_at });
  }
  return {
    id: row.ref,
    subject: short(row.question),
    description: row.question,
    source: "ai_escalation",
    priority: PRIORITY[row.priority] || "Normal",
    status,
    departmentId: toDepartmentId(row.department),
    assignedTo: null,
    student: { name: "Chat student", email: "Not captured by the chatbot", programme: "Not provided" },
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    conversation: [{ role: "student", author: "Student (via chatbot)", body: row.question, createdAt: row.created_at }],
    internalNotes: [],
    attachments: [],
    aiEscalationContext: {
      classification: row.category,
      confidence: "Not scored",
      triggerReason: "The chatbot found no reliable answer in the approved UNILUS sources.",
      summary: row.summary,
      reviewStatus: status,
    },
    activity,
  };
}

/* ---------------- HTTP ---------------- */
async function api(path, options = {}) {
  const { rawBody, ...rest } = options; // rawBody: send a file as-is (document upload)
  const response = await fetch(API + path, {
    ...rest,
    headers: { "Content-Type": rawBody ? "application/octet-stream" : "application/json", "x-admin-key": sessionStorage.getItem(KEY) || "" },
  });
  if (response.status === 401) {
    sessionStorage.removeItem(KEY);
    const error = new Error("Sign in again to continue.");
    error.code = "SIGN_IN";
    throw error;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || response.statusText);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

let cache = { at: 0, rows: [] };
async function allTickets() {
  if (Date.now() - cache.at < 3000) return cache.rows;
  const rows = (await api("/admin/tickets?limit=200")).map(shape);
  cache = { at: Date.now(), rows };
  return rows;
}
const clearCache = () => { cache.at = 0; };

async function fetchTicket(id) {
  try { return shape(await api(`/admin/tickets/${encodeURIComponent(id)}`)); }
  catch (error) { if (error.status === 404) return null; throw error; }
}

export const ticketService = {
  /* sign-in (shared admin key from backend/.env) */
  isSignedIn() { return Boolean(sessionStorage.getItem(KEY)); },
  async signIn(key) {
    sessionStorage.setItem(KEY, key);
    try { await api("/admin/stats"); }
    catch (error) {
      sessionStorage.removeItem(KEY);
      if (error.code === "SIGN_IN") throw new Error("That key is not accepted. Check ADMIN_API_KEY in backend/.env.");
      throw error;
    }
  },
  signOut() { sessionStorage.removeItem(KEY); clearCache(); },
  stats: () => api("/admin/stats"),

  /* Knowledge base: documents the chatbot answers from */
  knowledge: {
    status: () => api("/admin/knowledge"),
    upload: (file, { access = "restricted", title = "" } = {}) =>
      api(`/admin/documents?filename=${encodeURIComponent(file.name)}&access=${encodeURIComponent(access)}${title ? `&title=${encodeURIComponent(title)}` : ""}`, { method: "POST", body: file, rawBody: true }),
    remove: (name) => api(`/admin/documents/${encodeURIComponent(name)}`, { method: "DELETE" }),
    refreshWebsite: () => api("/admin/knowledge/refresh-website", { method: "POST" }),
  },

  /* same contract the dashboard already uses */
  async classifyDepartment(text) { return classifyDepartment(text); },
  async getDashboard() { return { averageResponseTimeMinutes: null }; },
  async listDepartments() { return departments.map((department) => ({ ...department })); },

  async listTickets(options = {}) {
    const query = String(options.search || "").toLowerCase();
    const rows = (await allTickets()).filter((ticket) =>
      (!query || [ticket.id, ticket.subject, ticket.student.name, ticket.departmentId].some((value) => String(value || "").toLowerCase().includes(query))) &&
      (!options.status || (options.status === "__open" ? !["Resolved", "Closed"].includes(ticket.status) : ticket.status === options.status)) &&
      (!options.departmentId || (options.departmentId === "__none" ? !ticket.departmentId : ticket.departmentId === options.departmentId)) &&
      (!options.priority || (options.priority === "__high" ? ["High", "Urgent"].includes(ticket.priority) : ticket.priority === options.priority)));
    const direction = options.order === "asc" ? 1 : -1;
    const sortKey = options.sort || "createdAt";
    rows.sort((a, b) => String(a[sortKey] || "").localeCompare(String(b[sortKey] || "")) * direction);
    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.max(1, Number(options.pageSize) || 10);
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, pages: Math.max(1, Math.ceil(rows.length / pageSize)) };
  },

  async getTicket(id) { return fetchTicket(id); },
  async getAllowedTransitions(id) { const ticket = await fetchTicket(id); return ticket ? [...(transitions[ticket.status] || [])] : []; },
  async suggestDepartment(id) { const ticket = await fetchTicket(id); return ticket ? suggestDepartment(ticket) : null; },

  async updateTicket(id, patch) {
    const ticket = await fetchTicket(id);
    if (!ticket) return null;
    const departmentChanged = (patch.departmentId || null) !== (ticket.departmentId || null);
    const assigneeChanged = (patch.assignedTo || null) !== (ticket.assignedTo || null);
    if (departmentChanged || assigneeChanged) throw new Error(`Re-routing and assigning officers are not available yet. ${NOT_YET}`);
    if (patch.status && patch.status !== ticket.status) {
      if (!transitions[ticket.status]?.includes(patch.status)) throw new Error(`Status cannot move from ${ticket.status} to ${patch.status}.`);
      const updated = shape(await api(`/admin/tickets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: TO_API[patch.status] }) }));
      clearCache();
      return updated;
    }
    return ticket;
  },
  async routeTicket() { throw new Error(`Routing is not available yet. ${NOT_YET}`); },
  async addInternalNote() { throw new Error(`Internal notes are not available yet. ${NOT_YET}`); },
  async addStaffReply() { throw new Error(`Replies to students are not available yet. ${NOT_YET}`); },

  /* "Teach the chatbot": recurring questions and staff-approved answers */
  faq: {
    recurring: () => api("/admin/recurring"),
    answers: () => api("/admin/answers"),
    async saveAnswer(body) { const result = await api("/admin/answers", { method: "POST", body: JSON.stringify(body) }); clearCache(); return result; },
    setAnswerVisibility: (id, visibility) => api(`/admin/answers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ visibility }) }),
    setAnswerActive: (id, active) => api(`/admin/answers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    deleteAnswer: (id) => api(`/admin/answers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
};
