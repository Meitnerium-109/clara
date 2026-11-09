# Cuts

What we left out on purpose, and what we would build next.

- **Amended reports.** Today, a re-import that changes a signed result is rejected in the preview. Next: the LIS sends an explicit amendment, we keep the old version, mark the report "Amended", and send the patient a new link with a note explaining what changed.
- **Real WhatsApp/SMS delivery.** Messages go to a mock outbox and a demo phone screen, as the brief asks. Next: a provider adapter (e.g. the WhatsApp Business API) behind the same outbox, with delivery receipts updating message status.
- **Server-side session revocation for staff.** Sessions are signed cookies that expire after 8 hours, and sign-out deletes the cookie. Next: a session table or a per-user "sessions valid after" timestamp, so an admin can sign a lost device out at once.
- **Staff admin: create users, reset passwords, roles.** The demo staff user comes from the seed. Next: an admin screen and an email-based reset flow.
- **Sign-in limits per network and CAPTCHA.** Today the limit is per email. Next: a per-IP limit with care for shared mobile-carrier IPs, and a CAPTCHA after repeated failures.
- **Upload progress and very large files.** Files are capped at 1 MB / 5,000 rows and checked in one request. Next: background processing with progress for multi-day exports.
- **Import history screen.** Each import is recorded (`ImportBatch`: file, rows, errors, who), but there is no screen for it yet.
- **Content-Security-Policy.** The other security headers are set; a strict CSP needs nonces for Next.js's inline scripts. Next: nonce-based CSP via middleware.
- **Absolute patient session limit.** Sessions end after 30 idle minutes but can be extended indefinitely by activity. Next: an absolute cap (e.g. 12 hours) stored in the token.
- **Logging refused access.** A patient asking for another phone's order sees "not found", but the attempt isn't logged. Next: log refused reads for security review.
- **Telugu/Hindi PDF.** The PDF is English only. Next: embed subsetted Noto fonts for a translated PDF, if the extra size is acceptable on weak data.
- **Native-speaker review of all patient text**, including the consent wording.
- **Rate-limit edge cases.** Two code requests at the very same moment could both pass the "3 per 15 minutes" count. Unknown numbers are never rate-limited, because nothing is sent to them, which is a small timing side channel. Next: a per-mobile row lock or counter, and a per-IP limit.
- **Reviewing flagged explanations.** Staff can see flags but can't mark them reviewed or replace the text. Next: a review state, and turning frequently flagged AI explanations into new locked templates.
- **A stronger AI safety check.** The banned-phrase list is a simple filter. Next: a second, independent check (another model, or a clinician-approved phrase list per test) before showing AI text.
- **Search paging and resend limits.** Search returns the 50 most recent matches, and resend has no rate limit beyond the confirm step.
