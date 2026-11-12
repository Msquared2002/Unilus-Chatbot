/*
Changes: Adds an optional "Was this helpful?" thumbs up / down under each answer. A thumbs down can also take a
         reason and a short comment. Nothing pops up and nothing is required.
Affects: Bot replies in #chat-box. Talks to POST /api/feedback and PATCH /api/feedback/:id.
         app.js calls one hook here: UnilusFeedback.afterReply(row, data, question) after each reply.
Purpose: Staff learn which answers were wrong, out of date or unclear, and can use that to improve the knowledge base.
         The thumb is saved the moment it is tapped (so a quick thumbs down still counts); the reason and comment are
         added to the same record only if the student chooses to send them. The server keeps the question, the answer,
         the thumb, the reason and the comment, and only whether the person was signed in. It never stores a name.
         All text is inserted with textContent, never as HTML.
*/
(function () {
  const API = "http://localhost:5000/api/feedback"; // same host app.js talks to

  const REASONS = [
    ["wrong", "Wrong information"],
    ["outdated", "Out of date"],
    ["not_answered", "Didn't answer my question"],
    ["unclear", "Hard to understand"],
    ["other", "Something else"],
  ];

  const UP_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M9 21h9a2 2 0 0 0 1.9-1.4l2-6.5A2 2 0 0 0 20 10.5h-5.2l.8-3.8a2 2 0 0 0-.5-1.8L14 4 8.6 9.9A2 2 0 0 0 8 11.3V19a2 2 0 0 0 1 2ZM2 11h4v10H2V11Z"/></svg>';
  const DOWN_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M15 3H6a2 2 0 0 0-1.9 1.4l-2 6.5A2 2 0 0 0 4 13.5h5.2l-.8 3.8a2 2 0 0 0 .5 1.8L10 20l5.4-5.9A2 2 0 0 0 16 12.7V5a2 2 0 0 0-1-2ZM18 3h4v10h-4V3Z"/></svg>';

  const STYLE = `
.uw-fb{ margin:8px 0 0; font-size:11px; color:var(--text-muted); }
.uw-fb-row{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.uw-fb-thumb{
  display:inline-flex; align-items:center; justify-content:center; width:26px; height:24px; padding:0;
  border:1px solid var(--border-input); border-radius:12px; background:transparent; color:var(--text-muted); cursor:pointer;
}
.uw-fb-thumb:hover{ color:var(--brand); border-color:var(--brand); }
.uw-fb-thumb[aria-pressed="true"]{ background:var(--brand); border-color:var(--brand); color:var(--bg); }
.uw-fb-thumb[disabled]{ opacity:.6; cursor:progress; }
.uw-fb-status{ margin-left:2px; }
.uw-fb-status.is-error{ color:#d93025; }
.uw-fb-more{ margin:8px 0 0; padding:8px 10px; border:1px solid var(--border-input); border-radius:12px; background:var(--bg-raised); animation:uw-fb-in .2s ease; }
.uw-fb-more[hidden]{ display:none; }
.uw-fb-q{ margin:0 0 6px; font-weight:600; color:var(--text); }
.uw-fb-chips{ display:flex; flex-wrap:wrap; gap:5px; margin:0 0 8px; }
.uw-fb-chip{
  padding:3px 9px; border:1px solid var(--border-input); border-radius:12px; background:transparent;
  color:var(--text-muted); font-size:11px; cursor:pointer;
}
.uw-fb-chip:hover{ color:var(--brand); border-color:var(--brand); }
.uw-fb-chip[aria-pressed="true"]{ background:var(--bg-accent-soft); border-color:var(--brand); color:var(--brand); font-weight:600; }
.uw-fb-text{
  width:100%; box-sizing:border-box; min-height:52px; resize:vertical; padding:6px 8px;
  border:1px solid var(--border-input); border-radius:8px; background:var(--bg); color:var(--text);
  font:inherit; font-size:12px;
}
.uw-fb-actions{ display:flex; gap:6px; margin:8px 0 0; }
.uw-fb-send, .uw-fb-skip{
  padding:4px 12px; border-radius:12px; font-size:11px; cursor:pointer; border:1px solid var(--brand);
}
.uw-fb-send{ background:var(--brand); color:var(--bg); }
.uw-fb-skip{ background:transparent; color:var(--brand); }
.uw-fb-send[disabled]{ opacity:.6; cursor:progress; }
@keyframes uw-fb-in{ from{ opacity:0; transform:translateY(3px); } to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion:reduce){ .uw-fb-more{ animation:none; } }
`;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function chatSession(data) {
    if (data && data.sessionId) return data.sessionId;
    try { return sessionStorage.getItem("unilusChatSession") || ""; } catch { return ""; }
  }

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    try {
      const token = sessionStorage.getItem("unilusAuthToken");
      if (token) headers.Authorization = `Bearer ${token}`; // lets the server record "signed in" (never a name)
    } catch { /* visitor */ }
    return headers;
  }

  function build(data, question) {
    const sessionId = chatSession(data);
    let feedbackId = null;   // set once the first thumb has been saved
    let rating = null;
    let detailsSent = false;
    let reason = null;

    const wrap = el("div", "uw-fb");
    const row = el("div", "uw-fb-row");
    row.appendChild(el("span", "", "Was this helpful?"));

    const up = el("button", "uw-fb-thumb");
    up.type = "button";
    up.innerHTML = UP_ICON;
    up.setAttribute("aria-label", "Yes, this was helpful");
    up.setAttribute("aria-pressed", "false");

    const down = el("button", "uw-fb-thumb");
    down.type = "button";
    down.innerHTML = DOWN_ICON;
    down.setAttribute("aria-label", "No, this was not helpful");
    down.setAttribute("aria-pressed", "false");

    const status = el("span", "uw-fb-status");
    status.setAttribute("aria-live", "polite");
    row.append(up, down, status);
    wrap.appendChild(row);

    // Extra details, shown only after a thumbs down.
    const more = el("div", "uw-fb-more");
    more.hidden = true;
    more.appendChild(el("p", "uw-fb-q", "What went wrong? (optional)"));
    const chips = el("div", "uw-fb-chips");
    const chipButtons = REASONS.map(([key, label]) => {
      const chip = el("button", "uw-fb-chip", label);
      chip.type = "button";
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", () => {
        reason = reason === key ? null : key;
        chipButtons.forEach((c, i) => c.setAttribute("aria-pressed", String(REASONS[i][0] === reason)));
      });
      chips.appendChild(chip);
      return chip;
    });
    more.appendChild(chips);

    const text = el("textarea", "uw-fb-text");
    text.maxLength = 500;
    text.placeholder = "Anything else we should know? Please don't include personal details.";
    text.setAttribute("aria-label", "Tell us more (optional)");
    more.appendChild(text);

    const actions = el("div", "uw-fb-actions");
    const send = el("button", "uw-fb-send", "Send");
    send.type = "button";
    const skip = el("button", "uw-fb-skip", "Skip");
    skip.type = "button";
    actions.append(send, skip);
    more.appendChild(actions);
    wrap.appendChild(more);

    function say(message, isError = false) {
      status.textContent = message;
      status.classList.toggle("is-error", isError);
    }

    async function save(nextRating) {
      const body = { sessionId, rating: nextRating };
      let response;
      if (feedbackId === null) {
        response = await fetch(API, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ ...body, question: question || "", answer: data.answer || "" }),
        });
      } else {
        response = await fetch(`${API}/${feedbackId}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      }
      if (!response.ok) throw new Error(`Feedback request failed: ${response.status}`);
      if (feedbackId === null) feedbackId = (await response.json()).id;
    }

    async function choose(next) {
      if (next === rating) return;
      up.disabled = down.disabled = true;
      try {
        await save(next);
        rating = next;
        up.setAttribute("aria-pressed", String(next === "up"));
        down.setAttribute("aria-pressed", String(next === "down"));
        if (next === "up") {
          more.hidden = true;
          say("Thanks for letting us know.");
        } else if (detailsSent) {
          say("Thanks, we've noted that.");
        } else {
          say("");
          more.hidden = false;
          text.focus({ preventScroll: true });
        }
      } catch (error) {
        console.error("Feedback error:", error);
        say("Couldn't send that. Try again.", true);
      } finally {
        up.disabled = down.disabled = false;
      }
    }

    async function sendDetails() {
      const comment = text.value.trim();
      if (!reason && !comment) { more.hidden = true; say("Thanks, we've noted that."); return; }
      send.disabled = true;
      try {
        const response = await fetch(`${API}/${feedbackId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ sessionId, reason: reason || undefined, comment: comment || undefined }),
        });
        if (!response.ok) throw new Error(`Feedback request failed: ${response.status}`);
        detailsSent = true;
        more.hidden = true;
        say("Thank you. This helps us improve.");
      } catch (error) {
        console.error("Feedback error:", error);
        say("Couldn't send that. Try again.", true);
      } finally {
        send.disabled = false;
      }
    }

    up.addEventListener("click", () => choose("up"));
    down.addEventListener("click", () => choose("down"));
    send.addEventListener("click", sendDetails);
    skip.addEventListener("click", () => { more.hidden = true; say("Thanks, we've noted that."); });
    return wrap;
  }

  function afterReply(row, data, question) {
    const bubble = row && row.querySelector(".bubble");
    if (!bubble || !data || data.error || !data.answer || bubble.querySelector(".uw-fb")) return;
    bubble.appendChild(build(data, question));
  }

  window.UnilusFeedback = { afterReply };

  function init() {
    if (document.getElementById("uw-feedback-style")) return;
    const style = document.createElement("style");
    style.id = "uw-feedback-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
