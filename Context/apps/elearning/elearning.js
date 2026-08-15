import { repositories } from "../../packages/repositories/repositories.js";
import { escapeHtml, renderAppFrame, resultOrState } from "../../packages/ui/ui.js";

const navItems = [
  { route: "dashboard", label: "Dashboard" },
  { route: "courses", label: "My courses" },
  { route: "calendar", label: "Calendar" },
  { route: "announcements", label: "Announcements" },
  { route: "profile", label: "Profile" }
];

function routeName() { return window.location.hash.replace(/^#/, "") || "dashboard"; }
function pageFrame(route, body) { renderAppFrame({ client: "E-learning Platform", title: route, navItems, activeRoute: route, content: body }); }
function loading(title) { return `<div class="state-card state-card--loading"><span class="state-card__icon">◌</span><div><h3>${title}</h3><p>Preparing local demonstration content…</p></div></div>`; }

function courseCards(records) {
  return `<div class="content-grid">${records.map((course) => `<article class="card span-4"><div class="card-header"><div><span class="status-badge">${escapeHtml(course.code)}</span><h3 style="margin-top:.7rem">${escapeHtml(course.name)}</h3><p>${escapeHtml(course.tutor)}</p></div><span class="icon-tile icon-tile--${escapeHtml(course.colour)}" aria-hidden="true">${course.progress}%</span></div><div style="background:var(--color-line);border-radius:999px;height:.45rem;overflow:hidden"><span style="background:var(--color-blue-600);display:block;height:100%;width:${course.progress}%"></span></div><p class="lede" style="font-size:.82rem;margin-bottom:0">Next: ${escapeHtml(course.next)}</p></article>`).join("")}</div>`;
}

function activityList(records, limit = records.length) {
  return `<ul class="list">${records.slice(0, limit).map((activity) => `<li class="list-item"><div><h3>${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.course)} · ${escapeHtml(activity.type)}</p></div><span class="status-badge status-badge--warning">${escapeHtml(activity.due)}</span></li>`).join("")}</ul>`;
}

async function renderDashboard() {
  pageFrame("dashboard", `<div class="page-heading"><div><p class="eyebrow">Learning mode · Demonstration learner</p><h1>Good afternoon, Thandiwe</h1><p class="lede">A separate learning environment for courses, calendar events, announcements, and upcoming activities.</p></div><span class="status-badge status-badge--success">Demo learner</span></div><div id="dashboard-region">${loading("Loading learning dashboard")}</div>`);
  const region = document.querySelector("#dashboard-region");
  const [courses, activities, announcements] = await Promise.all([repositories.courses.list(), repositories.activities.list(), repositories.announcements.list()]);
  const error = [courses, activities, announcements].find((item) => item.status === "error");
  if (error) return resultOrState(region, error, () => "");
  if ([courses, activities, announcements].some((item) => item.status === "empty")) return resultOrState(region, { status: "empty" }, () => "");
  region.innerHTML = `${courseCards(courses.data)}<div class="content-grid"><section class="card span-7"><div class="card-header"><div><p class="eyebrow">Keep moving</p><h2>Upcoming activities</h2></div><a class="card-link" href="#calendar">Open calendar →</a></div>${activityList(activities.data)}</section><section class="card span-5"><div class="card-header"><div><p class="eyebrow">Learning updates</p><h2>Announcements</h2></div><a class="card-link" href="#announcements">View all →</a></div>${announcements.data.slice(0, 2).map((item) => `<div class="list-item"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.category)}</p></div><span class="status-badge">New</span></div>`).join("")}</section></div>`;
}

async function renderCourses() {
  pageFrame("courses", `<div class="page-heading"><div><p class="eyebrow">Learning space</p><h1>My courses</h1><p class="lede">Course progress and next activities are loaded from local fixtures.</p></div></div><section id="page-region">${loading("Loading courses")}</section>`);
  resultOrState(document.querySelector("#page-region"), await repositories.courses.list(), (records) => courseCards(records));
}

async function renderCalendar() {
  pageFrame("calendar", `<div class="page-heading"><div><p class="eyebrow">Plan your week</p><h1>Calendar</h1><p class="lede">Upcoming learning activities shown as a demonstration schedule.</p></div></div><section class="card" id="page-region">${loading("Loading calendar")}</section>`);
  resultOrState(document.querySelector("#page-region"), await repositories.activities.list(), (records) => `<div class="table-wrap"><table><thead><tr><th>Activity</th><th>Course</th><th>Type</th><th>Due</th></tr></thead><tbody>${records.map((activity) => `<tr><td><strong>${escapeHtml(activity.title)}</strong></td><td>${escapeHtml(activity.course)}</td><td>${escapeHtml(activity.type)}</td><td><span class="status-badge status-badge--warning">${escapeHtml(activity.due)}</span></td></tr>`).join("")}</tbody></table></div>`);
}

async function renderAnnouncements() {
  pageFrame("announcements", `<div class="page-heading"><div><p class="eyebrow">Learning updates</p><h1>Announcements</h1><p class="lede">This LMS view is separate from the student portal while sharing approved presentation patterns.</p></div></div><section class="card" id="page-region">${loading("Loading announcements")}</section>`);
  resultOrState(document.querySelector("#page-region"), await repositories.announcements.list(), (records) => `<div class="content-grid">${records.map((item) => `<article class="card span-4"><span class="status-badge">${escapeHtml(item.category)}</span><h3 style="margin-top:1rem">${escapeHtml(item.title)}</h3><p class="lede" style="font-size:.88rem">${escapeHtml(item.summary)}</p></article>`).join("")}</div>`);
}

function renderProfile() {
  pageFrame("profile", `<div class="page-heading"><div><p class="eyebrow">Learning mode</p><h1>Learner profile</h1><p class="lede">A simulated LMS identity for demonstration only.</p></div></div><section class="card"><div class="card-header"><div><p class="eyebrow">Demo learner</p><h2>Thandiwe Banda</h2><p>Bachelor of Business Administration · Year 2</p></div><span class="status-badge status-badge--warning">Not live</span></div><div class="list"><div class="list-item"><span>Learning status</span><strong>Active demonstration</strong></div><div class="list-item"><span>Connected courses</span><strong>3 local records</strong></div><div class="list-item"><span>Authentication</span><strong>Not connected</strong></div></div></section>`);
}

async function renderRoute() {
  const route = routeName();
  if (route === "dashboard") return renderDashboard();
  if (route === "courses") return renderCourses();
  if (route === "calendar") return renderCalendar();
  if (route === "announcements") return renderAnnouncements();
  if (route === "profile") return renderProfile();
  window.location.hash = "dashboard";
}

window.addEventListener("hashchange", renderRoute);
renderRoute();
