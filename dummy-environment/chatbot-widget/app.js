document.getElementById("input-area").addEventListener("submit", function (e) {
  e.preventDefault();
  sendMessage();
});

// Very small demo "intent" layer: if the question names a known building,
// jump the campus map to it after replying. Replace this with a real
// NLU/RAG call to your backend later - this just proves the wiring end to end.
const LOCATION_KEYWORDS = {
  library: "Library",
  cafeteria: "Cafeteria",
  admin: "Administration Block",
  administration: "Administration Block",
  "ict lab": "ICT / Computer Lab",
  "computer lab": "ICT / Computer Lab",
  entrance: "Main Entrance",
  sports: "Sports Grounds"
};

function detectBuilding(text) {
  const lower = text.toLowerCase();
  for (const keyword in LOCATION_KEYWORDS) {
    if (lower.includes(keyword)) return LOCATION_KEYWORDS[keyword];
  }
  return null;
}

async function sendMessage() {

  const input = document.getElementById("user-input");
  const text = input.value.trim();

  if (!text) return;


  addMessage(text, "user");

  input.value = "";

  UniAvatar.thinking();


  const typingRow = addTypingIndicator();


  try {

    const response = await fetch(
      "http://localhost:5000/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          question: text
        })
      }
    );


    const data = await response.json();


    removeTypingIndicator(typingRow);

    UniAvatar.idle();


    addMessage(
      data.answer || "I received your message.",
      "bot"
    );


        // Keep your campus map feature
    const building = detectBuilding(text);

    if (building) {

      setTimeout(() => {

        if (typeof UnilusWidget !== "undefined") {

          UnilusWidget.focusBuilding(
            "pioneer",
            building
          );

        }

      }, 400);

    }

  } catch(error) {

    console.error("Chat error:", error);

    removeTypingIndicator(typingRow);

    UniAvatar.idle();

    addMessage(
      "Sorry, I am having trouble connecting right now. Please try again.",
      "bot"
    );

  }

}
    

function addMessage(text, type) {

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

    if (typeof UnilusWidget !== "undefined") {

        UnilusWidget.onBotMessage(row);

    }

}


  return row;

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