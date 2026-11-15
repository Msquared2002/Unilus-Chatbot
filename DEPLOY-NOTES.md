# Deploying the chatbot on Netlify: what this update changes

Two things were broken on https://uniluschatbot.netlify.app:

1. The widget file (chatbot-widget/dist/chatbot-widget.js) was never built, so it returned 404 and nothing appeared.
   FIXED in netlify.toml: Netlify now runs `npm ci && npm run build` for the widget on every deploy (Node 22).

2. The widget, sign-in page and staff dashboard called http://localhost:5000, which is the visitor's own computer.
   FIXED in code: the address now comes from ONE place (chatbot-widget/config.js; the dashboard and sign-in use the same rule):
     - on your own computer (localhost / 127.0.0.1 / file:)  ->  http://localhost:5000/api   (nothing changes for local work)
     - on any other site                                    ->  /api on the same site
     - window.UNILUS_API_BASE or the build variable VITE_API_BASE overrides both
   It is NOT yet pointing at a real backend, because none is hosted. See "Still to do".

## Still to do: host the backend
The Express backend (/backend) must run on a Node host with a public https address. Then turn on the redirect in
netlify.toml (remove the # signs and put your address in), so /api/* on the Netlify site is forwarded to it:

    [[redirects]]
      from = "/api/*"
      to = "https://YOUR-BACKEND-ADDRESS/api/:splat"
      status = 200
      force = true

Until then the bubble appears but the chat answers "trouble connecting".

Why not Netlify Functions: the backend keeps state in memory and on disk (a local embedding model, SQLite, uploaded
documents, the vector index, the website refresh schedule, pending ticket offers). That needs a normal always-on server.

Backend host checklist
- Node 20+; start command `npm start` (folder: backend); `npm ci` to install.
- Persistent disk for backend/data (uploaded documents and the index are files). Or set DATABASE_URL (Postgres) for
  tickets, feedback and notifications, but uploads and the index still need a disk.
- At least about 1 GB RAM (the embedding model loads into memory).
- Environment variables on the host (never commit .env): GROQ_API_KEY, AUTH_JWT_SECRET, ADMIN_API_KEY, and for email
  RESEND_API_KEY or SMTP_*, EMAIL_FROM.
- Before going public: replace the demo logins and use a long ADMIN_API_KEY. The backend currently allows requests from
  any website (cors() with no limits); fine for now, worth restricting later.

## Deploy this update
    git add -A
    git commit -m "Build the widget on Netlify and make the backend address configurable"
    git push
Netlify rebuilds by itself. In the deploy log you should see the widget build run.
