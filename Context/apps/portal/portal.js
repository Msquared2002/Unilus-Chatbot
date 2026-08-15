import { repositories } from "../../packages/repositories/repositories.js";
import { escapeHtml, formatDate, renderAppFrame, resultOrState } from "../../packages/ui/ui.js";

const navItems = [
  { route: "dashboard", label: "Dashboard" },
  { route: "notices", label: "Notices" },
  { route: "timetable", label: "Timetable" },
  { route: "registration", label: "Registration" },
  { route: "profile", label: "My profile" }
];

function routeName() { return window.location.hash.replace(/^#/, "") || "dashboard"; }
function pageFrame(route, body) { renderAppFrame({ client: "Student Portal", title: route, navItems, activeRoute: route, content: body }); }
function loading(title) { return `<div class="state-card state-card--loading"><span class="state-card__icon">◌</span><div><h3>${title}</h3><p>Preparing local demonstration content…</p></div></div>`; }

function profileSummary(profile) {
  return `<div class="card"><div class="card-header"><div><p class="eyebrow">Demo identity</p><h2>${escapeHtml(profile.name)}</h2><p>${escapeHtml(profile.programme)} · ${escapeHtml(profile.year)}</p></div><span class="status-badge status-badge--warning">${escapeHtml(profile.status)}</span></div><div class="list"><div class="list-item"><span>Student number</span><strong>${escapeHtml(profile.studentNumber)}</strong></div><div class="list-item"><span>Email</span><strong>${escapeHtml(profile.email)}</strong></div></div></div>`;
}

function noticeList(records, limit = records.length) {
  return `<ul class="list">${records.slice(0, limit).map((item) => `<li class="list-item"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><span class="status-badge">${escapeHtml(formatDate(item.date))}</span></li>`).join("")}</ul>`;
}

async function renderDashboard() {
  pageFrame("dashboard", `<div class="page-heading"><div><p class="eyebrow">Student mode · Demonstration profile</p><h1>Your student dashboard</h1><p class="lede">A separate student experience for future authenticated workflows. This profile is simulated and no credentials are collected.</p></div><a class="button button--secondary" href="#login">Demo access details</a></div><div id="dashboard-region">${loading("Loading dashboard")}</div>`);
  const region = document.querySelector("#dashboard-region");
  const [profile, notices, timetable] = await Promise.all([repositories.profile.get(), repositories.announcements.list(), repositories.timetable.list()]);
  const error = [profile, notices, timetable].find((item) => item.status === "error");
  if (error) return resultOrState(region, error, () => "");
  if ([profile, notices, timetable].some((item) => item.status === "empty")) return resultOrState(region, { status: "empty" }, () => "");
  region.innerHTML = `${profileSummary(profile.data)}<div class="stat-grid"><div class="stat-card"><strong>03</strong><span>Active courses</span></div><div class="stat-card"><strong>04</strong><span>Timetable entries</span></div><div class="stat-card"><strong>03</strong><span>New notices</span></div><div class="stat-card"><strong>02</strong><span>Open actions</span></div></div><div class="content-grid"><section class="card span-7"><div class="card-header"><div><p class="eyebrow">What is new</p><h2>Student notices</h2></div><a class="card-link" href="#notices">View all →</a></div>${noticeList(notices.data, 3)}</section><section class="card span-5"><div class="card-header"><div><p class="eyebrow">This week</p><h2>Timetable snapshot</h2></div><a class="card-link" href="#timetable">Open timetable →</a></div>${timetable.data.slice(0, 3).map((item) => `<div class="list-item"><div><strong>${escapeHtml(item.day)} · ${escapeHtml(item.time)}</strong><p>${escapeHtml(item.course)}</p></div><span class="status-badge">${escapeHtml(item.room)}</span></div>`).join("")}</section></div>`;
}

async function renderNotices() {
  pageFrame("notices", `<div class="page-heading"><div><p class="eyebrow">Student communication</p><h1>Notices</h1><p class="lede">A repository-backed view of student announcements for demonstration purposes.</p></div></div><section class="card" id="page-region">${loading("Loading notices")}</section>`);
  resultOrState(document.querySelector("#page-region"), await repositories.announcements.list(), (records) => noticeList(records));
}

async function renderTimetable() {
  pageFrame("timetable", `<div class="page-heading"><div><p class="eyebrow">Academic planning</p><h1>Timetable</h1><p class="lede">Demo timetable entries show the future shape of a student service response.</p></div></div><section class="card" id="page-region">${loading("Loading timetable")}</section>`);
  resultOrState(document.querySelector("#page-region"), await repositories.timetable.list(), (records) => `<div class="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Course</th><th>Location</th></tr></thead><tbody>${records.map((item) => `<tr><td><strong>${escapeHtml(item.day)}</strong></td><td>${escapeHtml(item.time)}</td><td>${escapeHtml(item.course)}</td><td><span class="status-badge">${escapeHtml(item.room)}</span></td></tr>`).join("")}</tbody></table></div>`);
}

async function renderProfile() {
  pageFrame("profile", `<div class="page-heading"><div><p class="eyebrow">Student mode</p><h1>My profile</h1><p class="lede">This is a simulated student profile for interface testing only.</p></div></div><section id="page-region">${loading("Loading profile")}</section>`);
  resultOrState(document.querySelector("#page-region"), await repositories.profile.get(), (profile) => profileSummary(profile));
}

function renderRegistration() {
  pageFrame("registration", `<div class="page-heading"><div><p class="eyebrow">Student services</p><h1>Registration shortcuts</h1><p class="lede">These actions demonstrate the portal's future service entry points without submitting any real request.</p></div></div><div class="content-grid"><article class="card span-4"><span class="icon-tile icon-tile--blue">01</span><h3 style="margin-top:1rem">View registration status</h3><p class="lede" style="font-size:.88rem">Open a future read-only status view.</p><span class="status-badge status-badge--warning">Demo unavailable</span></article><article class="card span-4"><span class="icon-tile icon-tile--gold">02</span><h3 style="margin-top:1rem">Add or drop a course</h3><p class="lede" style="font-size:.88rem">Reserved for a future authenticated workflow.</p><span class="status-badge status-badge--warning">Demo unavailable</span></article><article class="card span-4"><span class="icon-tile icon-tile--green">03</span><h3 style="margin-top:1rem">Request academic support</h3><p class="lede" style="font-size:.88rem">Connect with the correct official escalation point.</p><a class="button button--quiet" href="../../apps/website/index.html#contact">View contacts</a></article></div>`);
}

function renderLogin() {
  pageFrame("login", `<div class="content-grid"><section class="card span-7"><p class="eyebrow">Visual demonstration only</p><h1>Student portal access</h1><p class="lede">University authentication remains the identity source of truth. This Phase 1 screen intentionally has no username, password, or sign-in submission fields.</p><div class="demo-banner"><strong>No credentials required</strong><span>Continue to the simulated portal session for interface review.</span></div><a class="button button--primary" href="#dashboard">Continue to demo portal</a></section><aside class="card span-5"><p class="eyebrow">Boundary</p><h2>What is not connected?</h2><ul class="list"><li class="list-item"><span>University identity provider</span><span class="status-badge status-badge--warning">Not connected</span></li><li class="list-item"><span>Student records</span><span class="status-badge status-badge--warning">Not connected</span></li><li class="list-item"><span>Live services</span><span class="status-badge status-badge--warning">Not connected</span></li></ul></aside></div>`);
}

async function renderRoute() {
  const route = routeName();
  if (route === "dashboard") return renderDashboard();
  if (route === "notices") return renderNotices();
  if (route === "timetable") return renderTimetable();
  if (route === "registration") return renderRegistration();
  if (route === "profile") return renderProfile();
  if (route === "login") return renderLogin();
  window.location.hash = "dashboard";
}

window.addEventListener("hashchange", renderRoute);
renderRoute();
