let avatarReactionTimer = null;
let latestAvatarRequest = 0;

function reactAvatar(state, duration = 1800) {
  clearTimeout(avatarReactionTimer);
  const request = latestAvatarRequest;
  UniAvatar[state]();
  if (state !== "thinking" && state !== "idle") {
    avatarReactionTimer = setTimeout(() => {
      if (request === latestAvatarRequest) UniAvatar.idle();
      avatarReactionTimer = null;
    }, duration);
  }
}

function responseEmotion(data, answer) {
  if (!answer || !String(answer).trim()) return "sad";
  const message = String(answer || "").trim();
  const status = String(data?.status || data?.answerStatus || "").toLowerCase();
  if (["not_found", "no_answer", "unanswered"].includes(status) ||
      /^(sorry,?\s*)?(i (couldn.t|cannot|can.t|wasn.t able to) (find|locate|answer)|i (don.t|do not) have (that|enough) information|no (relevant )?(information|answer) (was )?found)/i.test(message)) return "sad";
  if (["uncertain", "warning"].includes(status)) return "worry";
  if (data?.emotion === "surprised" || data?.reaction === "surprised") return "surprised";
  if (/^(hi|hello|hey|good (morning|afternoon|evening))[!, .]/i.test(message) ||
      /^(congratulations|great news|well done)[!, .]/i.test(message)) return "happy";
  return "idle";
}

document.getElementById("input-area").addEventListener("submit", function (e) {
  e.preventDefault();
  sendMessage();
});

// Chatbot decides, user confirms, map displays. If the backend response
// includes navigation data, show the answer plus a "View on Map" button
// - never switch views or touch the map ourselves. All map decisions
// (campus, building lookup, flying, card rendering) happen inside
// CampusMap once the user clicks. See addMapConfirmButton() below for
// the one temporary fallback this currently requires.


async function sendMessage() {

  const input = document.getElementById("user-input");
  const text = input.value.trim();

  if (!text) return;


  addMessage(text, "user");

  input.value = "";

  const request = ++latestAvatarRequest;
  reactAvatar("thinking");


  const typingRow = addTypingIndicator();


  try {

    const headers = { "Content-Type": "application/json" };
    let token = null, chatSession = null;
    try {
      token = sessionStorage.getItem("unilusAuthToken");        // set by the portal sign-in
      chatSession = sessionStorage.getItem("unilusChatSession"); // keeps follow-up questions together
    } catch { /* storage unavailable: carry on as a visitor */ }
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch("http://localhost:5000/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        question: text,
        ...(chatSession ? { sessionId: chatSession } : {}),
        // Set by upload.js while a file is attached to the chat; undefined otherwise (so it is left out).
        documentId: window.UnilusUpload ? window.UnilusUpload.activeId() : undefined
      })
    });

    if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);

    const data = await response.json();

    try {
      if (data.sessionId) sessionStorage.setItem("unilusChatSession", data.sessionId);
      if (data.authProblem) sessionStorage.removeItem("unilusAuthToken"); // expired or refused token
    } catch { /* ignore */ }


    removeTypingIndicator(typingRow);

    const botRow = addMessage(
      data.answer || "I received your message.",
      "bot",
      request === latestAvatarRequest
    );

    if (request === latestAvatarRequest) reactAvatar(responseEmotion(data, data.answer), 2200);


    if (window.UnilusUpload) window.UnilusUpload.afterReply(botRow, data);

    // Optional thumbs up / down under the answer (feedback.js).
    if (window.UnilusFeedback) window.UnilusFeedback.afterReply(botRow, data, text);

    // Chatbot found a place - offer to show it, don't force the map open.
    if (data.navigation) {
      addMapConfirmButton(botRow, data.navigation, data.route, data.routeIntent);
    }

  } catch(error) {

    console.error("Chat error:", error);

    removeTypingIndicator(typingRow);

    addMessage(
      "Sorry, I am having trouble connecting right now. Please try again.",
      "bot",
      request === latestAvatarRequest
    );
    if (request === latestAvatarRequest) reactAvatar("worry", 2600);

  }

}
    

function addMessage(text, type, moveAvatar = true) {

  const box = document.getElementById("chat-box");

  const row = document.createElement("div");

  row.className = "message-row " + type;


  if (type === "bot") {

    const slot = document.createElement("div");

    slot.className = "avatar-slot avatar-slot--inline";

    row.appendChild(slot);

  }


  const bubble = document.createElement("div");

  bubble.className = "bubble";


  if (type === "bot") {

    if (typeof marked !== "undefined") {

        bubble.innerHTML = marked.parse(text);
        enhanceMarkdownTables(bubble);

    } else {

        bubble.textContent = text;

    }

} else {

    bubble.textContent = text;

}


  row.appendChild(bubble);


  box.appendChild(row);

  box.scrollTop = box.scrollHeight;


  if (type === "bot") {

    if (moveAvatar && typeof UnilusWidget !== "undefined") {

        UnilusWidget.onBotMessage(row);

    }

}


  return row;

}


// Keep Markdown tables contained inside the bot message. Timetables are
// detected from their semantic headers so only the dense 7-column schedule
// layout gets the wider column sizing; fee tables and other small tables keep
// their normal responsive width.
// Keep Markdown tables contained inside the bot message. Timetables are
// detected from their semantic headers so only the dense schedule layout
// gets the wider column sizing; fee tables and other small tables keep
// their normal responsive width.
function enhanceMarkdownTables(bubble) {

  const tables = Array.from(bubble.querySelectorAll("table"));

  if (!tables.length) return;


  // Mark the bubble itself.
  bubble.classList.add("bubble--table");


  // IMPORTANT:
  // Also mark the parent message row so CSS can make the entire
  // bot response use the available chat width.
  const row = bubble.closest(".message-row");

  if (row) {
    row.classList.add("message-row--table");
  }


  // Tell the chat view that a wide table exists.
  const chatView = document.getElementById("view-chat");

  if (chatView) {
    chatView.classList.add("has-wide-table");
  }


  tables.forEach((table) => {

    // Avoid double wrapping if this helper is called again.
    if (
      table.parentElement &&
      table.parentElement.classList.contains("chat-table-scroll")
    ) {
      return;
    }


    const headers = Array.from(
      table.querySelectorAll("thead th")
    ).map((th) =>
      th.textContent.trim().toLowerCase()
    );


    const isTimetable =
      headers.includes("day") &&
      headers.includes("time") &&
      headers.some((header) =>
        header.includes("course")
      ) &&
      headers.some((header) =>
        header.includes("lecturer")
      ) &&
      headers.some((header) =>
        header.includes("venue")
      );


    const wrapper = document.createElement("div");

    wrapper.className = isTimetable
      ? "chat-table-scroll chat-table-scroll--timetable"
      : "chat-table-scroll";


    table.parentNode.insertBefore(wrapper, table);

    wrapper.appendChild(table);

  });

}

// Appends a "View on Map" button to a bot message row once the chatbot
// has confirmed a specific place. Clicking it is the ONLY thing that
// triggers the map - see the comment at the top of this file for why
// campus is hardcoded to Silverest here rather than read from the
// backend payload.
function addMapConfirmButton(row, navigation, route, routeIntent) {

  const bubble = row.querySelector(".bubble");
  if (!bubble) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "map-confirm-btn";
  btn.textContent = route?.status === "ok" ? "View Walking Route" : "View on Map";

  btn.addEventListener("click", () => {
    btn.disabled = true;
    btn.textContent = "Showing on map…";

    if (typeof UnilusWidget !== "undefined") {
      UnilusWidget.showBuildingOnMap({
        buildingId: navigation.buildingId || navigation.placeId,
        // TEMPORARY fallback: mapResponseBuilder.js doesn't send a
        // `campus` field yet, and its data only covers Silverest today.
        // Remove this fallback once the backend returns campus info -
        // at that point `navigation.campus` will always be present and
        // this line becomes dead code you can delete.
        campus: navigation.campus || "silverest",
        route
      });
    }
  });

  bubble.appendChild(btn);
  if (routeIntent && !routeIntent.origin) {
    const gpsButton = document.createElement("button");
    gpsButton.type = "button";
    gpsButton.className = "map-confirm-btn";
    gpsButton.textContent = "Directions in Google Maps";
    gpsButton.addEventListener("click", () => {
      if (typeof UnilusWidget === "undefined") return;
      const mapsTab = window.open("about:blank", "_blank");
      UnilusWidget.showBuildingOnMap({ buildingId: navigation.placeId, campus: "silverest", routeFromGps: true, mapsTab });
    });
    bubble.appendChild(gpsButton);
  }
}

// Shown while the bot is "thinking", in place of a fixed 1-second delay
// with no feedback. Reuses the same bot-row layout (inline avatar slot +
// bubble) so it slots into the conversation like a real message.
function addTypingIndicator() {

  const box = document.getElementById("chat-box");

  const row = document.createElement("div");
  row.className = "message-row bot";

  const slot = document.createElement("div");
  slot.className = "avatar-slot avatar-slot--inline";

  row.appendChild(slot);


  const bubble = document.createElement("div");
  bubble.className = "bubble";

  bubble.innerHTML =
    `<span class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
     </span>`;


  row.appendChild(bubble);


  box.appendChild(row);

  box.scrollTop = box.scrollHeight;


  return row;
}

function removeTypingIndicator(row) {
  if (row && row.parentNode) row.parentNode.removeChild(row);
}


/* ---------------- Update notifications ----------------
Changes: Polls /api/notifications and shows new notices (new documents, ticket updates).
Affects: The launcher button (badge) and the chat box (notice messages). Uses addMessage() above.
Purpose: Students hear about changes without asking. The id of the newest notice shown is kept
         in localStorage so each notice appears once per browser; if storage is unavailable the
         widget simply shows recent notices again after a reload. */
(function () {
  const POLL_MS = 60000;
  const SEEN_KEY = "unilusNotifSeen"; // per person: see seenKey()
  const API_BASE = "http://localhost:5000/api/notifications";
  let lastSeen = null;      // newest notice id already shown (null = never seen any)
  let pending = [];         // notices fetched while the chat was closed
  let badge = null;
  let lastIdentity = null;

  // Whose notices these are, read from the sign-in token (its middle part is plain JSON).
  // Display only: the server decides who may see what from the token it verifies.
  // Keyed per person so two people sharing a browser each get their own notices.
  function who() {
    try {
      const token = sessionStorage.getItem("unilusAuthToken");
      if (!token) return "visitor";
      const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return String(JSON.parse(atob(part)).sub || "visitor").toLowerCase();
    } catch { return "visitor"; }
  }
  const seenKey = () => `${SEEN_KEY}:${who()}`;

  function readSeen() {
    try { const v = localStorage.getItem(seenKey()); return v === null ? null : Number(v) || 0; } catch { return null; }
  }
  function writeSeen(id) {
    lastSeen = id;
    try { localStorage.setItem(seenKey(), String(id)); } catch { /* ignore */ }
  }

  function escapeText(text) {
    return String(text == null ? "" : text).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  function chatIsOpen() {
    const launcher = document.getElementById("launcher");
    return Boolean(launcher && launcher.classList.contains("is-hidden"));
  }

  function updateBadge() {
    const launcher = document.getElementById("launcher");
    if (!launcher) return;
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "uw-badge";
      badge.setAttribute("aria-live", "polite");
      launcher.appendChild(badge);
    }
    badge.textContent = pending.length > 9 ? "9+" : String(pending.length);
    badge.hidden = pending.length === 0;
    launcher.setAttribute("aria-label", pending.length
      ? `Open Unilus companion chat, ${pending.length} new update${pending.length === 1 ? "" : "s"}`
      : "Open Unilus companion chat");
  }

  function showInChat(items) {
    for (const item of items) {
      const body = item.body ? `\n\n${escapeText(item.body)}` : "";
      addMessage(`📢 **${escapeText(item.title)}**${body}`, "bot", false);
    }
  }

  // A pop-up on the page itself (not only inside the chat) so a resolved ticket is noticed
  // on the portal. Plain text only; removed by itself after 9 seconds or on click.
  function toast(item) {
    const box = document.createElement("div");
    box.className = "uw-toast";
    box.setAttribute("role", "status");
    const heading = document.createElement("strong");
    heading.textContent = item.title;
    box.appendChild(heading);
    if (item.body) {
      const text = document.createElement("span");
      text.textContent = item.body;
      box.appendChild(text);
    }
    box.addEventListener("click", () => box.remove());
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 9000);
  }

  function flushPending() {
    if (!pending.length) return;
    const items = pending;
    pending = [];
    showInChat(items);
    updateBadge();
  }

  async function poll() {
    try {
      const identity = who();
      if (identity !== lastIdentity) { lastIdentity = identity; lastSeen = readSeen(); pending = []; updateBadge(); }
      const headers = {};
      let token = null, chatSession = null;
      try {
        token = sessionStorage.getItem("unilusAuthToken");
        chatSession = sessionStorage.getItem("unilusChatSession");
      } catch { /* storage unavailable: poll as a visitor */ }
      if (token) headers.Authorization = `Bearer ${token}`;

      const params = new URLSearchParams({ after: String(lastSeen === null ? 0 : lastSeen) });
      if (lastSeen === null) params.set("limit", "3"); // first visit: only the latest few
      if (chatSession) params.set("sessionId", chatSession);

      const response = await fetch(`${API_BASE}?${params}`, { headers });
      if (!response.ok) return;
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        if (lastSeen === null) writeSeen(Number(data.latestId) || 0);
        return;
      }

      writeSeen(Math.max(...items.map((i) => Number(i.id) || 0), lastSeen || 0));
      if (chatIsOpen()) {
        showInChat(items);
      } else {
        pending = pending.concat(items);
        updateBadge();
        items.filter((i) => i.kind === "ticket").slice(-2).forEach(toast);
      }
    } catch {
      /* offline or backend down: try again on the next poll */
    }
  }

  function start() {
    lastSeen = readSeen();
    const launcher = document.getElementById("launcher");
    if (launcher) launcher.addEventListener("click", () => setTimeout(flushPending, 700));
    setTimeout(poll, 3000);
    setInterval(poll, POLL_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();


/* ---------------- Helpers shared with upload.js ----------------
Changes: Exposes the chat helpers that upload.js needs.
Affects: window.UnilusChat (read by upload.js only).
Purpose: app.js is bundled by Vite, so its functions are not global; upload.js adds messages through this object
         instead of copying the chat rendering code. */
window.UnilusChat = { addMessage, addTypingIndicator, removeTypingIndicator, reactAvatar };
