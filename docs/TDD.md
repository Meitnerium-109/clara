---
title: "Clara: Technical Design Document"
---

**GitHub:** https://github.com/Meitnerium-109/clara

**Live app:** (added in the final submission)

# 1. Overview

## The problem

Company A runs 6 labs and 38 collection centres in coastal Andhra Pradesh. Its desktop lab information system (LIS) produces signed PDF reports, which front-desk staff send one by one on WhatsApp from 9 shared phones. Patients call or walk in to ask whether reports are ready, and about 15 reports a month go to the wrong number. Many patients are elderly, read Telugu, and use low-end phones on weak data.

The goal: patients should never have to call about a report. When the pathologist signs, the patient gets a safe link automatically, with a short plain-language explanation.

## Users

- **Patients**, often elderly, sometimes several family members on one phone. They need large text, one clear action per screen, and Telugu.
- **Front-desk staff**, who import LIS results, check delivery, resend links and phone patients with critical results.

## What the core build covers

Clara (Latin for "clear") is one Next.js application that implements the whole core build end to end:

- LIS CSV import with a row-by-row preview and an idempotent commit.
- An automatic report link on sign-off, sent exactly once, plus a callback task for critical results.
- A patient portal: report link → one-time code → consent → "Whose reports?" picker → report → PDF.
- Sign-in with a mobile number for expired links.
- Plain-language explanations of out-of-range results in English, Telugu and Hindi: locked templates first, Gemini second, a safe fallback always.
- A front-desk console: search, delivery status, resend, access log, callbacks, flagged explanations.
- A demo phone, so reviewers can receive links and codes, because messaging is mocked as the brief asks.

The optional extras in the brief (a referring-doctor view, an operations report, a pathologist review queue) were not attempted.

# 2. Architecture and why

## Stack

| Area | Choice | Why |
|---|---|---|
| App | Next.js 15 (App Router) + TypeScript | One codebase for screens and server code; server actions mean no separate API to secure. |
| Database | Postgres on Supabase, Mumbai (ap-south-1) | Meets "hosting in India". Used only as a database. |
| ORM | Prisma 6 | Typed queries and migrations. Version 6, not 7, because it reads Supabase's pooled and direct URLs straight from the schema. |
| Validation | Zod | On every input: CSV rows, form fields, action arguments, AI output. |
| Auth | Custom: bcrypt staff passwords, link + OTP for patients, signed httpOnly cookies (jose) | The OTP flow is the "hard part" of the brief, so it is built and tested, not outsourced. |
| AI | Google Gemini over plain `fetch`, model set by `GEMINI_MODEL` (default `gemini-3.5-flash`) | Good Telugu and Hindi. No SDK means one fewer dependency, and tests can use a fake `fetch`. |
| Styling | Tailwind CSS v4 with our own tokens | A designed look, not a component kit's defaults. |
| PDF | pdf-lib, generated on request | Stands in for the LIS's signed PDF; never stored, never a public URL. |
| Tests | Vitest | Unit tests for all rules; database tests against real Postgres for the guarantees only a database can give. |
| Deploy (planned) | Vercel with functions in Mumbai (`bom1`) | Free, and close to the database and the patients. |

## Code structure

- `src/lib`: pure logic with tests next to it (flags, critical limits, mobile numbers, tokens, OTP rules, CSV, import preview, summaries, translations, PDF).
- `src/server`: everything that touches the database or the network.
- `src/app`: routes. Patient screens are in the `(patient)` group; staff screens are in `staff/(console)`.

React components contain no business rules.

## Flow

```
LIS (desktop) ──CSV──► /staff/import
                         │  readLisCsv → buildImportPreview  (pure: Zod + flag rules + import rules)
                         │  staff checks the preview and clicks Confirm
                         ▼
                       commitImport — one transaction per order
                         ├─ upsert patient, order, results
                         └─ if the order is signed now (Processing → Ready):
                              INSERT message … ON CONFLICT (dedupeKey) DO NOTHING
                              └─ only if inserted: ReportLink (SHA-256 hash, 72 h)
                                                   + CallbackTask if critical
                         after(): English explanations prepared in the background
                         ▼
                       Outbox (Message) → mock provider: Sent → demo phone: Delivered
                         ▼  patient taps the link
                       /r/[token] → hash lookup → valid / expired / revoked / not found
                         │                         └─ not valid → "Sign in with your mobile number"
                         ▼
                       one-time code by SMS (outbox) → verify (keyed hash, 5 min, 5 tries, once)
                         ▼
                       patient session cookie (the mobile, 30 min idle)
                         → consent (first time for this mobile) → "Whose reports?" picker
                         ▼
                       report: values + status labels · explanation per out-of-range result
                               · PDF · an access-log row for every view and download
```

# 3. Data model

Thirteen tables, all in Postgres in Mumbai.

| Table | What it holds | Key constraints and why |
|---|---|---|
| StaffUser | Front-desk accounts (email, bcrypt hash, name) | Unique email. |
| StaffLoginAttempt | One row per sign-in attempt | Indexed (email, time) to count failures for the lockout; also a sign-in log. No foreign key, so unknown emails are limited too. |
| Patient | Name and mobile (E.164) | Unique (mobile, name). One phone can hold a family; mobile is the leading column, so the same index serves "all patients on this phone". |
| Consent | Mobile, wording version, time | Unique (mobile, version). Consent belongs to the person holding the phone, and new wording means asking again. |
| Order | LIS order ID, patient, doctor, status, critical, signedAt | Unique LIS order ID. Status (Processing/Ready) and critical are separate facts. |
| Result | One test of an order: raw text plus parsed numbers and flag | Unique (order, parameter): re-imports update instead of duplicating. Raw text is kept so the patient always sees the lab's own wording. |
| Summary | Explanation for one result in one language, with source and flag | Unique (result, language): this is the cache, and it absorbs duplicate inserts when two views race. |
| ReportLink | SHA-256 of the token, expiry, revokedAt, reason, created by | Unique token hash. The raw token is never stored. |
| OtpChallenge | Keyed hash of the code, expiry, attempts, usedAt | Indexed (mobile, created) for the rate limit and "newest code only". |
| Message | The outbox: recipient, channel, kind, status, body (demo only) | Unique dedupeKey (`signoff:ORD-…`): the database itself blocks a second sign-off message. |
| AccessLog | Actor type, staff or patient ID, action, order, time | Real foreign keys; IDs only, never names or numbers. |
| CallbackTask | Critical order, reason, status, who called, note | Unique per order: one task per critical order. |
| ImportBatch | File name, row and error counts, who imported | A record of every import. |

There is no session table: sessions are signed cookies. Indexes were added where the app looks things up, because Postgres doesn't index foreign keys automatically.

# 4. Main flows

## Import with preview

Staff upload the CSV (agreed columns: `order_id, patient_name, mobile, parameter, unit, result, reference_range, status, referring_doctor`). papaparse reads it, coping with quoted Indian numbers like `"1,50,000"`, Excel's byte-order mark and Windows line endings.

A pure function, `buildImportPreview`, marks every row New, Updated, Unchanged or Rejected with a reason. Its rules:

- Every row passes Zod plus our own checks (mobile, status, flags).
- An order is all-or-nothing: one bad row rejects the whole order, so a report is never signed with a result missing.
- A signed report is frozen: no changed values, no added results, no going back to Processing.
- An existing order can never move to a different patient or phone.
- Nothing is ever deleted.

One safety exception: a signed order re-sent as "Ready (critical)" with unchanged values gets a callback task instead of a rejection.

On Confirm, the browser sends the same file again, never the preview. The server rebuilds the preview from the database as it is now, and commits only if a hash of the plan matches what staff saw. So a stale or tampered preview cannot be committed. Each order is then saved in its own transaction, so one failure can't half-save a report or block the rest of the file.

## Exactly-once delivery

When an order becomes signed, the sign-off message is inserted with `ON CONFLICT DO NOTHING` on its unique key `signoff:<order ID>`. Only if that insert actually adds a row are the report link and the callback task created, in the same transaction.

A re-import, a double click or two servers racing all reach the same unique index, and Postgres lets exactly one win. There are two layers: the preview plans nothing for an unchanged file, and the database refuses a second message even if delivery code runs again.

The seed is create-only and uses the same delivery function, so demo data goes through the production path.

## Report link and one-time code

`/r/[token]` checks the token's shape, then looks up its SHA-256 hash. A link can be valid, expired (after 72 hours), revoked (replaced by a resend) or not found. Anything but valid shows a friendly page with "Sign in with your mobile number".

For a valid link, the page says "we'll send a 6-digit code to ••••••0010". The browser sends only the token; which phone receives the code always comes from the database. A browser that has already verified that phone goes straight to the report.

## Sign in with mobile

`/login` gives the same answer whether or not the number is known ("If this number has reports with us, we've sent a code"), and only actually sends a code when there is something to see. Otherwise the form would reveal who has had tests at the lab, which is health information in itself.

## Consent and family picker

After the code, and before any health data, a patient sees the consent screen if this phone hasn't agreed to the current wording version (`2026-11-v1`). Consent is stored per mobile with the version and time.

If several patients share the number, "Whose reports?" shows one large button per name. Each person's orders are listed as Ready (open the report) or Being tested.

## Report view

Each result shows the value, unit, normal range and a status label (Normal, Low, High, Critical, or "Ask doctor" when it can't be compared), always as icon plus word.

- **Out-of-range results** get an explanation in the chosen language, streamed in its own slot, with "Explanation, not a diagnosis. Your doctor will advise you." and a "This explanation seems wrong" button.
- **Critical orders** show "Please expect a call from the lab" and no explanations.
- **The PDF** is generated on request.
- **Results of an unsigned order** are never loaded.
- **Logging:** every view and download writes an access-log row before the page is returned.

## Front-desk console and callbacks

- **Search** by name, order ID or 4+ digits of the mobile in any format. It runs as a server action, so names and numbers never appear in URLs.
- **Delivery status** per order: Not signed, Queued, Sent, Delivered, Opened (or No link / Failed). "Opened" means the patient viewed the report after the latest link was sent.
- **Order page:** results, links (and who created each), messages and the access log. Opening it is itself logged.
- **Resend** is a two-step button that shows the masked number first, so staff can spot a wrong number. It revokes every live link, sends a new one and logs who did it, all in one transaction.
- **Callbacks** are listed longest-waiting first, with the reason (for example "Potassium 6.8 mmol/L (critically high)"). The full number appears only after "Show number to call", and that is logged. "Mark as called", with an optional note, can only happen once.
- **Flagged explanations** are listed with the text, source, language and the patient's note.

# 5. How the AI part works

**Rules decide the flags, never the AI.** A pure function parses the lab's range (`12.0-15.5`, `0-100`, `<200`, `>40`), compares the value, and checks a small critical-limits table first. Critical limits apply only when the unit matches, so a dangerous potassium is caught even if the range is garbled. Anything it can't parse is UNKNOWN, never a guess. An order is critical if the LIS says so OR any result crosses our limits: a needless call costs minutes, a missed one could harm someone.

**Where an explanation comes from**, in order:

1. Critical order or value → none.
2. Normal or not comparable → none (the brief asks for out-of-range values only).
3. One of 8 locked templates (haemoglobin, LDL, fasting glucose, HbA1c, TSH, creatinine, platelets, vitamin D) → the template.
4. Otherwise → Gemini.

Templates are three short sentences: where the value sits against the range, what the test measures, and "your doctor will explain". They use the lab's own test name in every language.

**What Gemini receives:** only test name, value, unit, range, direction and language. A prompt builder picks those fields by name, and a test proves that names, numbers and IDs never get in, even when a whole database row is passed. The request uses an 8-second timeout, JSON output mode with a schema, temperature 0.2, and no "thinking" step.

**Validation.** The output must be JSON `{ "summary": string }` of 20–400 characters that contains the test name. It is rejected if it contains any of a list of diagnosis, condition, medicine or reassurance words in English, Telugu and Hindi, or a link or phone number. A test runs every template (8 tests × 2 directions × 3 languages) through the same validator, so the locked text can't break the rules the AI is held to.

**Fallback.** Any failure shows "A simple explanation is not available. Please see your full report or ask your doctor." in the patient's language. The page never breaks.

**Caching.** Explanations are stored per result and language with their source (TEMPLATE, AI or FALLBACK).
- A fallback after bad AI output is saved, because asking again would likely fail the same way.
- A fallback after a timeout or outage is not saved, so the next view retries.
- English is prepared just after sign-off with Next.js `after()`, so imports aren't slowed down. Telugu and Hindi are made on first view.

**The model-retirement problem.** The original plan fixed `gemini-2.5-flash`, but Google no longer offers it to new API keys: it returns 404 and suggests `gemini-3.8-flash`. We made the model a setting and chose the default by measurement:

| Model | Result |
|---|---|
| gemini-3.8-flash, 3.7-flash, flash-latest | Timed out at 8 s |
| gemini-3.5-flash, thinking off | Valid output in about 1.4 s; 9 of 9 valid across 3 tests and 3 languages |
| gemini-3.5-flash, thinking on | Invalid JSON |

Four calls first fell back. They failed in under 0.6 seconds while 9 calls were fired back to back, and passed when spaced out, so they were almost certainly the free tier's rate limit. Their status code wasn't captured.

**"This explanation seems wrong."** Patients can flag a saved explanation with an optional note. It only works for reports on their own phone, and it is logged. Staff see all flags on one page.

# 6. Security and privacy

**Link tokens.** 32 random bytes, base64url. Only the SHA-256 hash is stored, so a database leak reveals no working links. Links expire after 72 hours, belong to one order, and are revocable; a resend revokes them all. Report link pages send `Referrer-Policy: no-referrer`, so the token never leaks to another site.

**One-time codes.**
- 6 digits from `crypto.randomInt`, stored as an HMAC keyed by a server secret. A plain hash of a 6-digit code could be reversed instantly, since there are only a million codes.
- Valid for 5 minutes and usable once. A resend makes older codes useless.
- At most 3 codes per mobile per 15 minutes, counted from database rows.
- Checking a code is two conditional updates. First "claim an attempt" (only while unused, unexpired and under 5 attempts), then "spend the code" (only while unused). So ten guesses arriving at once still stop at five, and two tabs submitting the right code let exactly one through.

**Sessions.** Signed JWTs in httpOnly, SameSite=Lax cookies, Secure in production.
- **Patient session:** holds only the verified mobile, with a 30-minute idle timeout. Middleware re-issues it on page views, on GET only so it never undoes a sign-out.
- **Staff session:** holds only the staff ID and lasts 8 hours.
- **No swapping:** each token carries an audience, so a patient token can never act as a staff session, or the reverse.
- **Staff sign-in:** locks an email after 5 failures in 15 minutes. An unknown email takes as long as a wrong password, so the form doesn't reveal which emails exist.

**Access control.** Middleware checks cookie signatures, and every page, action and route checks again itself.
- **Patients:** every query is filtered by the signed-in mobile inside its WHERE clause, so an ID from the URL is only "which one", never proof of access. "Not yours" and "doesn't exist" show the same page.
- **Staff:** the query functions never return a full mobile number. Testing found full numbers in the page data in development mode (React's debug data). A production build had none, and the data layer now strips them anyway.

**DPDP Act.**
- **Consent:** asked before any health data, stored per mobile with the wording version and time.
- **Hosting in India:** the database is in Mumbai. What goes to Gemini (outside India) contains no name, number, ID, doctor or date.
- **Access log:** every view, download, code event, flag, resend, callback, staff order view and number reveal is recorded, with IDs only. The log is written before data is shown, so a failure blocks the view rather than letting it go unrecorded.

**Other headers and data handling.**
- **Security headers:** nosniff, `X-Frame-Options: DENY`, a strict referrer policy, Permissions-Policy and HSTS. Patient pages are marked `noindex`.
- **Outbox:** message bodies (which contain links and codes) are stored only when `DEMO_MODE=true`.
- **Secrets** are only in environment variables.

**Honest limit.** If the LIS holds a wrong number, the code goes to that wrong number too. Automation removes manual typing, which is the cause today. The message itself carries no name or test details, and resend shows a masked number so staff can spot errors.

# 7. UI and design decisions

**"Clara glass".**
- **Background:** a pale aqua-to-blue gradient.
- **Glass surfaces:** translucent white with blur, only on the main card, the header and the language switch. Blur is expensive on cheap phones, so lists use solid cards.
- **Fallback:** without blur support, or when the user asks for reduced transparency, cards become solid white.
- **Colour:** one accent (deep teal) for actions. Amber and red are reserved for result flags and always come with an icon and a word.
- **Contrast:** every text/background pair passes WCAG AA, the lowest being 5.4:1, including muted text on the bare gradient.

**Patient screens** are phone-first, with 18px base text and 56px full-width buttons. Each screen has one clear primary action:
- Landing: "See my reports".
- Link page: "Send code".
- Code entry: "Open my report".
- Consent: "Agree and continue".
- Report: "Download full report (PDF)".

The code box is one large numeric field with `autocomplete="one-time-code"`. Every screen has a designed loading, empty and error state.

**Telugu.** Every patient screen is in English, Telugu and Hindi, chosen with a glass switch that works without JavaScript and is remembered in a cookie.
- **Fonts:** Noto Sans, Noto Sans Telugu and Noto Sans Devanagari are self-hosted. Only Latin is preloaded; the Telugu and Devanagari fonts download only when a page shows those characters.
- **Switch labels:** use the system font, so showing "తెలుగు" doesn't pull the Telugu font into an English page.
- **Line height:** Telugu and Hindi get extra line height (1.85 and 1.75) for stacked vowel signs.

**Low-end phones and weak data.**
- **Page weight:** patient pages load about 126–128 kB of JavaScript in total (from the production build), and the PDF is about 2 KB.
- **Streaming:** explanations stream into the report, so values are readable before the AI answers.

**Staff screens** use 15–16px text and tables that scroll sideways on phones. The import preview highlights rejected rows in red with the reason, and can filter to show only those rows.

**Demo phone.** `/demo/phone`, available only in demo mode and labelled DEMO TOOL, shows each seeded number's messages as a chat that refreshes by itself.

# 8. Testing

**Unit tests (`npm test`): 439 tests in 19 files.** They cover:
- range parsing and flags (87),
- the import preview (50),
- templates and the validator (95),
- OTP rules (31),
- mobile normalising (27),
- safe redirects (25),
- link tokens (20),
- sessions (11),
- the CSV reader (13),
- the Gemini client with a fake `fetch` (9),
- translations, delivery status, messages, the PDF and others.

**Database tests (`npm run test:db`): 53 tests in 3 files against real Postgres**, plus the 9 Gemini client tests again, so 62 in that run. They use `TEST-` order IDs and placeholder numbers and delete everything they create. They prove:
- **Delivery:** importing the same file twice sends once; five simultaneous deliveries send one link; a stale preview is refused.
- **Access control:** two phones and a family.
- **Codes:** single use, lockout at 5, expiry, newest code only, 3 sends per 15 minutes, simultaneous correct submissions let one through, simultaneous guesses stop at 5.
- **Summaries:** cached once, no explanations on critical orders, a timeout not cached, only the owner can flag.
- **Staff actions:** resend revokes the old link and records who did it; "mark as called" happens once; search; delivery stages.

**Deliberate-break checks.** Code was broken on purpose to prove the tests catch it:
1. **Every import signs:** making every order "signed" failed 3 tests.
2. **Dedupe guard removed:** with delivery's "stop if the message already exists" line gone, the repeat-call and race tests failed. The import-twice test still passed, which shows the two layers are independent.
3. **Attempt limit removed:** with "under 5 attempts" gone from the OTP claim, the simultaneous-guesses test failed while the one-at-a-time lockout test still passed. Only the race test proves the atomic condition matters.

**HTTP checks** were run by hand against development and production servers:
- redirects without a session;
- another phone's report and PDF returning "not found";
- unsigned results hidden;
- the cookie refresh;
- a staff token rejected as a patient session;
- no full mobile numbers in production pages.

**Not done:** there are no browser-automated tests. The planned Playwright smoke test was not written.

# 9. Assumptions

Each item is labelled; the full list with reasons is in `docs/ASSUMPTIONS.md`.

**Data from the LIS**
- **A1.** The LIS export is the agreed CSV: one row per result, the columns above in any order, UTF-8, at most 1 MB and 5,000 rows, all rows of one order agreeing on patient, mobile, status and doctor.
- **A2.** The export includes a mobile column. The sample has none, but automatic delivery is impossible without it.
- **A3.** A patient is identified by mobile + name.
- **A4.** The LIS spells a name the same way every time.
- **A5.** Mobiles are Indian and stored as E.164. Landlines and foreign numbers are row errors.
- **A6.** Status is only Processing, Ready or Ready (critical).

**Results**
- **A7.** An order is critical if the LIS says so or a result crosses our limits.
- **A8.** The critical limits are textbook values a pathologist must confirm: potassium < 2.8 or > 6.0 mmol/L; sodium < 120 or > 160 mmol/L; haemoglobin < 7 g/dL; glucose < 50 or > 400 mg/dL; calcium < 6.0 or > 13.0 mg/dL.
- **A9.** A limit applies only when the unit matches.
- **A10.** `a-b` ranges include both ends; `<x` and `>x` exclude the boundary.
- **A11.** Indian and Western number grouping are accepted; a European decimal comma is rejected.
- **A12.** Non-numeric results are UNKNOWN, labelled "Ask doctor", never "Normal".

**Import and delivery**
- **A13.** Orders import all-or-nothing, and import never deletes.
- **A14.** Changes to signed reports are rejected, except a later critical marking with unchanged values.
- **A15.** An order can't move to another patient or phone by import.
- **A16.** The report-ready message has no name or test details.
- **A17.** Links go by WhatsApp and codes by SMS (both mocked).
- **A18.** Delivery is mocked: Sent by a mock provider, Delivered when the demo phone shows it.

**Patients**
- **A19.** Consent is per mobile, tied to wording version `2026-11-v1`.
- **A20.** Patient sessions last 30 minutes idle, with no absolute maximum. Staff sessions last 8 hours.
- **A21.** The PDF is English only.
- **A22.** The demo phone is open to anyone when `DEMO_MODE` is on, and must be off in a real deployment.

**Explanations**
- **A23.** Only Low and High results get explanations.
- **A24.** What is sent to Gemini is not personal data.
- **A25.** The banned-phrase list is a safety net, not a guarantee.

**Staff and data**
- **A26.** Staff may see results and, on request (logged), full numbers. There is no self-registration or password reset.
- **A27.** All seed people are fictional, with placeholder numbers 90000 000xx.

**Translation**
- **A28.** All Telugu and Hindi text was AI-translated and needs native-speaker and clinical review: the templates, patient screens, consent wording, messages and the landing taglines.

# 10. What we cut and what we'd do next

**Not finished**
- **Deployment.** The live link comes in the final submission.
- **Browser smoke test.** Playwright.

**Product**
- **Amended reports:** today they're rejected. Next: an explicit amendment that keeps the old version and tells the patient what changed.
- **Real WhatsApp/SMS:** a provider adapter behind the same outbox, with delivery receipts.
- **Reviewing flagged explanations:** a review state, and promoting often-flagged AI text to new locked templates.
- **Translated PDF:** subsetted Noto fonts, if the extra size is acceptable.
- **Native-speaker and clinician review** of all patient text.
- **Import:** a history screen, and background processing for very large files.
- **Staff admin:** users, roles and password reset.
- **Optional depth from the brief:** a referring-doctor view, an operations report, a pathologist queue.

**Security**
- **CSP:** a strict Content-Security-Policy with nonces.
- **Patient sessions:** an absolute limit.
- **Staff sessions:** server-side revocation.
- **Refused access:** log attempts to read another phone's order.
- **Sign-in protection:** per-IP limits and CAPTCHA.
- **OTP send race:** close the gap where two simultaneous code requests can both pass the count.
- **Resend:** limits beyond the confirm step.
- **AI safety:** a second, independent check of AI text.
- **Search:** paging beyond 50 results.
