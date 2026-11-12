/*
Changes: Adds an attach (paperclip) button and drag-and-drop to the chat input, a file card shown in the chat after a file
         is read, an "attached file" chip above the input, source chips under answers, and a "Save as PDF" button on answers.
Affects: The chat input form (#input-area), #chat-box and #view-chat. Talks to /api/chat/upload and /api/chat/pdf.
         app.js calls two hooks here: UnilusUpload.activeId() when sending a question and UnilusUpload.afterReply() after a reply.
Purpose: Students can ask about their own PDF, Word or text file next to the UNILUS records, and keep any answer as a PDF.
         Everything shown on the file card was found by the server with plain patterns, never guessed by the AI model.
         Elements are injected from here (like voice.js) so the HTML pages that copy the widget markup need no edits.
         All text from files or the server is inserted with textContent, never as HTML.
*/
(function () {
  const API = "http://localhost:5000/api/chat"; // same host app.js talks to
  const MAX_MB = 6;                             // keep in step with UPLOAD_MAX_MB on the server
  const EXTENSIONS = [".pdf", ".docx", ".txt"];

  const CLIP_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.5 6.5v10a4.5 4.5 0 0 1-9 0V5.75a3 3 0 0 1 6 0V16a1.5 1.5 0 0 1-3 0V7H9.5v9a3 3 0 0 0 6 0V5.75a4.5 4.5 0 0 0-9 0V16.5a6 6 0 0 0 12 0v-10h-2Z"/></svg>';
  const FILE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Zm0 2.5L16.5 7H14V4.5ZM8 12h8v1.5H8V12Zm0 3h8v1.5H8V15Z"/></svg>';
  const PDF_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M5 20h14v-2H5v2ZM12 3v10.17l3.59-3.58L17 11l-5 5-5-5 1.41-1.41L11 13.17V3h1Z"/></svg>';

  const STYLE = `
.uw-attach-btn{
  width:42px; height:42px; border-radius:50%; flex-shrink:0;
  border:1px solid var(--border-input); background:var(--bg); color:var(--brand);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:transform .12s ease, background .2s ease;
}
.uw-attach-btn:hover{ background:var(--bg-hover); }
.uw-attach-btn:active{ transform:scale(.92); }
.uw-attach-btn[disabled]{ opacity:.5; cursor:progress; }
#view-chat{ position:relative; }

.uw-attached{
  display:flex; align-items:center; gap:8px; margin:0 16px 8px; padding:7px 8px 7px 12px;
  border:1px solid var(--brand-accent); border-radius:12px; background:var(--bg-accent-soft); color:var(--text);
  font-size:12px; animation:uw-in .2s ease;
}
.uw-attached[hidden]{ display:none; }
.uw-attached svg{ color:var(--brand); flex-shrink:0; }
.uw-attached-text{ flex:1; min-width:0; }
.uw-attached-name{ font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.uw-attached-meta{ color:var(--text-muted); font-size:11px; }
.uw-attached-x{
  width:26px; height:26px; border-radius:50%; border:none; background:transparent; color:var(--text-muted);
  font-size:16px; line-height:1; cursor:pointer;
}
.uw-attached-x:hover{ background:var(--bg-hover); color:var(--brand); }

.uw-drop{
  position:absolute; inset:0; z-index:20; display:flex; align-items:center; justify-content:center; text-align:center;
  background:color-mix(in srgb, var(--bg) 88%, transparent); border:2px dashed var(--brand); border-radius:14px; margin:8px;
  color:var(--brand); font-size:14px; font-weight:600; pointer-events:none; backdrop-filter:blur(2px);
}
.uw-drop[hidden]{ display:none; }

.uw-card{ min-width:0; }
.uw-card-head{ display:flex; align-items:center; gap:10px; }
.uw-card-head svg{ color:var(--brand); flex-shrink:0; }
.uw-card-title{ font-weight:600; overflow-wrap:anywhere; }
.uw-card-meta{ font-size:11px; color:var(--text-muted); }
.uw-steps{ list-style:none; margin:10px 0 0; padding:0; font-size:12.5px; }
.uw-steps li{ display:flex; gap:8px; padding:3px 0; opacity:0; animation:uw-step .35s ease forwards; }
.uw-steps li::before{ content:"\\2713"; color:var(--brand); font-weight:700; }
.uw-steps li.is-pending::before{ content:"\\2022"; color:var(--text-faint); }
@keyframes uw-step{ from{ opacity:0; transform:translateX(-6px); } to{ opacity:1; transform:none; } }
.uw-chips{ display:flex; flex-wrap:wrap; gap:5px; margin:8px 0 0; }
.uw-chip{
  display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:10px; font-size:11px;
  border:1px solid var(--border-input); background:var(--bg); color:var(--text);
}
.uw-chip.is-ok{ border-color:var(--brand-accent); }
.uw-chip.is-miss{ color:var(--text-muted); border-style:dashed; }
.uw-note{ margin:10px 0 0; font-size:11px; color:var(--text-muted); }
.uw-suggest{ display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.uw-suggest button{
  padding:6px 11px; border-radius:14px; border:1px solid var(--brand); background:transparent; color:var(--brand);
  font-size:12px; cursor:pointer; text-align:left; transition:background .15s ease, color .15s ease;
}
.uw-suggest button:hover{ background:var(--brand); color:var(--bg); }

.uw-answer-tag{ margin:8px 0 0; font-size:11px; color:var(--text-muted); }
.uw-answer-tag strong{ color:var(--brand); font-weight:600; }
.uw-sources{ display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin:8px 0 0; }
.uw-sources-label{ font-size:11px; color:var(--text-muted); }
.uw-pdf-btn{
  display:inline-flex; align-items:center; gap:4px; margin:6px 6px 0 0; padding:3px 8px;
  border:1px solid var(--border-input); border-radius:12px; background:transparent; color:var(--text-muted);
  font-size:11px; cursor:pointer;
}
.uw-pdf-btn:hover{ color:var(--brand); border-color:var(--brand); }
.uw-pdf-btn[disabled]{ opacity:.6; cursor:progress; }
.uw-pdf-err{ font-size:11px; color:#d93025; margin-left:4px; }
@keyframes uw-in{ from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion:reduce){ .uw-steps li, .uw-attached{ animation:none; opacity:1; } }
`;

  let active = null;        // { documentId, filename, pages, expiresInMinutes }
  let busy = false;
  let els = {};
  let basePlaceholder = "";

  const chat = () => window.UnilusChat;

  // ---------- small helpers ----------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function sizeLabel(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function extensionOf(name) {
    const i = String(name).lastIndexOf(".");
    return i < 0 ? "" : String(name).slice(i).toLowerCase();
  }

  function sessionId() {
    try { return sessionStorage.getItem("unilusChatSession") || ""; } catch { return ""; }
  }

  function authHeaders() {
    const headers = {};
    try {
      const token = sessionStorage.getItem("unilusAuthToken");
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* storage unavailable: carry on as a visitor */ }
    return headers;
  }

  function say(text) {
    // A short bot message that is not an AI answer (errors, hints). Plain text only.
    const row = chat().addMessage(text, "bot", false);
    return row;
  }

  // ---------- attachment state ----------
  function setActive(info) {
    active = info;
    if (!els.chip) return;
    if (!info) {
      els.chip.hidden = true;
      if (els.input) els.input.placeholder = basePlaceholder;
      return;
    }
    els.chipName.textContent = info.filename;
    els.chipMeta.textContent = info.pages
      ? `${info.pages} page${info.pages === 1 ? "" : "s"} \u00b7 I'll use it when you ask`
      : "I'll use it when you ask";
    els.chip.hidden = false;
    if (els.input) els.input.placeholder = "Ask about your file or UNILUS...";
  }

  async function removeActive() {
    const gone = active;
    setActive(null);
    if (!gone) return;
    try {
      await fetch(`${API}/upload/${encodeURIComponent(gone.documentId)}?sessionId=${encodeURIComponent(sessionId())}`, { method: "DELETE" });
    } catch { /* the server also removes it when it expires */ }
  }

  // ---------- upload ----------
  async function handleFile(file) {
    if (!file || busy) return;
    if (!EXTENSIONS.includes(extensionOf(file.name))) {
      say("I can read PDF, Word (.docx) and text (.txt) files. If your file is a photo or a scan, I can't read it yet.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      say(`That file is ${sizeLabel(file.size)}. I can read files up to ${MAX_MB} MB.`);
      return;
    }
    if (file.size === 0) { say("That file looks empty."); return; }

    busy = true;
    els.attach.disabled = true;
    chat().addMessage(`\uD83D\uDCCE ${file.name} (${sizeLabel(file.size)})`, "user");
    const typing = chat().addTypingIndicator();
    chat().reactAvatar("thinking");

    try {
      const params = new URLSearchParams({ filename: file.name });
      const existing = sessionId();
      if (existing) params.set("sessionId", existing);

      const response = await fetch(`${API}/upload?${params}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/octet-stream" },
        body: file,
      });
      let data = null;
      try { data = await response.json(); } catch { /* not JSON */ }
      chat().removeTypingIndicator(typing);

      if (!response.ok || !data || !data.documentId) {
        say((data && data.error) || "I couldn't read that file. Please try again.");
        chat().reactAvatar("worry", 2400);
        return;
      }

      try { if (data.sessionId) sessionStorage.setItem("unilusChatSession", data.sessionId); } catch { /* ignore */ }
      setActive({ documentId: data.documentId, filename: data.filename, pages: data.pages, expiresInMinutes: data.expiresInMinutes });
      showCard(data);
      chat().reactAvatar("happy", 2200);
    } catch (error) {
      console.error("Upload error:", error);
      chat().removeTypingIndicator(typing);
      say("Sorry, I couldn't send that file. Please check your connection and try again.");
      chat().reactAvatar("worry", 2400);
    } finally {
      busy = false;
      els.attach.disabled = false;
      els.fileInput.value = "";
    }
  }

  function showCard(data) {
    const row = chat().addMessage("", "bot", false);
    const bubble = row.querySelector(".bubble");
    bubble.textContent = "";
    const card = el("div", "uw-card");

    const head = el("div", "uw-card-head");
    head.insertAdjacentHTML("beforeend", FILE_ICON);
    const titles = el("div");
    titles.appendChild(el("div", "uw-card-title", data.title && data.title !== data.filename ? data.title : data.filename));
    const meta = [data.filename];
    if (data.pages) meta.push(`${data.pages} page${data.pages === 1 ? "" : "s"}`);
    titles.appendChild(el("div", "uw-card-meta", meta.join(" \u00b7 ")));
    head.appendChild(titles);
    card.appendChild(head);

    const steps = el("ul", "uw-steps");
    (data.steps || []).forEach((step, i) => {
      const li = el("li", step.pending ? "is-pending" : "", step.label);
      li.style.animationDelay = `${i * 0.18}s`;
      steps.appendChild(li);
    });
    card.appendChild(steps);

    const facts = data.facts || {};
    const chips = el("div", "uw-chips");
    (facts.courseCodes || []).forEach((c) => {
      let cls = "uw-chip";
      let label = c.code;
      if (c.inTimetable === true) { cls += " is-ok"; label = `${c.code} \u2713`; }
      else if (c.inTimetable === false) { cls += " is-miss"; label = `${c.code} (not in timetable)`; }
      const chip = el("span", cls, label);
      if (c.name) chip.title = c.name;
      chips.appendChild(chip);
    });
    (facts.dates || []).forEach((d) => chips.appendChild(el("span", "uw-chip", d)));
    (facts.amounts || []).forEach((a) => chips.appendChild(el("span", "uw-chip", a)));
    if (chips.childNodes.length) card.appendChild(chips);

    if (data.truncated) card.appendChild(el("p", "uw-note", "This file is very long, so I've read the first part of it."));
    card.appendChild(el("p", "uw-note", `Only used in this chat. It's not added to the UNILUS records and is removed after ${data.expiresInMinutes || 60} minutes.`));

    const suggest = el("div", "uw-suggest");
    (data.suggestions || []).forEach((text) => {
      const btn = el("button", "", text);
      btn.type = "button";
      btn.addEventListener("click", () => {
        els.input.value = text;
        els.form.requestSubmit();
      });
      suggest.appendChild(btn);
    });
    if (suggest.childNodes.length) card.appendChild(suggest);

    bubble.appendChild(card);
    const box = document.getElementById("chat-box");
    if (box) box.scrollTop = box.scrollHeight;
  }

  // ---------- answers: file tag, sources, Save as PDF ----------
  function sourceLabel(source) {
    const title = source.title || source.source_file;
    if (!title) return "";
    return source.page_number ? `${title} (p. ${source.page_number})` : String(title);
  }

  async function savePdf(btn, data, errorSlot) {
    btn.disabled = true;
    errorSlot.textContent = "";
    const original = btn.lastChild.textContent;
    btn.lastChild.textContent = "Preparing...";
    try {
      const sources = [...new Set((data.sources || []).map(sourceLabel).filter(Boolean))].slice(0, 12);
      const response = await fetch(`${API}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.question || "UNILUS answer",
          markdown: data.answer,
          sources,
          note: data.document ? `Includes your file: ${data.document.filename}` : "",
        }),
      });
      if (!response.ok) throw new Error(`PDF request failed: ${response.status}`);
      const blob = await response.blob();
      const header = response.headers.get("Content-Disposition") || "";
      const name = (header.match(/filename="([^"]+)"/) || [])[1] || "unilus-answer.pdf";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("PDF error:", error);
      errorSlot.textContent = "Couldn't make the PDF. Try again.";
    } finally {
      btn.disabled = false;
      btn.lastChild.textContent = original;
    }
  }

  function decorate(row, data) {
    const bubble = row && row.querySelector(".bubble");
    if (!bubble || !data || data.error || !data.answer) return;

    if (data.document) {
      const tag = el("p", "uw-answer-tag");
      const strong = el("strong", "", "Used your file");
      tag.appendChild(strong);
      tag.appendChild(document.createTextNode(` ${data.document.filename}`));
      tag.appendChild(document.createTextNode(data.document.unilusRecordsUsed ? " and UNILUS records" : ". No matching UNILUS records were found for this."));
      if (data.document.partial) tag.appendChild(document.createTextNode(" (parts of a long file)"));
      bubble.appendChild(tag);
    }

    const labels = [...new Set((data.sources || []).map(sourceLabel).filter(Boolean))].slice(0, 4);
    if (labels.length) {
      const wrap = el("div", "uw-sources");
      wrap.appendChild(el("span", "uw-sources-label", "Sources"));
      labels.forEach((label) => wrap.appendChild(el("span", "uw-chip", label)));
      bubble.appendChild(wrap);
    }

    // Short replies (a one-line answer or a question back to the student) are not worth a PDF.
    if (String(data.answer).length >= 120 || labels.length) {
      const btn = el("button", "uw-pdf-btn");
      btn.type = "button";
      btn.insertAdjacentHTML("beforeend", PDF_ICON);
      btn.appendChild(document.createTextNode("Save as PDF"));
      btn.setAttribute("aria-label", "Save this answer as a PDF");
      const errorSlot = el("span", "uw-pdf-err");
      btn.addEventListener("click", () => savePdf(btn, data, errorSlot));
      bubble.appendChild(btn);
      bubble.appendChild(errorSlot);
    }
  }

  // ---------- hooks used by app.js ----------
  window.UnilusUpload = {
    activeId() { return active ? active.documentId : undefined; },
    afterReply(row, data) {
      if (data && data.documentExpired) setActive(null);
      decorate(row, data);
    },
  };

  // ---------- setup ----------
  function init() {
    const form = document.getElementById("input-area");
    const input = document.getElementById("user-input");
    const view = document.getElementById("view-chat");
    if (!form || !input || !view || document.getElementById("unilus-upload-style")) return;

    const style = document.createElement("style");
    style.id = "unilus-upload-style";
    style.textContent = STYLE;
    document.head.appendChild(style);

    basePlaceholder = input.placeholder;

    const attach = el("button", "uw-attach-btn");
    attach.type = "button";
    attach.innerHTML = CLIP_ICON;
    attach.title = "Attach a PDF, Word or text file";
    attach.setAttribute("aria-label", "Attach a PDF, Word or text file");

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = EXTENSIONS.join(",");
    fileInput.hidden = true;
    fileInput.setAttribute("aria-hidden", "true");
    fileInput.tabIndex = -1;

    const chip = el("div", "uw-attached");
    chip.hidden = true;
    chip.setAttribute("role", "status");
    chip.insertAdjacentHTML("beforeend", FILE_ICON);
    const text = el("div", "uw-attached-text");
    const chipName = el("div", "uw-attached-name");
    const chipMeta = el("div", "uw-attached-meta");
    text.append(chipName, chipMeta);
    const x = el("button", "uw-attached-x", "\u00d7");
    x.type = "button";
    x.title = "Remove the file";
    x.setAttribute("aria-label", "Remove the attached file");
    chip.append(text, x);

    const drop = el("div", "uw-drop", "Drop a PDF, Word or text file to ask about it");
    drop.hidden = true;

    form.insertBefore(attach, input);
    form.appendChild(fileInput);
    form.parentNode.insertBefore(chip, form);
    view.appendChild(drop);

    els = { form, input, view, attach, fileInput, chip, chipName, chipMeta, drop };

    attach.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => handleFile(fileInput.files && fileInput.files[0]));
    x.addEventListener("click", removeActive);

    let depth = 0;
    const hasFiles = (event) => event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files");
    view.addEventListener("dragenter", (event) => { if (hasFiles(event)) { depth++; drop.hidden = false; } });
    view.addEventListener("dragover", (event) => { if (hasFiles(event)) event.preventDefault(); });
    view.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) drop.hidden = true; });
    view.addEventListener("drop", (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      drop.hidden = true;
      handleFile(event.dataTransfer.files[0]);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
