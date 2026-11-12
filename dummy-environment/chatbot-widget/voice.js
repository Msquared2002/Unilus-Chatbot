/*
Changes: Adds a microphone button (speech to text) and a "read aloud" button on bot replies (text to speech).
Affects: The chat input form (#input-area) and bot bubbles inside #chat-box. Uses only browser APIs;
         no backend call, no new package. app.js and the chat API contract are untouched.
Purpose: Quick voice support. Buttons are injected from here so the five HTML pages that copy the widget
         markup do not each need editing. Unsupported browsers (e.g. Firefox has no speech recognition)
         simply do not get the button.
*/
(function () {
  // Set to true to send the question as soon as speech ends. Off by default because recognition can
  // misread names and IDs (e.g. student numbers), so the student gets to check the text first.
  const AUTO_SEND = false;
  const RECOGNITION_LANG = "en-GB";

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  const MIC_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>';
  const SPEAKER_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3Zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12ZM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54Z"/></svg>';
  const STOP_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>';

  const STYLE = `
.voice-btn{
  width:42px; height:42px; border-radius:50%;
  border:1px solid var(--border-input); background:var(--bg); color:var(--brand);
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
  cursor:pointer; transition:transform .12s ease, background .2s ease, color .2s ease;
}
.voice-btn:hover{ background:var(--bg-hover); }
.voice-btn:active{ transform:scale(.92); }
.voice-btn.is-listening{
  background:#d93025; border-color:#d93025; color:#fff;
  animation:voice-pulse 1.2s ease-in-out infinite;
}
@keyframes voice-pulse{
  0%,100%{ box-shadow:0 0 0 0 rgba(217,48,37,.45); }
  50%{ box-shadow:0 0 0 8px rgba(217,48,37,0); }
}
.speak-btn{
  display:inline-flex; align-items:center; gap:4px;
  margin:6px 0 0; padding:3px 8px;
  border:1px solid var(--border-input); border-radius:12px;
  background:transparent; color:var(--text-muted); font-size:11px; cursor:pointer;
}
.speak-btn:hover{ color:var(--brand); border-color:var(--brand); }
.speak-btn.is-speaking{ color:var(--brand); border-color:var(--brand); }
.voice-hint{ font-size:11px; color:var(--text-muted); padding:0 16px 8px; }
@media (prefers-reduced-motion:reduce){ .voice-btn.is-listening{ animation:none; } }
`;

  function addStyles() {
    if (document.getElementById("unilus-voice-style")) return;
    const style = document.createElement("style");
    style.id = "unilus-voice-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  // ---------- Speech to text ----------
  function initMic() {
    const form = document.getElementById("input-area");
    const input = document.getElementById("user-input");
    if (!form || !input || !SpeechRecognitionCtor) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "voice-btn";
    btn.innerHTML = MIC_ICON;
    setMicLabel(btn, false);
    form.insertBefore(btn, form.querySelector(".send-btn"));

    let recognition = null;
    let listening = false;
    let baseText = "";

    function stop() {
      if (recognition) recognition.stop();
    }

    function setListening(on) {
      listening = on;
      btn.classList.toggle("is-listening", on);
      setMicLabel(btn, on);
    }

    function start() {
      if (synth) synth.cancel(); // don't transcribe the bot's own voice
      baseText = input.value.trim();
      recognition = new SpeechRecognitionCtor();
      recognition.lang = RECOGNITION_LANG;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      let finalText = "";
      recognition.onresult = (event) => {
        let interim = "";
        finalText = "";
        for (let i = 0; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += piece;
          else interim += piece;
        }
        input.value = [baseText, finalText + interim].filter(Boolean).join(" ").trim();
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          btn.title = "Microphone blocked. Allow microphone access for this site in your browser settings.";
          alert("The microphone is blocked. Please allow microphone access for this site in your browser settings and try again.");
        } else if (event.error === "no-speech") {
          btn.title = "I didn't hear anything. Tap the microphone and try again.";
        } else if (event.error === "network") {
          alert("Voice input needs an internet connection.");
        }
      };
      recognition.onend = () => {
        setListening(false);
        recognition = null;
        input.focus();
        if (AUTO_SEND && input.value.trim()) form.requestSubmit();
      };

      try {
        recognition.start();
        setListening(true);
      } catch {
        setListening(false); // start() throws if a session is already running
      }
    }

    btn.addEventListener("click", () => (listening ? stop() : start()));

    // Stop listening if the question is sent by hand.
    form.addEventListener("submit", () => { if (listening) stop(); });
  }

  function setMicLabel(btn, on) {
    const label = on ? "Stop listening" : "Speak your question";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-pressed", String(on));
    btn.title = label;
  }

  // ---------- Text to speech ----------
  // Text to read for a bubble: skips tables (they read badly aloud) and any buttons.
  function speakableText(bubble) {
    const clone = bubble.cloneNode(true);
    clone.querySelectorAll("table, button, .chat-table-scroll, .typing-dots, .uw-sources, .uw-answer-tag, .uw-pdf-err").forEach((el) => el.remove());
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  let activeButton = null;

  function resetSpeakButton(btn) {
    btn.classList.remove("is-speaking");
    btn.innerHTML = SPEAKER_ICON + "<span>Listen</span>";
    btn.setAttribute("aria-label", "Read this reply aloud");
  }

  function speak(bubble, btn) {
    if (activeButton) {
      const wasSame = activeButton === btn;
      synth.cancel();
      resetSpeakButton(activeButton);
      activeButton = null;
      if (wasSame) return; // second tap on the same button just stops it
    }
    const text = speakableText(bubble);
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = RECOGNITION_LANG;
    utterance.rate = 1;
    const done = () => { resetSpeakButton(btn); if (activeButton === btn) activeButton = null; };
    utterance.onend = done;
    utterance.onerror = done;

    activeButton = btn;
    btn.classList.add("is-speaking");
    btn.innerHTML = STOP_ICON + "<span>Stop</span>";
    btn.setAttribute("aria-label", "Stop reading aloud");
    synth.speak(utterance);
  }

  function decorateBotRow(row) {
    if (!row.classList || !row.classList.contains("message-row") || !row.classList.contains("bot")) return;
    const bubble = row.querySelector(".bubble");
    if (!bubble || bubble.querySelector(".typing-dots") || bubble.querySelector(".speak-btn")) return;
    if (!speakableText(bubble)) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "speak-btn";
    resetSpeakButton(btn);
    btn.addEventListener("click", () => speak(bubble, btn));
    bubble.appendChild(btn);
  }

  function initSpeaker() {
    const box = document.getElementById("chat-box");
    if (!box || !synth) return;
    box.querySelectorAll(".message-row.bot").forEach(decorateBotRow);
    new MutationObserver((mutations) => {
      for (const m of mutations) m.addedNodes.forEach((node) => { if (node.nodeType === 1) decorateBotRow(node); });
    }).observe(box, { childList: true });

    // Stop talking when a new question is sent or the page is left.
    const form = document.getElementById("input-area");
    if (form) form.addEventListener("submit", () => { synth.cancel(); if (activeButton) { resetSpeakButton(activeButton); activeButton = null; } });
    window.addEventListener("pagehide", () => synth.cancel());
  }

  function start() {
    addStyles();
    initMic();
    initSpeaker();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
