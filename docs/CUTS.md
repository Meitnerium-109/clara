# Cuts

What we left out on purpose, and what we would build next.

- **Amended reports.** Today, a re-import that changes a signed result is rejected in the preview. Next: the LIS sends an explicit amendment, we keep the old version, mark the report "Amended", and send the patient a new link with a note explaining what changed.
- **Real WhatsApp/SMS delivery.** Messages go to a mock outbox and a demo phone screen, as the brief asks. Next: a provider adapter (e.g. the WhatsApp Business API) behind the same outbox, with delivery receipts updating message status.
- **Server-side session revocation for staff.** Sessions are signed cookies that expire after 8 hours, and sign-out deletes the cookie. Next: a session table or a per-user "sessions valid after" timestamp, so an admin can sign a lost device out at once.
- **Staff admin: create users, reset passwords, roles.** The demo staff user comes from the seed. Next: an admin screen and an email-based reset flow.
- **Sign-in limits per network and CAPTCHA.** Today the limit is per email. Next: a per-IP limit with care for shared mobile-carrier IPs, and a CAPTCHA after repeated failures.
