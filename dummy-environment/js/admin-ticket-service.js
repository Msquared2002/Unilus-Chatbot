/*
Changes: Live adapter. Reads and updates tickets through the UNILUS backend (/api/admin/...).
Affects: js/admin.js. The exported ticketService keeps the same method names and ticket shape as the old demo adapter.
Purpose: Shows the real tickets the chatbot creates, and adds the "teach the chatbot" tools (ticketService.faq).
*/

// Backend address. Same origin when the page is served by the backend (port 5000); otherwise localhost:5000.
// Override by setting window.UNILUS_API_BASE before this module loads.
const API = window.UNILUS_API_BASE || "/api";
const KEY = "unilusAdminKey";
const NOT_YET = "The backend does not save this yet. Status changes and saved answers are saved.";

/* ---------------- Department catalogue and keyword routing (unchanged) ---------------- */
import './support-departments.js';
const {departments,classifyDepartment}=globalThis.UnilusSupportDirectory;
function suggestDepartment(ticket) {
  const classification = classifyDepartment(`${ticket.subject} ${ticket.description}`);
  if (!classification.departmentId) return { ...classification, departmentName: null, reason: "No routing rule matched. Please choose a department." };
  return { ...classification, reason: `Matched ${classification.matchedKeywords.join(", ")} for ${classification.departmentName}.` };
}

/* ---------------- Backend <-> panel mapping ---------------- */
// The backend tracks four statuses; the panel shows them with these labels.
const FROM_API = { Open: "Open", "In Progress": "In Progress", Resolved: "Resolved", Closed: "Closed" };
const TO_API = { Open: "Open", "In Progress": "In Progress", Resolved: "Resolved", Closed: "Closed" };
const transitions = {
  Open: ["In Progress", "Resolved"],
  "In Progress": ["Resolved"],
  Resolved: ["In Progress", "Closed"],
  Closed: ["In Progress"],
};
const PRIORITY = { Critical: "Urgent", High: "High", Medium: "Medium", Low: "Low" };
const toDepartmentId = name=>globalThis.UnilusSupportDirectory.normalize(name)?.id||null;
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
    priority: PRIORITY[row.priority] || "Medium",
    status,
    departmentId: toDepartmentId(row.department),
    assignedTo: row.assignedTo || null,
    student: { name: row.student_username || "Guest / legacy ticket", email: row.student_email || "Not provided", phone:row.student_phone || "Not provided", programme: "Not provided" },
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    conversation: (row.history || []).map(m=>({role:m.role,author:m.role,body:m.content,createdAt:row.created_at})).concat((row.events||[]).filter(e=>e.kind==="reply").map(e=>({role:"staff",author:e.actor,body:e.body,createdAt:e.created_at}))),
    internalNotes: (row.events||[]).filter(e=>e.kind==="note").map(e=>({author:e.actor,body:e.body,createdAt:e.created_at})),
    attachments: row.attachments || [],
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
    headers: { "Content-Type": rawBody ? "application/octet-stream" : "application/json", Authorization: "Bearer "+(sessionStorage.getItem("unilusStaffToken") || "") },
  });
  if (response.status === 401) {
    sessionStorage.removeItem(KEY);sessionStorage.removeItem("unilusStaffToken");
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
  identity: async () => (await api("/auth/me")).user,
  isSignedIn() { return Boolean(sessionStorage.getItem('unilusStaffToken')); },
  async signIn(username,password) {
    const response=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const body=await response.json();
    if(!response.ok||!['staff','admin'].includes(body.user?.role))throw Error(body.error || 'Staff account required');
    sessionStorage.setItem('unilusStaffToken',body.token);
  },
  signOut(){sessionStorage.removeItem('unilusStaffToken');sessionStorage.removeItem(KEY);clearCache();},
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

  async downloadAttachment(ref,id){const r=await fetch(API+'/admin/tickets/'+encodeURIComponent(ref)+'/attachments/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+(sessionStorage.getItem('unilusStaffToken')||'')}});if(!r.ok)throw Error('Attachment unavailable');return r.blob();},
  async getTicket(id) { return fetchTicket(id); },
  async getAllowedTransitions(id) { const ticket = await fetchTicket(id); return ticket ? [...(transitions[ticket.status] || [])] : []; },
  async suggestDepartment(id) { const ticket = await fetchTicket(id); return ticket ? suggestDepartment(ticket) : null; },

  async updateTicket(id, patch) {
    const ticket = await fetchTicket(id);
    if (!ticket) return null;
    const departmentChanged = (patch.departmentId || null) !== (ticket.departmentId || null);
    const assigneeChanged = (patch.assignedTo || null) !== (ticket.assignedTo || null);
    if(departmentChanged||assigneeChanged){await api(`/admin/tickets/${encodeURIComponent(id)}/assignment`,{method:"POST",body:JSON.stringify({department:departments.find(d=>d.id===patch.departmentId)?.name || patch.departmentId,assignee:patch.assignedTo})});clearCache();}
    if (patch.status && patch.status !== ticket.status) {
      if (!transitions[ticket.status]?.includes(patch.status)) throw new Error(`Status cannot move from ${ticket.status} to ${patch.status}.`);
      const updated = shape(await api(`/admin/tickets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: TO_API[patch.status] }) }));
      clearCache();
      return updated;
    }
    return ticket;
  },
  async routeTicket(id,departmentId) { const ticket=await fetchTicket(id);return this.updateTicket(id,{departmentId,assignedTo:ticket?.assignedTo,status:ticket?.status}); },
  async addInternalNote(id,body) { return api(`/admin/tickets/${encodeURIComponent(id)}/events`,{method:"POST",body:JSON.stringify({kind:"note",body})}); },
  async addStaffReply(id,body) { return api(`/admin/tickets/${encodeURIComponent(id)}/events`,{method:"POST",body:JSON.stringify({kind:"reply",body})}); },

  /* "Teach the chatbot": recurring questions and staff-approved answers */
  faq: {
    feedback: () => api('/admin/feedback'),
    reviewFeedback: id => api('/admin/feedback/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({reviewed:true})}),
    recurring: () => api("/admin/recurring"),
    answers: () => api("/admin/answers"),
    async saveAnswer(body) { const result = await api("/admin/answers", { method: "POST", body: JSON.stringify(body) }); clearCache(); return result; },
    setAnswerVisibility: (id, visibility) => api(`/admin/answers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ visibility }) }),
    setAnswerActive: (id, active) => api(`/admin/answers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    deleteAnswer: (id) => api(`/admin/answers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
};
