# Unilus chatbot: optional feedback on answers

Builds on unilus-consent-update.zip (extract that first if you have not). No new npm packages.
After extracting: restart the backend, run `npm run build` in dummy-environment\chatbot-widget, then Ctrl+F5.

## What students see
- Under each answer: "Was this helpful?" with a thumbs up and a thumbs down. Nothing pops up and nothing is required.
- Thumbs up: one tap, "Thanks for letting us know."
- Thumbs down: saved immediately, then an OPTIONAL box asks "What went wrong?" (Wrong information / Out of date /
  Didn't answer my question / Hard to understand / Something else) and a short comment. Send or Skip.
- They can change their mind (up <-> down). If the server is down they see "Couldn't send that. Try again."

## What staff see (new "Feedback" page in the dashboard, Super Admin role)
- Helpful / Not helpful counts, % rated helpful, how many are still to review, and the most common reasons.
- Each rating with the question, the answer the bot gave, the reason, the comment, signed in / visitor, and the date.
- Filters (Not helpful / Helpful / All), "Mark reviewed", and a Download CSV button.
- Reports page feedback numbers keep working.

## Privacy and safety
- Stored: the thumb, reason, comment, the question and the answer, and ONLY whether the person was signed in. Never a name or username.
- The box tells students not to include personal details. Staff should still glance at comments before sharing the CSV.
- Updating a rating needs the same chat session that created it. Max 40 ratings per chat session per hour.
- All text is shown as plain text (never as HTML) and CSV cells starting with = + - @ are neutralised.
- Existing databases are updated automatically (your old feedback rows are kept).

## Files
New: dummy-environment/chatbot-widget/feedback.js
Changed: backend/services/supportService.js, backend/routes/supportRoutes.js (POST/PATCH /api/feedback, GET/PATCH /api/admin/feedback),
         dummy-environment/chatbot-widget/app.js (one hook) and main.js (one import),
         dummy-environment/admin.html (Feedback link), js/admin.js (page), js/admin-ticket-service.js (API calls)
