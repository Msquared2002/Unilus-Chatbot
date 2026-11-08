let chatPending = false;
let chatSessionId;
let chatIdentity=currentIdentity();
function currentIdentity(){return sessionStorage.getItem('unilusAuthToken') || 'guest';}
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


async function sendMessage(question) {

  const input = document.getElementById("user-input");
  const text = typeof question === "string" ? question.trim() : input.value.trim();

  if (!text || chatPending) return;
  const identity=currentIdentity();
  if(chatIdentity!==identity){chatIdentity=identity;chatSessionId=undefined;sessionStorage.removeItem('unilusChatSession');}
  chatSessionId=chatSessionId || sessionStorage.getItem('unilusChatSession') || undefined;
  chatPending = true;
  const oldActions = [...document.querySelectorAll(".context-actions button:not(:disabled), .map-confirm-btn:not(:disabled)")];
  oldActions.forEach(button => button.disabled = true);


  addMessage(text, "user");

  input.value = "";

  const request = ++latestAvatarRequest;
  reactAvatar("thinking");


  const typingRow = addTypingIndicator();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const requestDeadline = setTimeout(() => controller?.abort(), 120000);
  const slowNotice = setTimeout(() => {
    if (request !== latestAvatarRequest) return;
    const notice = document.createElement('span');
    notice.className = 'startup-notice'; notice.setAttribute('role','status');
    notice.textContent = 'Still connecting. The assistant may be waking up; please keep this window open.';
    typingRow.querySelector('.bubble')?.appendChild(notice);
  }, 12000);


  try {

    const response = await fetch(
      (window.UNILUS_API_BASE || "/api")+"/chat",
      {
        method: "POST",
        ...(controller ? {signal:controller.signal} : {}),

        headers: {
          "Content-Type": "application/json",
          ...(currentIdentity()!=="guest"?{Authorization:"Bearer "+currentIdentity()}:{})
        },

        body: JSON.stringify({
          question: text, sessionId: chatSessionId
        })
      }
    );

    if(response.status===403){chatSessionId=undefined;sessionStorage.removeItem("unilusChatSession");}
    if (response.status === 503) throw Object.assign(new Error('Assistant is starting'), {warming:true});
    if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);


    const data = await response.json();
    if (request !== latestAvatarRequest) return;
    if (typeof data.sessionId === "string"){chatSessionId=data.sessionId;sessionStorage.setItem('unilusChatSession',chatSessionId);}
    if(data.authProblem){sessionStorage.removeItem('unilusAuthToken');sessionStorage.removeItem('unilusChatSession');chatSessionId=undefined;}
    if(data.error)throw Error('Backend request failed');


    removeTypingIndicator(typingRow);

    const botRow = addMessage(
      data.answer || "I received your message.",
      "bot",
      request === latestAvatarRequest
    );

    if (request === latestAvatarRequest) reactAvatar(responseEmotion(data, data.answer), 2200);


    // Chatbot found a place - offer to show it, don't force the map open.
    const mapRendered = renderActions(botRow, data.suggestedActions, data);
    if (data.navigation && !mapRendered) {
      addMapConfirmButton(botRow, data.navigation, data.route, data.routeIntent);
    }

  } catch(error) {

    oldActions.forEach(button => button.disabled = false);
    if (!input.value.trim()) input.value = text;
    console.error("Chat error:", error);

    removeTypingIndicator(typingRow);

    addMessage(
      error.warming ? "The assistant is waking up. Please try again in a moment." : "Sorry, I am having trouble connecting right now. Please try again.",
      "bot",
      request === latestAvatarRequest
    );
    if (request === latestAvatarRequest) reactAvatar("worry", 2600);

  } finally { clearTimeout(slowNotice); clearTimeout(requestDeadline); chatPending = false; }

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

        bubble.innerHTML = window.DOMPurify.sanitize(marked.parse(text));
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

function renderActions(row, actions, data) {
  const group = document.createElement('div');
  group.className = 'context-actions';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Suggested next steps');
  let hasMap = false;
  for (const action of (Array.isArray(actions) ? actions : []).slice(0, 4)) {
    if (!window.UnilusActions.validateAction(action)) continue;
    if (action.type === 'navigation') {
      if (!data.navigation || data.navigation.placeId !== action.payload.placeId) continue;
      hasMap = true;
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => { if (!button.disabled) sendMessage(action.payload.question); });
    group.appendChild(button);
  }
  row.querySelector('.bubble').appendChild(group);
  if (hasMap) addMapConfirmButton(row, data.navigation, data.route, data.routeIntent);
  return hasMap;
}
