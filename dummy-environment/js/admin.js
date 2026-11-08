/*
Changes: Renders the Support Centre dashboard, ticket queue, and ticket details.
Affects: admin.html views and the ticketService data boundary.
Purpose: Keeps page navigation and user actions in the dashboard controller.
*/
import { ticketService } from "./admin-ticket-service.js";

const app = document.querySelector("#app");
const statuses = ["New", "In Progress", "Resolved", "Closed"];
/*
Changes:
Adds development role.
Affects:
Support Centre dashboard filtering.
Purpose:
Demonstrates department-level access views before production staff login integration.
*/
const roleViews = {
  superAdmin: { label: "Super Admin", departmentId: null },
  academicOffice: { label: "Academic Office", departmentId: "academic-office" },
  financeOffice: { label: "Finance Office", departmentId: "finance" },
  ictSupport: { label: "ICT Support", departmentId: "ict" },
  admissionsOffice: { label: "Admissions Office", departmentId: "admissions" },
  studentAffairs: { label: "Student Affairs", departmentId: "student-affairs" },
  library: { label: "Library", departmentId: "library" },
};
let selectedRole = sessionStorage.getItem("supportCentreRole") || "superAdmin";
if (!roleViews[selectedRole]) selectedRole = "superAdmin";
let page = 1;
let departments = [];
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateTime = value => new Date(value).toLocaleString("en-ZM", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const dateOnly = value => new Date(value).toLocaleDateString("en-ZM", {day:"numeric",month:"short",year:"numeric"});
const deptName = id => departments.find(d => d.id === id)?.name || "Unassigned";
function heading(title, subtitle, action = "") { return `<div class="page-heading"><div><div class="eyebrow">University of Lusaka · Support Centre</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
function statusPill(status) { return `<span class="status-pill" data-status="${escapeHtml(status)}">${escapeHtml(status)}</span>`; }
function sourcePill(source) { const aiEscalation = source === "ai_escalation"; return `<span class="source-pill" data-source="${aiEscalation ? "ai" : "student"}">${aiEscalation ? "AI escalation" : "Student submitted"}</span>`; }
function timelineLabel(type) { return ({created:"Ticket created",ai_escalated:"AI escalation",assigned:"Assignment updated",staff_reply:"Staff reply",student_reply:"Student reply",status_changed:"Status changed",internal_note:"Internal note"})[type] || "Ticket activity"; }
function empty(text) { return `<div class="queue-empty">${text}</div>`; }

/*
Changes:
Filters Support Centre records based on simulated department role.
Affects:
Ticket queue and dashboard summaries.
Purpose:
Represents future authenticated department staff permissions.
*/
function scopedDepartmentId() { return roleViews[selectedRole].departmentId; }
async function visibleTickets() {
  const departmentId = scopedDepartmentId();
  const items = [];
  let pageNumber = 1;
  let pages = 1;
  do {
    const result = await ticketService.listTickets({ departmentId: departmentId || "", page: pageNumber, pageSize: 100, sort: "updatedAt", order: "desc" });
    items.push(...result.items);
    pages = result.pages || 1;
    pageNumber += 1;
  } while (pageNumber <= pages);
  return items;
}

async function dashboard() {
  app.innerHTML = `<section class="panel loading-state" role="status">Loading Support Centre overview…</section>`;
  departments = await ticketService.listDepartments();
  const [data, tickets] = await Promise.all([ticketService.getDashboard(), visibleTickets()]);
  const isAdmin = !scopedDepartmentId();
  const openTickets = tickets.filter(t => !["Resolved", "Closed"].includes(t.status)).length;
  const highOpen = tickets.filter(t => !["Resolved", "Closed"].includes(t.status) && ["High", "Urgent"].includes(t.priority)).length;
  const unrouted = tickets.filter(t => !t.departmentId && !["Resolved", "Closed"].includes(t.status)).length;
  const today = new Date().toDateString();
  const resolvedToday = tickets.filter(t => t.status === "Resolved" && new Date(t.updatedAt).toDateString() === today).length;
  const activities = tickets.flatMap(t => (t.activity || []).filter(event => event.visibility !== "staff").map(event => ({ ...event, ticketId: t.id, subject: t.subject, status: t.status }))).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5);
  const responseTime = isAdmin ? data.averageResponseTimeMinutes : null;
  const routingOverview = `<section class="panel routing-overview"><div class="panel-heading"><div><h2>Routing Overview</h2><p class="panel-subtitle">Current ticket volume by routed department</p></div></div><div class="routing-overview__grid">${departments.map(d=>`<div class="routing-overview__item"><strong>${escapeHtml(d.name)}</strong><span>${tickets.filter(t=>t.departmentId===d.id).length} tickets</span></div>`).join("")}<div class="routing-overview__item"><strong>Unrouted</strong><span>${tickets.filter(t=>!t.departmentId).length} tickets</span></div></div></section>`;
  app.innerHTML = heading("Dashboard", "An overview of student support requests.", '<a class="text-link" href="#tickets">View all tickets →</a>') +
  `<div class="metric-grid">
    <div class="metric-card is-link" data-preset='{}' tabindex="0" role="link"><span class="metric-icon">▤</span><span class="metric-label">${isAdmin ? "All Tickets" : "Department Tickets"}</span><strong class="metric-value">${tickets.length}</strong><small class="metric-foot">${escapeHtml(roleViews[selectedRole].label)} view</small></div>
    <div class="metric-card is-link" data-preset='{"status":"__open"}' tabindex="0" role="link"><span class="metric-icon">▤</span><span class="metric-label">Open Tickets</span><strong class="metric-value">${openTickets}</strong><small class="metric-foot">Awaiting completion</small></div>
    <div class="metric-card is-link" data-preset='{"status":"__open","priority":"__high"}' tabindex="0" role="link"><span class="metric-icon">!</span><span class="metric-label">High Priority</span><strong class="metric-value">${highOpen}</strong><small class="metric-foot">Open and urgent or high</small></div>
    <div class="metric-card is-link" data-preset='{"status":"__open","department":"__none"}' tabindex="0" role="link"><span class="metric-icon">⌂</span><span class="metric-label">Unrouted</span><strong class="metric-value">${unrouted}</strong><small class="metric-foot">Open, no department yet</small></div>
    <div class="metric-card is-link" data-preset='{"status":"Resolved"}' tabindex="0" role="link"><span class="metric-icon">✓</span><span class="metric-label">Resolved Today</span><strong class="metric-value">${resolvedToday}</strong><small class="metric-foot">Completed today</small></div>
    <div class="metric-card"><span class="metric-icon">◴</span><span class="metric-label">Avg. Response Time</span><strong class="metric-value">${responseTime == null ? "—" : `${responseTime}m`}</strong><small class="metric-foot">${responseTime == null ? "Not calculated yet" : "First staff response"}</small></div>
  </div>
  ${routingOverview}
  <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Recent Activity</h2><p class="panel-subtitle">Latest updates from the support queue</p></div><a class="text-link" href="#tickets">All tickets</a></div><div class="activity-list">${activities.length ? activities.map(event => `<div class="activity-row"><div class="activity-summary"><strong><a class="text-link" href="#ticket/${encodeURIComponent(event.ticketId)}">${escapeHtml(event.ticketId)}</a> · ${escapeHtml(event.subject)}</strong><small>${escapeHtml(timelineLabel(event.type))} · ${dateTime(event.createdAt)}</small></div>${statusPill(event.status)}</div>`).join("") : empty("No recent activity yet.")}</div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Support Workflow</h2><p class="panel-subtitle">A simple guide to handling enquiries</p></div></div><ol class="guide-list"><li><span class="guide-number">1</span><span>Review new enquiries and confirm the correct department.</span></li><li><span class="guide-number">2</span><span>Assign the request and update its status as work progresses.</span></li><li><span class="guide-number">3</span><span>Record staff updates in the conversation timeline.</span></li></ol><a class="button-secondary" href="#tickets">Open Ticket Queue</a></section></div>`;
  wirePresetCards();
}

async function renderQueue() {
  const results = app.querySelector("[data-results]");
  if (!results) return;
  results.innerHTML = `<div class="loading-state" role="status">Loading tickets…</div>`;
  const controls = app.querySelector(".queue-controls");
  const sort = controls.querySelector('[name="sort"]').value;
  let result;
  try {
    result = await ticketService.listTickets({search:controls.querySelector('[name="search"]').value,status:controls.querySelector('[name="status"]').value,departmentId:scopedDepartmentId() || controls.querySelector('[name="department"]').value,priority:controls.querySelector('[name="priority"]').value,sort,order:sort === "createdAt" ? "desc" : "asc",page,pageSize:8});
  } catch (error) {
    results.innerHTML = `<div class="error-state" role="alert"><strong>Ticket queue unavailable.</strong><p>${escapeHtml(error.message)}</p><button class="button-secondary" type="button" data-retry-queue>Try again</button></div>`;
    results.querySelector("[data-retry-queue]").addEventListener("click", renderQueue);
    return;
  }
  const hasFilters = Boolean(scopedDepartmentId() || controls.querySelector("[name=search]").value || controls.querySelector("[name=status]").value || controls.querySelector("[name=department]").value || controls.querySelector("[name=priority]").value);
  results.innerHTML = `<div class="table-wrap"><table class="ticket-table"><thead><tr><th>Ticket ID</th><th>Source</th><th>Student</th><th>Subject</th><th>Department</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Created</th></tr></thead><tbody>${result.items.length ? result.items.map(t => `<tr data-ticket="${encodeURIComponent(t.id)}"><td>${escapeHtml(t.id)}</td><td>${sourcePill(t.source)}</td><td class="student-cell"><strong>${escapeHtml(t.student.name)}</strong><small>${escapeHtml(t.student.programme)}</small></td><td>${escapeHtml(t.subject)}</td><td>${escapeHtml(deptName(t.departmentId))}</td><td><span class="priority" data-priority="${escapeHtml(t.priority)}">${escapeHtml(t.priority)}</span></td><td>${statusPill(t.status)}</td><td>${escapeHtml(t.assignedTo || "Unassigned")}</td><td>${dateOnly(t.createdAt)}</td></tr>`).join("") : `<tr><td colspan="9"><div class="queue-empty">${hasFilters ? "No tickets match the selected filters." : "No tickets are available yet."}${hasFilters ? `<button class="button-secondary" type="button" data-clear-filters>Clear filters</button>` : ""}</div></td></tr>`}</tbody></table></div><div class="pagination"><span>${result.total} tickets · Page ${result.page} of ${result.pages}</span><span><button data-page="prev" ${page<=1?"disabled":""}>← Previous</button> <button data-page="next" ${page>=result.pages?"disabled":""}>Next →</button></span></div>`;
  app.querySelectorAll("[data-ticket]").forEach(row => { row.tabIndex = 0; row.addEventListener("click", () => location.hash = "ticket/" + row.dataset.ticket); row.addEventListener("keydown", e => { if (e.key === "Enter") location.hash = "ticket/" + row.dataset.ticket; }); });
  app.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => { page += button.dataset.page === "next" ? 1 : -1; renderQueue(); }));
  results.querySelector("[data-clear-filters]")?.addEventListener("click", () => { controls.querySelectorAll("input,select").forEach((control) => { control.value = control.name === "sort" ? "createdAt" : ""; }); page = 1; renderQueue(); });
}

async function ticketsPage() {
  app.innerHTML = `<section class="panel loading-state" role="status">Loading ticket queue…</section>`;
  departments = await ticketService.listDepartments();
  const departmentId = scopedDepartmentId();
  app.innerHTML = heading("Tickets", "Search, review and manage student support requests.") +
  `<section class="panel"><div class="status-chips" data-chips></div><div class="queue-controls"><input name="search" type="search" placeholder="Search ticket, student or subject" aria-label="Search tickets"><select name="status" aria-label="Filter by status"><option value="">All statuses</option><option value="__open">Open (not finished)</option>${statuses.map(s=>`<option>${s}</option>`).join("")}</select><select name="department" aria-label="Filter by department" ${departmentId?"disabled":""}><option value="">All departments</option>${departmentId ? "" : '<option value="__none">Unrouted</option>'}${departments.filter(d=>!departmentId||d.id===departmentId).map(d=>`<option value="${d.id}" ${d.id===departmentId?"selected":""}>${escapeHtml(d.name)}</option>`).join("")}</select><select name="priority" aria-label="Filter by priority"><option value="">All priorities</option><option value="__high">High + Urgent</option><option>Urgent</option><option>High</option><option>Normal</option><option>Low</option></select><select name="sort" aria-label="Sort tickets"><option value="createdAt">Newest first</option><option value="updatedAt">Recently updated</option><option value="subject">Subject A–Z</option></select></div><div data-results></div></section>`;
  app.querySelectorAll(".queue-controls input,.queue-controls select").forEach(control => control.addEventListener(control.tagName === "INPUT" ? "input" : "change", () => {page=1;renderQueue();}));
  applyPreset();
  await renderChips();
  await renderQueue();
}

/*
Changes:
Renders department routing rules and a text-based classifier preview.
Affects:
The Support Centre Departments navigation page.
Purpose:
Shows how student wording maps to a department without creating another dashboard.
*/
async function departmentsPage() {
  const [units, ticketRows] = await Promise.all([ticketService.listDepartments(), visibleTickets()]);
  let knowledgeDocs = [];
  try { knowledgeDocs = (await ticketService.knowledge.status()).documents || []; } catch { /* counts are optional */ }
  const docCount = unit => knowledgeDocs.filter(d => (d.upload?.title || "").startsWith(unit.name + TITLE_SEP)).length;
  const visibleUnits = scopedDepartmentId() ? units.filter(unit => unit.id === scopedDepartmentId()) : units;
  const responsibilities = {
    "academic-office": "Academic enquiries, registration, examinations, results, transcripts, and timetables.",
    finance: "Student fees, payments, statements, balances, and clearance.",
    ict: "Student portal, LMS, login issues, and technical support.",
    admissions: "Applications, admission requirements, acceptance letters, and intake enquiries.",
    "student-affairs": "Student welfare, accommodation, clubs, and campus life.",
    library: "Library access, borrowing, journals, and learning resources.",
  };
  app.innerHTML = heading("Departments", "University support units and the responsibilities they handle.") +
    `<div class="department-directory">${visibleUnits.map(unit=>`<article class="panel department-card is-link" data-dept="${unit.id}" tabindex="0" role="link" aria-label="View ${escapeHtml(unit.name)} tickets"><div class="department-card__heading"><h2>${escapeHtml(unit.name)}</h2></div><div class="department-card__field"><strong>Responsibility</strong><p>${escapeHtml(responsibilities[unit.id] || `${unit.name} student support enquiries.`)}</p></div><div class="department-card__stats has-docs"><div><strong>Active tickets</strong><span>${ticketRows.filter(ticket=>ticket.departmentId===unit.id&&!['Resolved','Closed'].includes(ticket.status)).length}</span></div><div><strong>Assigned staff</strong><span>Not configured yet</span></div><div><strong>Knowledge items</strong><span>${docCount(unit)}</span></div></div><div class="department-card__actions"><button class="button-primary" type="button" data-add-info="${unit.id}">Add information</button><button class="button-secondary" type="button" data-view-docs="${unit.id}">View documents</button></div></article>`).join("")}</div>`;

  // The whole card opens that department's tickets.
  app.querySelectorAll("[data-dept]").forEach(card => {
    const go = () => { sessionStorage.setItem("ticketPreset", JSON.stringify({ department: card.dataset.dept })); location.hash = "tickets"; };
    card.addEventListener("click", go);
    card.addEventListener("keydown", e => { if (e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); go(); } });
  });
  // The buttons open the Knowledge base page already set up for that department.
  const openKnowledge = (id, mode) => {
    const unit = units.find(u => u.id === id);
    sessionStorage.setItem("knowledgeDept", JSON.stringify({ id, name: unit.name, mode }));
    location.hash = "knowledge";
  };
  app.querySelectorAll("[data-add-info]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); openKnowledge(b.dataset.addInfo, "add"); }));
  app.querySelectorAll("[data-view-docs]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); openKnowledge(b.dataset.viewDocs, "view"); }));
}

async function detail(id) {
  app.innerHTML = `<section class="panel loading-state" role="status">Loading ticket details…</section>`;
  departments = await ticketService.listDepartments();
  const ticket = await ticketService.getTicket(id);
  if (!ticket) { app.innerHTML = heading("Ticket not found", "This ticket could not be found.") + '<section class="panel placeholder-panel">Return to the ticket queue to select another request.</section>'; return; }
  if (scopedDepartmentId() && ticket.departmentId !== scopedDepartmentId()) { app.innerHTML = heading("Ticket unavailable", "This request is outside your department view.") + '<section class="panel placeholder-panel">Return to your department ticket queue to continue.</section>'; return; }
  const allowedTransitions = await ticketService.getAllowedTransitions(id);
  const departmentSuggestion = await ticketService.suggestDepartment(id);
  const routingPreview = await ticketService.classifyDepartment(`${ticket.subject} ${ticket.description}`);
  app.innerHTML = heading(escapeHtml(ticket.id), "Student support request", '<div class="detail-actions"><a class="button-secondary" href="#tickets">← Ticket Queue</a></div>') +
  `<div class="detail-grid"><div class="detail-main"><section class="panel"><div class="panel-heading"><div><h2 class="detail-subject">${escapeHtml(ticket.subject)}</h2><p class="panel-subtitle">${sourcePill(ticket.source)}</p></div>${statusPill(ticket.status)}</div><div class="detail-meta"><span>Created ${dateTime(ticket.createdAt)}</span><span>Priority: <strong>${escapeHtml(ticket.priority)}</strong></span></div><p class="detail-body">${escapeHtml(ticket.description)}</p><div class="detail-pairs"><div><strong>Student</strong>${escapeHtml(ticket.student.name)}</div><div><strong>Email</strong>${escapeHtml(ticket.student.email)}</div><div><strong>Programme</strong>${escapeHtml(ticket.student.programme)}</div><div><strong>Department</strong>${escapeHtml(deptName(ticket.departmentId))}</div></div><div class="routing-summary"><h3>AI Classification</h3><div><strong>Detected category</strong>${escapeHtml(ticket.aiEscalationContext?.classification || routingPreview.category || "Unclassified")}</div><div><strong>Confidence</strong>${escapeHtml(ticket.aiEscalationContext?.confidence || routingPreview.confidence)}</div><div><strong>Matched keywords</strong>${routingPreview.matchedKeywords.length ? routingPreview.matchedKeywords.map(escapeHtml).join(", ") : "None"}</div><div><strong>Routed department</strong>${escapeHtml(deptName(ticket.departmentId))}</div><div><strong>Assigned staff</strong>${escapeHtml(ticket.assignedTo || "Not assigned")}</div></div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Conversation</h2><p class="panel-subtitle">Messages recorded for this support request</p></div></div><div class="conversation">${ticket.conversation.length ? ticket.conversation.map(m=>`<article class="conversation-message"><div class="message-meta"><span>${escapeHtml(m.author)} <span class="message-role">· ${escapeHtml(m.role)}</span></span><time>${dateTime(m.createdAt)}</time></div><p>${escapeHtml(m.body)}</p></article>`).join("") : empty("No conversation messages yet.")}</div><form class="reply-form"><label for="staff-reply">Reply to student</label><textarea id="staff-reply" name="reply" placeholder="Write a clear update for the student…" required></textarea><div class="reply-footer"><small>Visible in the student conversation</small><button class="button-primary" type="submit">Send reply</button></div><p class="form-feedback" data-reply-feedback aria-live="polite"></p></form></section>
  <section class="panel"><div class="panel-heading"><div><h2>Ticket activity</h2><p class="panel-subtitle">Creation, routing, conversation, and status history</p></div></div>${ticket.activity?.length ? `<ol class="ticket-timeline">${ticket.activity.map(event=>`<li class="timeline-event" data-event="${escapeHtml(event.type)}"><span class="timeline-marker" aria-hidden="true"></span><div class="timeline-content"><div class="timeline-heading"><strong>${escapeHtml(timelineLabel(event.type))}</strong><time>${dateTime(event.createdAt)}</time></div><p>${escapeHtml(event.message)}</p><small>${escapeHtml(event.actor)}${event.visibility === "staff" ? " · Staff only" : ""}</small></div></li>`).join("")}</ol>` : empty("No activity has been recorded for this ticket yet.")}</section>
  <section class="panel"><div class="panel-heading"><div><h2>AI escalation context</h2><p class="panel-subtitle">Handover notes from the chatbot</p></div></div>${ticket.source === "ai_escalation" && ticket.aiEscalationContext ? `<dl class="ai-context"><div><dt>Escalation reason</dt><dd>${escapeHtml(ticket.aiEscalationContext.triggerReason || "Not provided")}</dd></div><div><dt>Chatbot summary</dt><dd>${escapeHtml(ticket.aiEscalationContext.summary || "Not provided")}</dd></div><div><dt>Confidence</dt><dd>${escapeHtml(ticket.aiEscalationContext.confidence || "Not provided")}</dd></div><div><dt>Review state</dt><dd>${escapeHtml(ticket.aiEscalationContext.reviewStatus || "Not provided")}</dd></div></dl>` : `<div class="context-empty">This ticket was submitted directly by a student. No chatbot escalation context is attached.</div>`}</section>
  <section class="panel"><div class="panel-heading"><div><h2>Attachments</h2><p class="panel-subtitle">Files shared with this request</p></div></div>${ticket.attachments.length ? ticket.attachments.map(a=>`<div class="attachment-placeholder">▧ ${escapeHtml(a.name)}</div>`).join("") : '<div class="attachment-placeholder">No attachments on this ticket.</div>'}</section></div>
  <aside class="detail-aside"><section class="panel"><h2>Assignment &amp; Status</h2><form class="detail-form"><label>Status<select name="status"><option selected>${escapeHtml(ticket.status)}</option>${allowedTransitions.map(s=>`<option>${escapeHtml(s)}</option>`).join("")}</select></label><label>Department<select name="departmentId"><option value="">Unassigned</option>${departments.map(d=>`<option value="${d.id}" ${d.id===ticket.departmentId?"selected":""}>${escapeHtml(d.name)}</option>`).join("")}</select></label>${departmentSuggestion?.departmentId && departmentSuggestion.departmentId!==ticket.departmentId ? `<div class="routing-suggestion"><strong>Suggested: ${escapeHtml(departmentSuggestion.departmentName)}</strong><small>${escapeHtml(departmentSuggestion.reason)}</small><button class="button-secondary" type="button" data-route-suggestion="${escapeHtml(departmentSuggestion.departmentId)}">Route to department</button></div>` : `<p class="detail-note">${escapeHtml(departmentSuggestion?.reason || "No routing suggestion available.")}</p>`}<label>Assigned Officer<input name="assignedTo" value="${escapeHtml(ticket.assignedTo||"")}" placeholder="Enter staff name"></label><p class="form-feedback" data-form-feedback aria-live="polite"></p><button class="button-primary" type="submit">Save ticket changes</button></form></section>
  <section class="panel"><div class="panel-heading"><h2>Internal Notes</h2></div>${ticket.internalNotes.length ? ticket.internalNotes.map(n=>`<article class="conversation-message"><div class="message-meta"><span>${escapeHtml(n.author||"Support Staff")}</span><time>${dateTime(n.createdAt||ticket.updatedAt)}</time></div><p>${escapeHtml(n.body||n)}</p></article>`).join("") : empty("No internal notes recorded.")}<form class="note-form"><label for="internal-note">Internal note</label><textarea id="internal-note" name="note" placeholder="Add a staff-only note" aria-label="Internal note" required></textarea><p class="form-feedback" data-note-feedback aria-live="polite"></p><button class="button-secondary" type="submit">Add Internal Note</button></form></section><section class="panel" data-teach></section></aside></div>`;
  renderTeachPanel(ticket);
  renderQuickActions(ticket, allowedTransitions);
  app.querySelector(".detail-form").addEventListener("submit", async e => {e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),data=new FormData(form);button.disabled=true;button.textContent="Saving…";try{await ticketService.updateTicket(id,{status:data.get("status"),departmentId:data.get("departmentId")||null,assignedTo:data.get("assignedTo")||null});await detail(id);}catch(error){form.querySelector("[data-form-feedback]").textContent=error.message;button.disabled=false;button.textContent="Save ticket changes";}});
  app.querySelector(".reply-form").addEventListener("submit", async e => {e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),field=form.elements.reply,feedback=form.querySelector("[data-reply-feedback]");button.disabled=true;button.textContent="Sending…";try{await ticketService.addStaffReply(id,field.value);await detail(id);}catch(error){feedback.textContent=error.message;button.disabled=false;button.textContent="Send reply";}});
  app.querySelector("[data-route-suggestion]")?.addEventListener("click", async event => {const button=event.currentTarget;button.disabled=true;button.textContent="Routing…";try{await ticketService.routeTicket(id,button.dataset.routeSuggestion);await detail(id);}catch(error){button.disabled=false;button.textContent=error.message;}});
  app.querySelector(".note-form").addEventListener("submit", async e => {e.preventDefault();const form=e.currentTarget,field=form.elements.note,button=form.querySelector("button[type=submit]"),feedback=form.querySelector("[data-note-feedback]");if(!field.value.trim())return;button.disabled=true;button.textContent="Saving…";try{await ticketService.addInternalNote(id,field.value.trim());await detail(id);}catch(error){feedback.textContent=error.message;button.disabled=false;button.textContent="Add Internal Note";}});
}

function signInPage() {
  app.innerHTML = heading("Staff sign in", "Sign in with an authorized synthetic staff or administrator account.") +
  `<section class="panel"><form class="detail-form" data-signin><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p class="form-feedback" data-feedback aria-live="polite"></p><button class="button-primary" type="submit">Sign in</button></form></section>`;
  app.querySelector("[data-signin]").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget, feedback = form.querySelector("[data-feedback]");
    feedback.textContent = "";
    try { await ticketService.signIn(form.elements.username.value.trim(),form.elements.password.value); route(); }
    catch (error) { feedback.textContent = error.code === "SIGN_IN" ? "That key was not accepted, or ADMIN_API_KEY is not set in backend/.env." : error.message; }
  });
}

/*
Changes: Adds the "Teach the chatbot" form to a ticket and the Recurring questions and Saved answers pages.
Affects: Ticket detail, sidebar navigation, and what the chatbot answers without opening a new ticket.
Purpose: Staff save an approved answer once; only what is saved here is ever learned, and every answer needs a visibility choice.
*/
function renderTeachPanel(ticket) {
  const box = app.querySelector("[data-teach]");
  if (!box) return;
  box.innerHTML = `<div class="panel-heading"><div><h2>Teach the chatbot</h2><p class="panel-subtitle">Type an answer, or upload a document the chatbot can read</p></div></div>
  <div class="teach-tabs" role="tablist"><button type="button" class="chip is-active" role="tab" data-tab="answer">Type an answer</button><button type="button" class="chip" role="tab" data-tab="document">Upload a PDF or document</button></div>
  <form class="reply-form detail-form teach-form" data-form="answer"><label>Question the chatbot should recognise<input name="question" value="${escapeHtml(ticket.description)}" required></label><label>Answer for students<textarea name="answer" placeholder="Leave out personal data, grades and fee balances." required></textarea></label><label>Who can see this answer?<select name="visibility" required><option value="">Choose…</option><option value="student">Signed-in students only</option><option value="visitor">Visitors only (not signed in)</option><option value="public">Everyone, including visitors</option></select></label><p class="detail-note" data-vis-note aria-live="polite"></p><label class="check-line"><input type="checkbox" name="resolve" checked> Mark matching open tickets Resolved</label><p class="detail-note">Confidential? Do not save anything here. Resolve the ticket and the chatbot learns nothing.</p><p class="form-feedback" data-teach-feedback aria-live="polite"></p><button class="button-primary" type="submit">Save answer</button></form>
  <form class="reply-form detail-form teach-form" data-form="document" hidden><label class="drop-zone" data-drop><input type="file" name="file" accept=".pdf,.docx,.txt,.html,.htm" required><span><strong>Choose a file</strong> or drop it here</span><small data-file-name>PDF, Word, text or HTML, up to ${MAX_UPLOAD_MB} MB</small></label><label>Title shown in citations (optional)<input name="title" maxlength="200" placeholder="e.g. 2026 Fee Schedule"></label><label>Who can see answers from this document?<select name="access" required><option value="">Choose…</option><option value="restricted">Signed-in students only</option><option value="public">Everyone, including visitors</option></select></label><p class="detail-note" data-vis-note aria-live="polite"></p><label class="check-line"><input type="checkbox" name="resolve" checked> Mark this ticket Resolved after adding</label><p class="detail-note">Only upload approved UNILUS material with no personal student data. Scanned PDFs (photos of pages) can't be read. After it's added, ask the chatbot this student's question to check the document answers it.</p><p class="form-feedback" data-doc-feedback aria-live="polite"></p><button class="button-primary" type="submit">Add document</button></form>`;

  wireVisibilityHints(box);

  // switch between typing an answer and uploading a document
  const forms = { answer: box.querySelector('[data-form="answer"]'), document: box.querySelector('[data-form="document"]') };
  box.querySelectorAll("[data-tab]").forEach(tab => tab.addEventListener("click", () => {
    box.querySelectorAll("[data-tab]").forEach(t => t.classList.toggle("is-active", t === tab));
    forms.answer.hidden = tab.dataset.tab !== "answer";
    forms.document.hidden = tab.dataset.tab !== "document";
  }));

  // typed answer (unchanged behaviour)
  forms.answer.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget, button = form.querySelector("button[type=submit]"), feedback = form.querySelector("[data-teach-feedback]"), data = new FormData(form);
    button.disabled = true; button.textContent = "Saving…";
    try {
      await ticketService.faq.saveAnswer({ question: data.get("question"), answer: data.get("answer"), visibility: data.get("visibility"), ticketRef: ticket.id, resolveTicket: form.elements.resolve.checked });
      location.hash = "answers";
    } catch (error) {
      feedback.textContent = error.message;
      button.disabled = false; button.textContent = "Save answer";
    }
  });

  // document upload
  const docForm = forms.document, zone = docForm.querySelector("[data-drop]"), input = zone.querySelector("input"), label = zone.querySelector("[data-file-name]");
  const showName = () => { label.textContent = input.files[0] ? `${input.files[0].name} (${(input.files[0].size / 1048576).toFixed(1)} MB)` : `PDF, Word, text or HTML, up to ${MAX_UPLOAD_MB} MB`; };
  input.addEventListener("change", showName);
  ["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("is-over"); }));
  zone.addEventListener("drop", e => { if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; showName(); } });

  docForm.addEventListener("submit", async e => {
    e.preventDefault();
    const button = docForm.querySelector("button[type=submit]"), feedback = docForm.querySelector("[data-doc-feedback]"), file = input.files[0];
    feedback.textContent = "";
    if (!file) { feedback.textContent = "Choose a file first."; return; }
    if (file.size > MAX_UPLOAD_MB * 1048576) { feedback.textContent = `That file is over ${MAX_UPLOAD_MB} MB.`; return; }
    button.disabled = true; button.textContent = "Reading and indexing… this can take a minute";
    let result;
    try {
      // label the document with the ticket's department so it is easy to find later
      const unit = ticket.departmentId ? (await ticketService.listDepartments()).find(u => u.id === ticket.departmentId) : null;
      const typed = docForm.elements.title.value.trim();
      const base = typed || file.name.replace(/\.[^.]+$/, "");
      result = await ticketService.knowledge.upload(file, { access: docForm.elements.access.value, title: unit ? unit.name + TITLE_SEP + base : base });
    } catch (error) {
      feedback.textContent = error.message;
      button.disabled = false; button.textContent = "Add document";
      return;
    }
    toast(`Added ${result.file}: ${result.chunks} sections indexed${result.replaced ? " (replaced the old version)" : ""}.`);
    if (docForm.elements.resolve.checked && !["Resolved", "Closed"].includes(ticket.status)) {
      try { await ticketService.updateTicket(ticket.id, { status: "Resolved", departmentId: ticket.departmentId, assignedTo: ticket.assignedTo }); }
      catch (error) { toast(`The document was added, but the ticket could not be resolved: ${error.message}`); }
    }
    await detail(ticket.id);
  });
}

async function recurringPage() {
  const groups = await ticketService.faq.recurring();
  app.innerHTML = heading("Recurring questions", "Unanswered questions grouped by similarity, most asked first.") +
  (groups.length ? groups.map(g => `<section class="panel recurring-card"><div class="panel-heading"><div><h2>${escapeHtml(g.question)}</h2><p class="panel-subtitle">Asked ${g.count} ${g.count === 1 ? "time" : "times"} · last ${dateTime(g.lastAsked)} · ${g.openCount} open</p></div>${g.answered ? '<span class="status-pill" data-status="Resolved">Chatbot can answer this</span>' : `<a class="button-secondary" href="#ticket/${encodeURIComponent(g.refs[0])}">Open &amp; answer</a>`}</div><small>${g.refs.map(escapeHtml).join(", ")}</small></section>`).join("") : `<section class="panel">${empty("No unanswered questions yet. They are counted here when the chatbot cannot answer.")}</section>`);
}

async function answersPage() {
  const rows = await ticketService.faq.answers();
  app.innerHTML = heading("Saved answers", "Answers staff have taught the chatbot. Turn one off if it goes out of date. Answers marked Signed-in students only are hidden from visitors, and answers marked Visitors only are hidden from signed-in students.") +
  (rows.length ? rows.map(a => `<section class="panel answer-card" data-answer="${a.id}"><div class="panel-heading"><div><h2>${escapeHtml(a.question)}</h2><p class="panel-subtitle">${({ public: "Everyone", student: "Signed-in students only", visitor: "Visitors only (not signed in)" })[a.visibility] || a.visibility} · used ${a.times_used} ${a.times_used === 1 ? "time" : "times"} · saved ${dateTime(a.created_at)}${a.source_ticket ? ` · from ${escapeHtml(a.source_ticket)}` : ""}</p></div><span class="status-pill" data-status="${a.active ? "Resolved" : "Waiting for Student"}">${a.active ? "On" : "Off"}</span></div><p class="detail-body">${escapeHtml(a.answer)}</p><div class="detail-actions"><label class="inline-select">Visible to<select data-visibility aria-label="Who can see this answer"><option value="public"${a.visibility === "public" ? " selected" : ""}>Everyone</option><option value="student"${a.visibility === "student" ? " selected" : ""}>Signed-in students only</option><option value="visitor"${a.visibility === "visitor" ? " selected" : ""}>Visitors only (not signed in)</option></select></label><button class="button-secondary" type="button" data-toggle>${a.active ? "Turn off" : "Turn on"}</button><button class="button-secondary" type="button" data-delete>Delete</button></div></section>`).join("") : `<section class="panel">${empty("No saved answers yet. Open a ticket and use Teach the chatbot.")}</section>`);
  app.querySelectorAll("[data-answer]").forEach(card => {
    const id = card.dataset.answer, row = rows.find(r => String(r.id) === id);
    card.querySelector("[data-toggle]").addEventListener("click", async () => { try { await ticketService.faq.setAnswerActive(id, !row.active); answersPage(); } catch (error) { alert(error.message); } });
    card.querySelector("[data-visibility]").addEventListener("change", async e => {
      e.target.disabled = true;
      try {
        await ticketService.faq.setAnswerVisibility(id, e.target.value);
        toast(({ public: "This answer is now visible to everyone.", student: "This answer is now for signed-in students only.", visitor: "This answer is now for visitors who are not signed in." })[e.target.value]);
        answersPage();
      } catch (error) { toast(error.message); e.target.value = row.visibility; e.target.disabled = false; }
    });
    card.querySelector("[data-delete]").addEventListener("click", async () => { if (!confirm("Delete this answer? The chatbot will stop using it.")) return; try { await ticketService.faq.deleteAnswer(id); answersPage(); } catch (error) { alert(error.message); } });
  });
}

async function route() {
  const route = location.hash.slice(1) || "dashboard";
  if (!route.startsWith("ticket/") && !["dashboard", "tickets", "recurring", "answers", "knowledge", "departments", "staff", "reports"].includes(route)) {
    location.hash = "dashboard";
    return;
  }
  const section = route.startsWith("ticket/") ? "Tickets" : route[0].toUpperCase()+route.slice(1);
  document.querySelector("#current-section").textContent = section;
  document.querySelectorAll(".admin-sidebar nav a").forEach(a=>a.classList.toggle("active",a.dataset.page===(route.startsWith("ticket/")?"tickets":route)));
  document.querySelector("#admin-sidebar").classList.remove("is-open");
  app.innerHTML = `<section class="panel loading-state" role="status">Opening ${escapeHtml(section.toLowerCase())}…</section>`;
  try { if(!ticketService.isSignedIn()) { signInPage(); return; } if(route.startsWith("ticket/")) await detail(decodeURIComponent(route.slice(7))); else if(route==="tickets") await ticketsPage(); else if(route==="dashboard") await dashboard(); else if(route==="recurring") await recurringPage(); else if(route==="answers") await answersPage(); else if(route==="departments") await departmentsPage(); else if(route==="reports") await reportsPage(); else if(route==="knowledge") await knowledgePage(); else app.innerHTML=heading(section,section+" workspace")+'<section class="panel placeholder-panel">This section is reserved for a future Support Centre phase.</section>'; }
  catch(error) { if(error.code==="SIGN_IN"){ signInPage(); return; } app.innerHTML=heading("Support Centre","Student support dashboard")+`<section class="panel error-state" role="alert"><strong>We could not load this view.</strong><p>${escapeHtml(error.message)}</p><button class="button-secondary" type="button" data-retry>Try again</button></section>`; app.querySelector("[data-retry]")?.addEventListener("click",route); }
}

/* ---------------- Interactivity additions ---------------- */
function toast(message, { link, linkText } = {}) {
  let host = document.querySelector(".toast-host");
  if (!host) { host = document.createElement("div"); host.className = "toast-host"; host.setAttribute("aria-live", "polite"); document.body.append(host); }
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${escapeHtml(message)}</span>${link ? `<a href="${link}">${escapeHtml(linkText || "View")}</a>` : ""}<button type="button" aria-label="Dismiss">×</button>`;
  el.querySelector("button").addEventListener("click", () => el.remove());
  host.append(el);
  setTimeout(() => el.remove(), 8000);
}

// Dashboard cards jump to the ticket queue with a filter already applied.
function wirePresetCards() {
  app.querySelectorAll("[data-preset]").forEach(card => {
    const go = () => { sessionStorage.setItem("ticketPreset", card.dataset.preset); location.hash = "tickets"; };
    card.addEventListener("click", go);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
}

function applyPreset() {
  const raw = sessionStorage.getItem("ticketPreset");
  if (!raw) return;
  sessionStorage.removeItem("ticketPreset");
  try {
    const controls = app.querySelector(".queue-controls");
    for (const [name, value] of Object.entries(JSON.parse(raw))) {
      const control = controls.querySelector(`[name="${name}"]`);
      if (control && !control.disabled) control.value = value;
    }
  } catch { /* ignore a bad preset */ }
}

// Status chips with live counts above the ticket table.
async function renderChips() {
  const box = app.querySelector("[data-chips]");
  const select = app.querySelector('.queue-controls [name="status"]');
  if (!box || !select) return;
  let tickets = [];
  try { tickets = await visibleTickets(); } catch { return; }
  const count = s => (s ? tickets.filter(t => t.status === s).length : tickets.length);
  box.innerHTML = [["", "All"], ...statuses.map(s => [s, s])].map(([value, label]) => `<button type="button" class="chip" data-chip="${escapeHtml(value)}">${escapeHtml(label)} <b>${count(value)}</b></button>`).join("");
  const sync = () => box.querySelectorAll("[data-chip]").forEach(chip => chip.classList.toggle("is-active", chip.dataset.chip === select.value));
  box.querySelectorAll("[data-chip]").forEach(chip => chip.addEventListener("click", () => { select.value = chip.dataset.chip; select.dispatchEvent(new Event("change")); }));
  select.addEventListener("change", sync);
  sync();
}

// One-click status buttons and a jump to "Teach the chatbot" on a ticket.
function renderQuickActions(ticket, allowed) {
  const heading = app.querySelector(".page-heading");
  if (!heading) return;
  const finished = ticket.status === "Resolved" || ticket.status === "Closed";
  const label = s => (s === "In Progress" ? (finished ? "Reopen" : "Start work") : s === "Resolved" ? "Mark resolved" : s === "Closed" ? "Close ticket" : s);
  const bar = document.createElement("div");
  bar.className = "quick-actions";
  bar.innerHTML = `<span>Quick actions</span>${allowed.map(s => `<button type="button" class="button-secondary" data-quick="${escapeHtml(s)}">${escapeHtml(label(s))}</button>`).join("")}<button type="button" class="button-secondary" data-teach-jump>Teach the chatbot</button><button type="button" class="button-secondary" data-upload-jump>Upload a PDF</button>`;
  heading.after(bar);
  bar.querySelector("[data-teach-jump]").addEventListener("click", () => {
    const box = app.querySelector("[data-teach]");
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
    box?.querySelector("textarea")?.focus({ preventScroll: true });
  });
  bar.querySelector("[data-upload-jump]").addEventListener("click", () => {
    const box = app.querySelector("[data-teach]");
    box?.querySelector('[data-tab="document"]')?.click();
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  bar.querySelectorAll("[data-quick]").forEach(button => button.addEventListener("click", async () => {
    const buttons = bar.querySelectorAll("button");
    buttons.forEach(b => { b.disabled = true; });
    try {
      await ticketService.updateTicket(ticket.id, { status: button.dataset.quick, departmentId: ticket.departmentId, assignedTo: ticket.assignedTo });
      toast(`${ticket.id} is now ${button.dataset.quick}.`);
      await detail(ticket.id);
    } catch (error) {
      toast(error.message);
      buttons.forEach(b => { b.disabled = false; });
    }
  }));
}

// Reports page, drawn from the backend /admin/stats numbers.
function barList(title, data, rename = {}) {
  const entries = Object.entries(data || {}).map(([k, v]) => [rename[k] || k, v]).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return `<section class="panel"><div class="panel-heading"><div><h2>${title}</h2></div></div>${entries.length ? `<ul class="bar-list">${entries.map(([k, v]) => `<li><span class="bar-label">${escapeHtml(k)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round((v / max) * 100)}%"></span></span><b>${v}</b></li>`).join("")}</ul>` : empty("No data yet.")}</section>`;
}

async function reportsPage() {
  if (scopedDepartmentId()) {
    app.innerHTML = heading("Reports", "How the chatbot is performing and where questions go.") + '<section class="panel placeholder-panel">Reports cover every department. Switch the role to Super Admin to view them.</section>';
    return;
  }
  const s = await ticketService.stats();
  const pct = n => `${Math.round((n || 0) * 1000) / 10}%`;
  app.innerHTML = heading("Reports", "How the chatbot is performing and where questions go.") +
  `<div class="metric-grid">
    <div class="metric-card"><span class="metric-label">Questions asked</span><strong class="metric-value">${s.totalQuestions}</strong><small class="metric-foot">All chatbot messages</small></div>
    <div class="metric-card"><span class="metric-label">Answered directly</span><strong class="metric-value">${s.answeredDirectly}</strong><small class="metric-foot">No ticket needed</small></div>
    <div class="metric-card"><span class="metric-label">Escalated</span><strong class="metric-value">${s.escalatedTickets}</strong><small class="metric-foot">${pct(s.escalationRate)} of questions</small></div>
    <div class="metric-card"><span class="metric-label">Feedback</span><strong class="metric-value">${s.feedback.up} / ${s.feedback.down}</strong><small class="metric-foot">Helpful / not helpful</small></div>
  </div>
  <div class="report-grid">${barList("Tickets by status", s.ticketsByStatus, { Open: "New" })}${barList("Tickets by department", s.ticketsByDepartment)}${barList("Tickets by category", s.ticketsByCategory)}${barList("Tickets by priority", s.ticketsByPriority, { Critical: "Urgent", Medium: "Normal" })}</div>
  <p class="report-note">Question totals include greetings and any testing done during development, so treat the escalation rate as an estimate until real students are using the chatbot.</p>`;
}

/* ---------------- Knowledge base page ---------------- */
const MAX_UPLOAD_MB = 25;
const TITLE_SEP = " – ";   // uploads from a department are titled "Finance Office – ..."
let knowledgeDept = null;       // { id, name, mode } when opened from a department card

function describeUpdate(e) {
  if (e.type === "upload") return `Uploaded ${e.file} (${e.chunks} sections${e.replaced_chunks ? ", replaced the old version" : ""})`;
  if (e.type === "delete") return `Deleted ${e.file}`;
  if (e.type === "website_refresh") return e.aborted ? "Website refresh skipped" : `Website refreshed (+${e.added} new, ${e.updated} changed, ${e.removed} removed)`;
  return e.type || "Update";
}

async function knowledgePage(keep = false) {
  const [status, units] = await Promise.all([ticketService.knowledge.status(), ticketService.listDepartments()]);
  if (!keep) {
    knowledgeDept = null;
    try { knowledgeDept = JSON.parse(sessionStorage.getItem("knowledgeDept") || "null"); } catch { knowledgeDept = null; }
    sessionStorage.removeItem("knowledgeDept");
    const own = scopedDepartmentId() && units.find(u => u.id === scopedDepartmentId());
    if (own && (!knowledgeDept || knowledgeDept.id !== own.id)) knowledgeDept = { id: own.id, name: own.name, mode: "view" };
  }
  const isSuper = !scopedDepartmentId();
  const banner = knowledgeDept
    ? `<div class="dept-banner"><span>${knowledgeDept.mode === "view" ? "Showing documents for" : "Adding information for"} <strong>${escapeHtml(knowledgeDept.name)}</strong>. New uploads are labelled with the department name, so they are easy to find and show up in the chatbot's citations.</span>${isSuper ? '<button type="button" class="button-secondary" data-clear-dept>Clear</button>' : ""}</div>`
    : "";
  const web = status.last_website_refresh;
  const docs = status.documents || [];
  const uploaded = docs.filter(d => d.upload).length;
  const webFoot = !web ? "Not refreshed yet" : web.aborted ? "Last attempt was skipped" : `+${web.added} new, ${web.updated} changed, ${web.removed} removed`;

  const rows = docs.map(d => {
    const source = d.upload ? `Uploaded${d.upload.uploaded_by ? ` by ${escapeHtml(d.upload.uploaded_by)}` : ""}${d.upload.uploaded_at ? ` · ${dateOnly(d.upload.uploaded_at)}` : ""}` : d.document_type === "website" ? "Website page" : "Built-in document";
    const name = d.upload?.title ? `<strong>${escapeHtml(d.upload.title)}</strong><small>${escapeHtml(d.source_file)}</small>` : `<strong>${escapeHtml(d.source_file)}</strong>`;
    return `<tr><td class="student-cell">${name}</td><td>${escapeHtml(source)}</td><td>${d.chunks}</td><td><span class="status-pill" data-status="${d.access === "public" ? "Resolved" : "In Progress"}">${d.access === "public" ? "Everyone" : "Students only"}</span></td><td>${d.upload ? `<button class="button-secondary" type="button" data-delete-doc="${escapeHtml(d.source_file)}">Delete</button>` : ""}</td></tr>`;
  }).join("");

  const updates = (status.recent_updates || []).map(e => `<div class="activity-row"><div class="activity-summary"><strong>${escapeHtml(describeUpdate(e))}</strong><small>${dateTime(e.at)} · ${escapeHtml(e.by || e.trigger || "system")}</small></div></div>`).join("");

  app.innerHTML = heading("Knowledge base", "Documents and web pages the chatbot answers from.", isSuper ? '<button class="button-secondary" type="button" data-refresh-web>Refresh website now</button>' : "") + banner +
  `<div class="metric-grid">
    <div class="metric-card"><span class="metric-label">Sources</span><strong class="metric-value">${status.total_documents}</strong><small class="metric-foot">${uploaded} uploaded by staff</small></div>
    <div class="metric-card"><span class="metric-label">Sections indexed</span><strong class="metric-value">${status.total_chunks}</strong><small class="metric-foot">Pieces the bot can search</small></div>
    <div class="metric-card"><span class="metric-label">Website last refreshed</span><strong class="metric-value metric-value--small">${web ? dateOnly(web.at) : "Never"}</strong><small class="metric-foot">${escapeHtml(webFoot)}</small></div>
  </div>
  <div class="knowledge-top">
    <section class="panel"><div class="panel-heading"><div><h2>Add a document</h2><p class="panel-subtitle">PDF, Word, text or HTML, up to ${MAX_UPLOAD_MB} MB. The chatbot can use it straight away.</p></div></div>
      <form class="detail-form" data-upload>
        <label class="drop-zone" data-drop><input type="file" name="file" accept=".pdf,.docx,.txt,.html,.htm" required><span><strong>Choose a file</strong> or drop it here</span><small data-file-name>No file selected</small></label>
        <label>Title shown in citations (optional)<input name="title" maxlength="200" placeholder="e.g. 2026 Fee Schedule"></label>
        <label>Who can see answers from this document?<select name="access"><option value="restricted">Signed-in students only</option><option value="public">Everyone, including visitors</option></select></label>
        <p class="detail-note" data-vis-note aria-live="polite"></p>
        <label class="check-line"><input type="checkbox" name="approved" required> This is approved UNILUS material with no personal student data</label>
        <p class="detail-note">A file with the same name replaces the old version. Scanned PDFs (photos of pages) can't be read, so use a text-based PDF. For a single question and answer, use Saved answers instead.</p>
        <p class="form-feedback" data-upload-feedback aria-live="polite"></p>
        <button class="button-primary" type="submit">Add to knowledge base</button>
      </form></section>
    <section class="panel"><div class="panel-heading"><div><h2>Web pages</h2><p class="panel-subtitle">The bot also reads a fixed list of UNILUS web pages.</p></div></div>
      <p class="detail-note">Use <strong>Refresh website now</strong> (top right) to pick up edits to those pages. To add a page that isn't on the list, save it from your browser as an HTML file (Ctrl+S) and upload it here.</p>
      <div class="activity-list">${updates || empty("No changes recorded yet.")}</div></section>
  </div>
  <section class="panel"><div class="panel-heading"><div><h2>What the chatbot knows</h2><p class="panel-subtitle">Every source in the knowledge base. Only staff uploads can be deleted here.</p></div></div>
    <input class="doc-search" type="search" placeholder="Search sources" aria-label="Search sources" data-doc-search>
    <div class="table-wrap"><table class="ticket-table"><thead><tr><th>Source</th><th>Added</th><th>Sections</th><th>Visible to</th><th></th></tr></thead><tbody data-doc-rows>${rows || `<tr><td colspan="5"><div class="queue-empty">No sources yet.</div></td></tr>`}</tbody></table></div></section>`;

  wireVisibilityHints(app);

  // search
  app.querySelector("[data-doc-search]").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    app.querySelectorAll("[data-doc-rows] tr").forEach(tr => { tr.hidden = q && !tr.textContent.toLowerCase().includes(q); });
  });

  if (knowledgeDept?.mode === "view") {
    const search = app.querySelector("[data-doc-search]");
    search.value = knowledgeDept.name;
    search.dispatchEvent(new Event("input"));
  }
  app.querySelector("[data-clear-dept]")?.addEventListener("click", () => { knowledgeDept = null; knowledgePage(true); });

  // drag and drop
  const zone = app.querySelector("[data-drop]"), input = zone.querySelector("input"), label = zone.querySelector("[data-file-name]");
  const showName = () => { label.textContent = input.files[0] ? `${input.files[0].name} (${(input.files[0].size / 1048576).toFixed(1)} MB)` : "No file selected"; };
  input.addEventListener("change", showName);
  ["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("is-over"); }));
  zone.addEventListener("drop", e => { if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; showName(); } });

  // upload
  app.querySelector("[data-upload]").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget, button = form.querySelector("button[type=submit]"), feedback = form.querySelector("[data-upload-feedback]");
    const file = input.files[0];
    feedback.textContent = "";
    if (!file) { feedback.textContent = "Choose a file first."; return; }
    if (file.size > MAX_UPLOAD_MB * 1048576) { feedback.textContent = `That file is over ${MAX_UPLOAD_MB} MB.`; return; }
    button.disabled = true; button.textContent = "Reading and indexing… this can take a minute";
    try {
      const typed = form.elements.title.value.trim();
      const title = knowledgeDept ? knowledgeDept.name + TITLE_SEP + (typed || file.name.replace(/\.[^.]+$/, "")) : typed;
      const result = await ticketService.knowledge.upload(file, { access: form.elements.access.value, title });
      toast(`Added ${result.file}: ${result.chunks} sections indexed${result.replaced ? " (replaced the old version)" : ""}.`);
      await knowledgePage(true);
    } catch (error) {
      feedback.textContent = error.message;
      button.disabled = false; button.textContent = "Add to knowledge base";
    }
  });

  // refresh website
  app.querySelector("[data-refresh-web]")?.addEventListener("click", async e => {
    const button = e.currentTarget;
    button.disabled = true; button.textContent = "Refreshing… this can take a few minutes";
    try {
      const r = await ticketService.knowledge.refreshWebsite();
      toast(r.aborted ? `Refresh skipped: ${r.reason}` : `Website refreshed: ${r.added} new, ${r.updated} changed, ${r.removed} removed.`);
      await knowledgePage(true);
    } catch (error) {
      toast(error.message);
      button.disabled = false; button.textContent = "Refresh website now";
    }
  });

  // delete
  app.querySelectorAll("[data-delete-doc]").forEach(button => button.addEventListener("click", async () => {
    const name = button.dataset.deleteDoc;
    if (!confirm(`Delete "${name}"? The chatbot will stop using it.`)) return;
    button.disabled = true;
    try {
      const r = await ticketService.knowledge.remove(name);
      toast(`Deleted ${r.file} (${r.removed_chunks} sections removed).`);
      await knowledgePage(true);
    } catch (error) { toast(error.message); button.disabled = false; }
  }));
}

// Plain-language note under every "who can see this" choice.
function wireVisibilityHints(root) {
  root.querySelectorAll("form").forEach(form => {
    const select = form.querySelector('select[name="visibility"], select[name="access"]');
    const note = form.querySelector("[data-vis-note]");
    if (!select || !note) return;
    const update = () => {
      const signedInOnly = select.value === "student" || select.value === "restricted";
      note.textContent = select.value === "public"
        ? "Anyone using the chatbot, signed in or not, can get this. Keep out anything private."
        : select.value === "visitor"
          ? "Only people who are not signed in get this. Signed-in students skip it and get their own real answer."
          : signedInOnly ? "Visitors who are not signed in will not get this. They will be sent to a ticket instead." : "";
      note.classList.toggle("is-warning", signedInOnly);
    };
    select.addEventListener("change", update);
    update();
  });
}

// Live updates: check for new tickets every 20 seconds while the tab is open.
let knownIds = null, polling = false;
function showRefreshBanner(n) {
  let banner = app.querySelector(".new-banner");
  const total = (Number(banner?.dataset.count) || 0) + n;
  if (!banner) { banner = document.createElement("div"); banner.className = "new-banner"; app.prepend(banner); }
  banner.dataset.count = total;
  banner.innerHTML = `<span>${total} new ${total === 1 ? "ticket" : "tickets"} arrived.</span><button type="button" class="button-secondary">Refresh list</button>`;
  banner.querySelector("button").addEventListener("click", route);
}
async function pollTickets() {
  if (document.hidden || polling || !ticketService.isSignedIn()) return;
  polling = true;
  try {
    const result = await ticketService.listTickets({ departmentId: scopedDepartmentId() || "", sort: "createdAt", order: "desc", page: 1, pageSize: 50 });
    if (knownIds) {
      const fresh = result.items.filter(t => !knownIds.has(t.id));
      if (fresh.length) {
        toast(fresh.length === 1 ? `New ticket ${fresh[0].id}: ${fresh[0].subject}` : `${fresh.length} new tickets arrived.`, { link: fresh.length === 1 ? `#ticket/${encodeURIComponent(fresh[0].id)}` : "#tickets", linkText: "Open" });
        const current = location.hash.slice(1) || "dashboard";
        if (current === "dashboard") route();
        else if (current === "tickets") showRefreshBanner(fresh.length);
      }
    }
    knownIds = new Set(result.items.map(t => t.id));
  } catch (error) {
    if (error.code === "SIGN_IN") signInPage();
  } finally { polling = false; }
}
setInterval(pollTickets, 20000);
setTimeout(pollTickets, 1500);

// "/" jumps to ticket search.
document.addEventListener("keydown", e => {
  if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
    const search = app.querySelector('.queue-controls [name="search"]');
    if (search) { e.preventDefault(); search.focus(); }
  }
});

document.querySelector(".menu-toggle").addEventListener("click",event=>{const open=document.querySelector("#admin-sidebar").classList.toggle("is-open");event.currentTarget.setAttribute("aria-expanded",String(open));});
window.addEventListener("hashchange",route);
const roleSelector = document.querySelector("#support-role");
roleSelector.value = selectedRole;
roleSelector.addEventListener("change", () => { selectedRole = roleSelector.value; sessionStorage.setItem("supportCentreRole", selectedRole); page = 1; route(); });
route();
