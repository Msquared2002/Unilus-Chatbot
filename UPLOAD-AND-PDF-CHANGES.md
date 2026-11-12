# Unilus chatbot: file upload + "Save as PDF"

Extract over the project (from the folder that contains `backend/` and `dummy-environment/`):

    Expand-Archive -Path .\upload-pdf-update.zip -DestinationPath . -Force

Then:

    cd backend
    npm install pdfkit          (the only new package; it also updates package-lock.json)
    npm start

    cd ..\dummy-environment\chatbot-widget
    npm run build

## What students get
1. **Attach a file** (paperclip, or drag it onto the chat). PDF, Word (.docx) and .txt, up to 6 MB.
2. A **file card** appears in the chat: what was read, and what was found in it (course codes, dates, amounts, emails),
   all found with plain patterns, not by the AI. For SIGNED-IN students each course code is also checked against the
   UNILUS timetable (BIT320 ✓ / ZZZ999 (not in timetable)). Visitors are not shown anything from the timetable.
3. Suggestion buttons on the card ("Summarise this file", "Does anything here differ from the UNILUS records?", ...).
4. While a file chip is shown above the input, every question is answered with the file AND the normal UNILUS records.
   The answer says which was used ("Used your file x.pdf and UNILUS records") and shows source chips.
   The x on the chip removes the file.
5. **Save as PDF** on any answer: a branded A4 PDF with the answer (tables included, header repeats across pages) and its sources.

## How it stays grounded in UNILUS data
- The AI prompt gets extra rules only when a file is attached (aiService.js, DOCUMENT_RULES): the file is data to read,
  never instructions; UNILUS facts still come only from the UNILUS records; when they disagree it shows both and does not
  call the file wrong; if no UNILUS records match it says so instead of filling the gap.
- The same audience gate as normal questions applies to the UNILUS records (visitors still cannot reach restricted documents or timetables).
- Numbers in the answer must appear in the UNILUS evidence or in the file, otherwise the existing numeric check still removes the line.
- The file is NOT added to the knowledge base, not written to the unanswered-questions log, and never raises a ticket.
- The PDF endpoint renders only the answer text the student already saw; it calls no AI model.

## Files
New:     backend/services/uploadService.js, backend/services/pdfService.js, dummy-environment/chatbot-widget/upload.js,
         backend/tests/uploadService.test.js, pdfService.test.js, chatUploadRoutes.test.js
Changed: backend/routes/chatRoutes.js (POST /api/chat/upload, DELETE /api/chat/upload/:id, POST /api/chat/pdf, documentId on POST /api/chat),
         backend/services/chatService.js (answerWithDocument), backend/services/aiService.js (optional `document` option),
         dummy-environment/chatbot-widget/app.js (3 small hooks), main.js (imports voice.js and upload.js),
         voice.js (one line: Listen no longer reads the source chips aloud)
The chat response only gains one field, `document` (null when no file was used). Existing fields are unchanged.

## Optional .env
    UPLOAD_MAX_MB=6            UPLOAD_TTL_MINUTES=60
(If you change UPLOAD_MAX_MB, change MAX_MB at the top of upload.js to match.)

## Not done / to know
- Photos and scanned PDFs are refused with a clear message: the models in aiService.js are text-only and the project has no OCR.
  Adding that needs a vision model or an OCR package, which should be chosen and tested rather than assumed.
- Files live in server memory for 60 minutes and are lost on restart. The student is told when a file has expired.
- The conversation history table still stores the chat turns (questions and answers) like any other chat, so an answer
  that quotes the file is stored; the file itself is not.
- Very long files: the first part plus the passages that best match the question are sent to the model, and the answer says so.
- Tested here: file reading, PDF output (rendered and checked visually), the new routes, the answer pipeline with the AI call
  stubbed, and the widget in a simulated browser. NOT tested here: a real Groq answer and the real browser; please try
  "attach a file -> Summarise this file -> Save as PDF" once. The 13 backend tests that already fail without your vector
  index / Python data fail the same way before and after this change.
