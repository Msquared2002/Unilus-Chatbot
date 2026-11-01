/*
Changes: Renders the Support Centre dashboard, ticket queue, and ticket details.
Affects: admin.html views and the ticketService data boundary.
Purpose: Keeps page navigation and user actions in the dashboard controller.
*/
import { ticketService } from "./admin-ticket-service.js";

const app = document.querySelector("#app");
const statuses = ["New", "Assigned", "In Progress", "Waiting for Student", "Resolved", "Closed"];
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
  const assigned = tickets.filter(t => t.status === "Assigned" || t.assignedTo).length;
  const waiting = tickets.filter(t => t.status === "Waiting for Student").length;
  const today = new Date().toDateString();
  const resolvedToday = tickets.filter(t => t.status === "Resolved" && new Date(t.updatedAt).toDateString() === today).length;
  const activities = tickets.flatMap(t => (t.activity || []).filter(event => event.visibility !== "staff").map(event => ({ ...event, ticketId: t.id, subject: t.subject, status: t.status }))).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5);
  const responseTime = isAdmin ? data.averageResponseTimeMinutes : null;
  const routingOverview = `<section class="panel routing-overview"><div class="panel-heading"><div><h2>Routing Overview</h2><p class="panel-subtitle">Current ticket volume by routed department</p></div></div><div class="routing-overview__grid">${departments.map(d=>`<div class="routing-overview__item"><strong>${escapeHtml(d.name)}</strong><span>${tickets.filter(t=>t.departmentId===d.id).length} tickets</span></div>`).join("")}</div></section>`;
  app.innerHTML = heading("Dashboard", "An overview of student support requests.", '<a class="text-link" href="#tickets">View all tickets →</a>') +
  `<div class="metric-grid">
    <div class="metric-card"><span class="metric-icon">▤</span><span class="metric-label">${isAdmin ? "All Tickets" : "Department Tickets"}</span><strong class="metric-value">${tickets.length}</strong><small class="metric-foot">${escapeHtml(roleViews[selectedRole].label)} view</small></div>
    <div class="metric-card"><span class="metric-icon">▤</span><span class="metric-label">Open Tickets</span><strong class="metric-value">${openTickets}</strong><small class="metric-foot">Awaiting completion</small></div>
    <div class="metric-card"><span class="metric-icon">♙</span><span class="metric-label">Assigned</span><strong class="metric-value">${assigned}</strong><small class="metric-foot">With a support officer</small></div>
    <div class="metric-card"><span class="metric-icon">◷</span><span class="metric-label">Waiting for Student</span><strong class="metric-value">${waiting}</strong><small class="metric-foot">Response requested</small></div>
    <div class="metric-card"><span class="metric-icon">✓</span><span class="metric-label">Resolved Today</span><strong class="metric-value">${resolvedToday}</strong><small class="metric-foot">Completed today</small></div>
    <div class="metric-card"><span class="metric-icon">◴</span><span class="metric-label">Avg. Response Time</span><strong class="metric-value">${responseTime == null ? "—" : `${responseTime}m`}</strong><small class="metric-foot">${responseTime == null ? "Not calculated yet" : "First staff response"}</small></div>
  </div>
  ${routingOverview}
  <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Recent Activity</h2><p class="panel-subtitle">Latest updates from the support queue</p></div><a class="text-link" href="#tickets">All tickets</a></div><div class="activity-list">${activities.length ? activities.map(event => `<div class="activity-row"><div class="activity-summary"><strong><a class="text-link" href="#ticket/${encodeURIComponent(event.ticketId)}">${escapeHtml(event.ticketId)}</a> · ${escapeHtml(event.subject)}</strong><small>${escapeHtml(timelineLabel(event.type))} · ${dateTime(event.createdAt)}</small></div>${statusPill(event.status)}</div>`).join("") : empty("No recent activity yet.")}</div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Support Workflow</h2><p class="panel-subtitle">A simple guide to handling enquiries</p></div></div><ol class="guide-list"><li><span class="guide-number">1</span><span>Review new enquiries and confirm the correct department.</span></li><li><span class="guide-number">2</span><span>Assign the request and update its status as work progresses.</span></li><li><span class="guide-number">3</span><span>Record staff updates in the conversation timeline.</span></li></ol><a class="button-secondary" href="#tickets">Open Ticket Queue</a></section></div>`;
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
  app.querySelectorAll("[data-ticket]").forEach(row => row.addEventListener("click", () => location.hash = "ticket/" + row.dataset.ticket));
  app.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => { page += button.dataset.page === "next" ? 1 : -1; renderQueue(); }));
  results.querySelector("[data-clear-filters]")?.addEventListener("click", () => { controls.querySelectorAll("input,select").forEach((control) => { control.value = control.name === "sort" ? "createdAt" : ""; }); page = 1; renderQueue(); });
}

async function ticketsPage() {
  app.innerHTML = `<section class="panel loading-state" role="status">Loading ticket queue…</section>`;
  departments = await ticketService.listDepartments();
  const departmentId = scopedDepartmentId();
  app.innerHTML = heading("Tickets", "Search, review and manage student support requests.") +
  `<section class="panel"><div class="queue-controls"><input name="search" type="search" placeholder="Search ticket, student or subject" aria-label="Search tickets"><select name="status" aria-label="Filter by status"><option value="">All statuses</option>${statuses.map(s=>`<option>${s}</option>`).join("")}</select><select name="department" aria-label="Filter by department" ${departmentId?"disabled":""}><option value="">All departments</option>${departments.filter(d=>!departmentId||d.id===departmentId).map(d=>`<option value="${d.id}" ${d.id===departmentId?"selected":""}>${escapeHtml(d.name)}</option>`).join("")}</select><select name="priority" aria-label="Filter by priority"><option value="">All priorities</option><option>Urgent</option><option>High</option><option>Normal</option><option>Low</option></select><select name="sort" aria-label="Sort tickets"><option value="createdAt">Newest first</option><option value="updatedAt">Recently updated</option><option value="subject">Subject A–Z</option></select></div><div data-results></div></section>`;
  app.querySelectorAll(".queue-controls input,.queue-controls select").forEach(control => control.addEventListener(control.tagName === "INPUT" ? "input" : "change", () => {page=1;renderQueue();}));
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
    `<div class="department-directory">${visibleUnits.map(unit=>`<article class="panel department-card"><div class="department-card__heading"><h2>${escapeHtml(unit.name)}</h2></div><div class="department-card__field"><strong>Responsibility</strong><p>${escapeHtml(responsibilities[unit.id] || `${unit.name} student support enquiries.`)}</p></div><div class="department-card__stats"><div><strong>Active tickets</strong><span>${ticketRows.filter(ticket=>ticket.departmentId===unit.id&&!['Resolved','Closed'].includes(ticket.status)).length}</span></div><div><strong>Assigned staff</strong><span>Not configured yet</span></div></div></article>`).join("")}</div>`;
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
  <section class="panel"><div class="panel-heading"><h2>Internal Notes</h2></div>${ticket.internalNotes.length ? ticket.internalNotes.map(n=>`<article class="conversation-message"><div class="message-meta"><span>${escapeHtml(n.author||"Support Staff")}</span><time>${dateTime(n.createdAt||ticket.updatedAt)}</time></div><p>${escapeHtml(n.body||n)}</p></article>`).join("") : empty("No internal notes recorded.")}<form class="note-form"><label for="internal-note">Internal note</label><textarea id="internal-note" name="note" placeholder="Add a staff-only note" aria-label="Internal note" required></textarea><p class="form-feedback" data-note-feedback aria-live="polite"></p><button class="button-secondary" type="submit">Add Internal Note</button></form></section></aside></div>`;
  app.querySelector(".detail-form").addEventListener("submit", async e => {e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),data=new FormData(form);button.disabled=true;button.textContent="Saving…";try{await ticketService.updateTicket(id,{status:data.get("status"),departmentId:data.get("departmentId")||null,assignedTo:data.get("assignedTo")||null});await detail(id);}catch(error){form.querySelector("[data-form-feedback]").textContent=error.message;button.disabled=false;button.textContent="Save ticket changes";}});
  app.querySelector(".reply-form").addEventListener("submit", async e => {e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),field=form.elements.reply,feedback=form.querySelector("[data-reply-feedback]");button.disabled=true;button.textContent="Sending…";try{await ticketService.addStaffReply(id,field.value);await detail(id);}catch(error){feedback.textContent=error.message;button.disabled=false;button.textContent="Send reply";}});
  app.querySelector("[data-route-suggestion]")?.addEventListener("click", async event => {const button=event.currentTarget;button.disabled=true;button.textContent="Routing…";try{await ticketService.routeTicket(id,button.dataset.routeSuggestion);await detail(id);}catch(error){button.disabled=false;button.textContent=error.message;}});
  app.querySelector(".note-form").addEventListener("submit", async e => {e.preventDefault();const form=e.currentTarget,field=form.elements.note,button=form.querySelector("button[type=submit]"),feedback=form.querySelector("[data-note-feedback]");if(!field.value.trim())return;button.disabled=true;button.textContent="Saving…";try{await ticketService.addInternalNote(id,field.value.trim());await detail(id);}catch(error){feedback.textContent=error.message;button.disabled=false;button.textContent="Add Internal Note";}});
}

async function route() {
  const route = location.hash.slice(1) || "dashboard";
  if (!route.startsWith("ticket/") && !["dashboard", "tickets", "departments", "staff", "reports"].includes(route)) {
    location.hash = "dashboard";
    return;
  }
  const section = route.startsWith("ticket/") ? "Tickets" : route[0].toUpperCase()+route.slice(1);
  document.querySelector("#current-section").textContent = section;
  document.querySelectorAll(".admin-sidebar nav a").forEach(a=>a.classList.toggle("active",a.dataset.page===(route.startsWith("ticket/")?"tickets":route)));
  document.querySelector("#admin-sidebar").classList.remove("is-open");
  app.innerHTML = `<section class="panel loading-state" role="status">Opening ${escapeHtml(section.toLowerCase())}…</section>`;
  try { if(route.startsWith("ticket/")) await detail(decodeURIComponent(route.slice(7))); else if(route==="tickets") await ticketsPage(); else if(route==="dashboard") await dashboard(); else if(route==="departments") await departmentsPage(); else app.innerHTML=heading(section,section+" workspace")+'<section class="panel placeholder-panel">This section is reserved for a future Support Centre phase.</section>'; }
  catch(error) { app.innerHTML=heading("Support Centre","Student support dashboard")+`<section class="panel error-state" role="alert"><strong>We could not load this view.</strong><p>${escapeHtml(error.message)}</p><button class="button-secondary" type="button" data-retry>Try again</button></section>`; app.querySelector("[data-retry]")?.addEventListener("click",route); }
}

document.querySelector(".menu-toggle").addEventListener("click",event=>{const open=document.querySelector("#admin-sidebar").classList.toggle("is-open");event.currentTarget.setAttribute("aria-expanded",String(open));});
window.addEventListener("hashchange",route);
const roleSelector = document.querySelector("#support-role");
roleSelector.value = selectedRole;
roleSelector.addEventListener("change", () => { selectedRole = roleSelector.value; sessionStorage.setItem("supportCentreRole", selectedRole); page = 1; route(); });
route();
