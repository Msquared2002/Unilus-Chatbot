# Unilus chatbot: email setup and test command

Extract over the project (builds on the earlier updates). Restart the backend afterwards.

Test your setup any time, without resolving a ticket:

    cd backend
    node scripts/send-test-email.js you@example.com

It prints which provider is active and either sends one sample "ticket resolved" email or explains the usual fix.
With nothing configured it prints the email instead (dry run).

Files: NEW backend/services/ticketEmail.js (the email wording), NEW backend/scripts/send-test-email.js,
       CHANGED backend/services/ticketNotifier.js (now uses ticketEmail.js; no behaviour change).
