import { repositories } from "../../packages/repositories/repositories.js";
import { escapeHtml, formatDate, renderAppFrame, resultOrState, setRegionState } from "../../packages/ui/ui.js";

const navItems = [
  { route: "home", label: "Home" },
  { route: "admissions", label: "Admissions" },
  { route: "programmes", label: "Programmes" },
  { route: "fees", label: "Fees" },
  { route: "news", label: "News" },
  { route: "faqs", label: "FAQs" },
  { route: "contact", label: "Contact" }
];

const routeTitles = { home: "Home", admissions: "Admissions", programmes: "Programmes", fees: "Fees", news: "News", faqs: "FAQs", contact: "Contact", "front-desk": "Guest Digital Front Desk" };

function routeName() {
  return window.location.hash.replace(/^#/, "") || "home";
}

function heading(eyebrow, title, description = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1>${description ? `<p class="lede">${escapeHtml(description)}</p>` : ""}</div></div>`;
}

function pageFrame(route, body) {
  renderAppFrame({ client: "Public Website", title: routeTitles[route] || "Home", navItems, activeRoute: route, content: body });
}

function programmeCards(records) {
  return `<div class="content-grid">${records.map((programme) => `<article class="card span-4"><div class="card-header"><div><h3>${escapeHtml(programme.name)}</h3><p>${escapeHtml(programme.school)}</p></div><span class="icon-tile icon-tile--blue" aria-hidden="true">UG</span></div><div class="list"><div class="list-item"><span>Duration</span><strong>${escapeHtml(programme.duration)}</strong></div><div class="list-item"><span>Study mode</span><strong>${escapeHtml(programme.mode)}</strong></div></div></article>`).join("")}</div>`;
}

function announcementList(records, limit = records.length) {
  return `<ul class="list">${records.slice(0, limit).map((item) => `<li class="list-item"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><span class="status-badge">${escapeHtml(formatDate(item.date))}</span></li>`).join("")}</ul>`;
}

function chatMarkup() {
  return `<section class="chat-box" aria-labelledby="chat-title"><p class="eyebrow" style="color:#ffd86a">Guest Digital Front Desk</p><h2 id="chat-title">What would you like to find?</h2><p>Ask a general question to see a scripted demonstration response. Responses are not live AI advice.</p><form class="chat-form" data-chat-form><label class="sr-only" for="guest-question">Your question</label><input id="guest-question" name="question" placeholder="Try: How do I apply?" required /><button class="button button--primary" type="submit">Ask</button></form><div data-chat-response aria-live="polite"></div></section>`;
}

async function renderHome() {
  pageFrame("home", `<section class="hero"><p class="eyebrow" style="color:#ffd86a">University of Lusaka · Guest access</p><h1>A clear first step for every university question.</h1><p>Explore programmes, admissions guidance, campus information, and a demonstration Digital Front Desk experience built for the UNILUS community.</p><div class="button-row"><a class="button button--primary" href="#programmes">Explore programmes</a><a class="button button--secondary" href="#front-desk">Ask the Digital Front Desk</a></div></section><div class="content-grid"><div class="span-8" id="home-programmes"><div class="state-card state-card--loading"><span class="state-card__icon">◌</span><div><h3>Loading programmes</h3><p>Preparing local demonstration content…</p></div></div></div><div class="span-4">${chatMarkup()}</div><div class="span-7 card" id="home-news"><div class="state-card state-card--loading"><span class="state-card__icon">◌</span><div><h3>Loading announcements</h3><p>Preparing local demonstration content…</p></div></div></div><div class="span-5 card"><div class="card-header"><div><p class="eyebrow">Find your way</p><h2>Explore UNILUS</h2></div></div><ul class="list"><li class="list-item"><a class="card-link" href="#admissions">Admissions information →</a></li><li class="list-item"><a class="card-link" href="#fees">Fees and funding guidance →</a></li><li class="list-item"><a class="card-link" href="#contact">Contact and escalation points →</a></li></ul></div></div>`);
  const programmeRegion = document.querySelector("#home-programmes");
  const newsRegion = document.querySelector("#home-news");
  const [programmeResult, newsResult] = await Promise.all([repositories.programmes.list(), repositories.announcements.list()]);
  resultOrState(programmeRegion, programmeResult, (records) => `<div class="card-header"><div><p class="eyebrow">Study at UNILUS</p><h2>Featured programmes</h2></div><a class="card-link" href="#programmes">View all →</a></div>${programmeCards(records.slice(0, 3))}`);
  resultOrState(newsRegion, newsResult, (records) => `<div class="card-header"><div><p class="eyebrow">Campus updates</p><h2>Latest notices</h2></div><a class="card-link" href="#news">View all →</a></div>${announcementList(records, 3)}`);
  wireChat();
}

function wireChat() {
  document.querySelector("[data-chat-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.question;
    const responseRegion = document.querySelector("[data-chat-response]");
    responseRegion.innerHTML = `<div class="chat-response">Checking the scripted demo response…</div>`;
    const result = await repositories.conversation.respond(input.value.trim());
    if (result.status === "success") responseRegion.innerHTML = `<div class="chat-response"><small>${escapeHtml(result.data.citation)}</small>${escapeHtml(result.data.answer)}</div>`;
    else responseRegion.innerHTML = `<div class="chat-response"><small>Demo state</small>${escapeHtml(result.error)}</div>`;
  });
}

async function renderProgrammes() {
  pageFrame("programmes", `${heading("Study at UNILUS", "Programmes", "Browse structured demonstration records for selected study areas.")}<section id="page-region"><div class="state-card state-card--loading"><span class="state-card__icon">◌</span><div><h3>Loading programmes</h3><p>Preparing local demonstration content…</p></div></div></section>`);
  const region = document.querySelector("#page-region");
  resultOrState(region, await repositories.programmes.list(), (records) => programmeCards(records));
}

async function renderNews() {
  pageFrame("news", `${heading("Campus updates", "News and notices", "Demonstration announcements are clearly labelled and loaded through a repository.")}<section class="card" id="page-region"><div class="state-card state-card--loading"><span class="state-card__icon">◌</span><div><h3>Loading announcements</h3><p>Preparing local demonstration content…</p></div></div></section>`);
  const region = document.querySelector("#page-region");
  resultOrState(region, await repositories.announcements.list(), (records) => announcementList(records));
}

async function renderFaqs() {
  pageFrame("faqs", `${heading("Need a quick answer?", "Frequently asked questions", "Official information should be confirmed with the university when details may change.")}<section class="content-grid" id="page-region"><div class="span-12 state-card state-card--loading"><span class="state-card__icon">◌</span><div><h3>Loading FAQs</h3><p>Preparing local demonstration content…</p></div></div></section>`);
  const region = document.querySelector("#page-region");
  resultOrState(region, await repositories.faqs.list(), (records) => records.map((faq) => `<article class="card span-4"><span class="status-badge">${escapeHtml(faq.category)}</span><h3 style="margin-top:1rem">${escapeHtml(faq.question)}</h3><p class="lede" style="font-size:.9rem">${escapeHtml(faq.answer)}</p></article>`).join(""));
}

async function renderFrontDesk() {
  pageFrame("front-desk", `${heading("Guest access", "Digital Front Desk", "A demonstration conversation entry point for common public enquiries.")}<div class="content-grid"><div class="span-7">${chatMarkup()}</div><div class="span-5 card"><div class="card-header"><div><p class="eyebrow">Suggested topics</p><h2>Start here</h2></div></div><ul class="list"><li class="list-item"><span>Admissions and applications</span><span class="status-badge">Ask</span></li><li class="list-item"><span>Fees and funding</span><span class="status-badge">Ask</span></li><li class="list-item"><span>Student support</span><span class="status-badge">Ask</span></li></ul><p class="lede" style="font-size:.82rem">This interface uses scripted local responses and does not represent a live AI service.</p></div></div>`);
  wireChat();
}

function renderStatic(route) {
  const pages = {
    admissions: ["Admissions", "Admissions guidance", "Use this demonstration page as a starting point, then confirm current requirements through an approved university channel.", ["Review the programme requirements", "Prepare the documents requested for your selected programme", "Contact the Academic Office for current deadlines"]],
    fees: ["Planning your studies", "Fees and funding", "Fee figures are intentionally not presented as live university data in this Phase 1 environment.", ["Review the fee schedule with the university", "Ask about payment arrangements through an approved channel", "Do not submit financial information to this demonstration"]],
    contact: ["Need assistance?", "Contact and escalation", "Use the right official office for questions that require verified university information.", ["Academic Office · Programme and study guidance", "Registry · Student records and official status", "Admissions · Application process questions"]]
  };
  const page = pages[route];
  pageFrame(route, `${heading(page[0], page[1], page[2])}<div class="content-grid"><section class="card span-7"><div class="card-header"><div><p class="eyebrow">Next steps</p><h2>How this demo guides you</h2></div></div><ul class="list">${page[3].map((item, index) => `<li class="list-item"><span class="icon-tile icon-tile--blue" aria-hidden="true">0${index + 1}</span><span>${escapeHtml(item)}</span></li>`).join("")}</ul></section><aside class="card span-5"><p class="eyebrow">Important</p><h2>Verify before relying on details</h2><p class="lede">This client is a user interface foundation. It does not connect to live university records or publish official decisions.</p><a class="button button--quiet" href="#front-desk">Ask the demo Front Desk</a></aside></div>`);
}

async function renderRoute() {
  const route = routeName();
  if (route === "home") return renderHome();
  if (route === "programmes") return renderProgrammes();
  if (route === "news") return renderNews();
  if (route === "faqs") return renderFaqs();
  if (route === "front-desk") return renderFrontDesk();
  if (["admissions", "fees", "contact"].includes(route)) return renderStatic(route);
  window.location.hash = "home";
}

window.addEventListener("hashchange", renderRoute);
renderRoute();
