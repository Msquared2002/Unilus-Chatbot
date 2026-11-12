# Unilus chatbot: tickets only with the student's consent

This zip is COMPLETE: it contains everything from upload-pdf-update.zip (file upload, Save as PDF, voice)
plus the consent change. You do not need to extract voice-update.zip or upload-pdf-update.zip separately.

Extract over the project, then:

    cd backend
    npm install pdfkit        (only if you have not already; needed by the PDF feature)
    npm start

    cd ..\dummy-environment\chatbot-widget
    npm run build             (then Ctrl+F5 in the browser)

## What changed
- When the bot cannot answer, it NO LONGER opens a ticket by itself. It gives the same answer as before and adds:
  "Would you like me to pass this to the <department> so someone can follow up with you? Reply "yes" to open a ticket, or "no" to leave it."
- "yes" (also ok / sure / please / go ahead ...) opens the ticket for the ORIGINAL question.
  Visitors are then asked for an email; signed-in students are not (their details come from the account).
- "no" (also nope / not now ...) leaves it. Any other message just cancels the offer, so the student is never stuck.
- A student can also say "open a ticket" / "talk to staff" at any time: it uses their previous question.
- No ticket is offered for a bare yes / no / thanks, and none if the student already has an open ticket for the same question
  (the bot points to that one instead).
- The unanswered question is still written to the unanswered-questions log, so staff can review gaps in the knowledge base
  without it becoming a ticket.
- The chat response gains one field, ticketOffer (true when the bot just asked). Buttons for Yes / No could be added to the
  widget later using it.

## To know
- The pending offer is kept in server memory for 15 minutes and is lost on restart (the student is simply asked again).
- Files changed: backend/services/chatService.js, backend/services/supportService.js (findOpenDuplicate).
