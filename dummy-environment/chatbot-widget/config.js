// Where the chatbot backend lives (the address INCLUDING the /api part).
//
// Changes: One place decides this for the whole widget. Before, app.js, upload.js, feedback.js and
//          campus-data-client.js each had http://localhost:5000 written into them.
// Affects: chat, uploads, PDFs, feedback, notifications and campus data requests.
// Purpose: The deployed site (https://uniluschatbot.netlify.app) must not call the visitor's own computer.
//
// Order of choice:
//   1. window.UNILUS_API_BASE   a <script> before the widget can set it, e.g. "https://my-backend.example.com/api".
//                               The staff dashboard and sign-in page already use this same name.
//   2. VITE_API_BASE            set when the widget is built (a Netlify environment variable), same format.
//   3. localhost / 127.0.0.1 / opening the file directly   ->  http://localhost:5000/api  (your own computer)
//   4. anywhere else            ->  /api on the same site. Netlify can forward /api/* to the real backend
//                               (see the redirect in netlify.toml), which also avoids CORS and mixed-content problems.
const here = typeof location !== "undefined" ? location : { hostname: "", protocol: "" };
const isLocal = here.protocol === "file:" || here.hostname === "localhost" || here.hostname === "127.0.0.1";
// __UNILUS_API_BASE__ is filled in by vite.config.js from the VITE_API_BASE environment variable. (import.meta is NOT used:
// the pages load the widget with a plain <script> tag, where import.meta is a syntax error.)
const fromBuild = typeof __UNILUS_API_BASE__ !== "undefined" ? __UNILUS_API_BASE__ : "";

export const API_BASE = String(
  (typeof window !== "undefined" && window.UNILUS_API_BASE) || fromBuild || (isLocal ? "http://localhost:5000/api" : "/api")
).replace(/\/+$/, "");
