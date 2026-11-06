# Cuts

What we left out on purpose, and what we would build next.

- **Amended reports.** Today, a re-import that changes a signed result is rejected in the preview. Next: the LIS sends an explicit amendment, we keep the old version, mark the report "Amended", and send the patient a new link with a note explaining what changed.
- **Real WhatsApp/SMS delivery.** Messages go to a mock outbox and a demo phone screen, as the brief asks. Next: a provider adapter (e.g. the WhatsApp Business API) behind the same outbox, with delivery receipts updating message status.
