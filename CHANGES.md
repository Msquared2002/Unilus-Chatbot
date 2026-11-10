# Unilus chatbot: changes for the team's suggestions

Extract over the project (the PowerShell command), restart the backend, then run `npm run build`
in dummy-environment/chatbot-widget. No new npm packages are required.

## 1. Who the ticket belongs to, and how they are reached
- SIGNED-IN PORTAL STUDENT: the ticket is linked to their account and their email/phone are taken from the
  account automatically. They are never asked anything. (Demo accounts: add optional "email" and "phone"
  keys to a user in backend/data/demo_users.json; a real portal would read the student record.)
- VISITOR: after a new ticket the bot asks for an email (phone optional, or "skip"). Their next short reply is
  read and saved on the ticket. Anything else they type is answered normally.
- Staff see on each ticket: Portal student (username) or Visitor, plus Email and Phone.
- Existing databases are migrated automatically on startup (your 38 existing tickets are kept).

## 2. Staff answer -> knowledge base -> requester is told (one step)
- Uploading a document or saving a typed answer already goes live immediately. The upload now also confirms
  this (live / visible_to) and the dashboard says who can see it.
- When staff mark the ticket Resolved (including the "mark resolved after adding" option and "Teach the chatbot"),
  the person who opened it is told automatically:
    * Portal student  -> a pop-up on the portal and a notice in the chat, on any device they sign in on. No email.
    * Visitor         -> a notice in their chat session AND one email to the address they gave (sent once only).
- All of this lives in services/ticketNotifier.js, called from supportService.updateTicketStatus, so it
  fires whichever staff screen made the change.
- IMPORTANT: uploads default to "restricted" = signed-in students only. Choose "Everyone" for visitor-facing documents.

## 3. Update notifications (new documents, website refresh, ticket updates)
- GET /api/notifications, polled by the widget every 60 s (badge on the launcher; messages in the chat; a pop-up
  toast for ticket updates). Seen-state is kept per person on the browser.
- Restricted documents are announced to signed-in users only.
- NOTIFY_WEBSITE_REFRESH=false in .env turns off the "website updated" notices.

## 4. Turning email on (.env)  - without it, emails are only PRINTED in the server console ("dry run")
Option A, Resend (no extra package):
    RESEND_API_KEY=re_xxxxxxxx
    EMAIL_FROM="UNILUS Support <support@your-verified-domain>"
Option B, SMTP (university or Gmail account; run `npm install nodemailer` first):
    SMTP_HOST=smtp.example.com
    SMTP_PORT=587
    SMTP_USER=...
    SMTP_PASS=...
    EMAIL_FROM="UNILUS Support <support@unilus.ac.zm>"
Optional: EMAIL_REPLY_TO=info@unilus.ac.zm   EMAIL_SUPPORT_LINE="the Registry on 0971 ... or registry@unilus.ac.zm"

## Not done / to know
- Visitors who only give a phone number get the chat notice but no email (SMS would need a paid gateway).
- Visitors only see the chat notice if they come back on the same browser session; the email is how we reach them otherwise.
- Not run against the real app (no node_modules here): the database, notification and email logic was tested
  with a SQLite stand-in; the widget and chat wording need a quick manual try.
