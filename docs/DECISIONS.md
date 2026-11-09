# Decisions

One paragraph per decision: what we chose, what else we considered, and why.

The core stack (Next.js, Tailwind, Supabase Postgres in Mumbai, Prisma, Zod, custom auth with jose, Gemini, Vercel `bom1`) is listed with reasons in `CLAUDE.md`. This file records the decisions made while building.

## Prisma 6, not Prisma 7

Prisma 7 is the current stable line. It moves connection URLs out of the schema into a `prisma.config.ts` and requires a separate driver-adapter package. Prisma 6 still reads `url` and `directUrl` directly from the schema, which matches Supabase's two connection strings with no extra setup, and it is much better documented. Versions are pinned exactly so a reviewer installs what we tested. Upgrading later is a contained change.

## Pooled URL for the app, direct URL for migrations

Supabase gives two connection strings. The app uses the pooled one (`DATABASE_URL`) because Vercel functions open many short-lived connections and would run out of direct ones. Migrations use the direct one (`DIRECT_URL`) because they need a real session, which the pooler does not provide.

## Patient identity is mobile + name

Options were (a) mobile + name, or (b) assuming the LIS exports a patient ID. We chose (a) because it uses only the data the brief shows. The cost is that a misspelt name creates a second patient on the same mobile. This is logged in ASSUMPTIONS.md. The unique index is `(mobile, name)` with mobile first, so the same index also answers "all patients on this mobile", which the family picker needs. Mobiles are normalised to E.164 by one pure, tested function before they reach the database.

## Consent is stored per mobile, with a wording version

Options were `Patient.consentAt` or a separate `Consent` table keyed by mobile. The person who signs in and ticks the box holds the phone, often for a whole family, so consent belongs to the mobile. Storing the wording version means we can prove which text was agreed to, and we can ask again if the wording changes.

## Order status is split into status + critical flag

The LIS has three states: Processing, Ready, Ready (critical). We store `status` (PROCESSING / READY) and `critical` (true/false) separately, so "is it signed?" and "is it critical?" are each a simple check in code. Being critical does not change whether a report is signed.

## When an order counts as critical

An order is critical if the LIS marks it `Ready (critical)` OR any of its results is flagged `CRITICAL_LOW` or `CRITICAL_HIGH` by our own rules. We trust either source, because calling a patient unnecessarily costs a few minutes of staff time, while missing a critical value could harm someone. This is applied during import.

## Results keep the raw text as well as parsed numbers

Each result stores `valueText` and `refText` exactly as the LIS gave them, plus parsed `valueNum`, `refLow` and `refHigh` when parsing succeeds. Patients always see the lab's own text. Flags are computed from the parsed numbers. If parsing fails, the flag is `UNKNOWN` rather than a guess. We used `Float` rather than `Decimal` because values are only compared against ranges, never added up, and what patients see comes from the text.

## Critical flags record the direction

Flags are NORMAL, LOW, HIGH, CRITICAL_LOW, CRITICAL_HIGH and UNKNOWN. Recording the direction of a critical value tells callback staff more ("potassium critically high") and keeps the display consistent with low/high.

## Never sending twice is enforced by the database

Sign-off creates one outbox message with a unique `dedupeKey` (e.g. `signoff:ORD-71204`). If a re-import or a double click tries to send again, the database rejects the insert, so correctness does not depend on application code being careful. Re-imports upsert results on the unique `(orderId, parameter)`, so they never duplicate rows.

## Signed results cannot be changed by re-import

If a re-imported row changes a value on an order that is already signed, the import preview rejects that row. Changing a signed report silently could mean the patient saw one value and their doctor another. Amended reports are recorded in CUTS.md.

## Outbox stores message bodies only in demo mode

A message body contains the raw link token or OTP, which would undo storing only hashes. The body is saved only when `DEMO_MODE=true`, so the demo phone screen works for reviewers. Otherwise only the message type, recipient and status are kept, as they would be with a real provider.

## Summaries are cached per result and language

`Summary` is unique on `(resultId, language)`, so each explanation is generated once and reused. Patients can flag a summary (`flaggedAt`) and optionally say why (`flagNote`, max 500 characters).

## Access log uses typed references, not free text

`AccessLog` stores the actor type plus a nullable staff ID or patient ID, and the order ID. These are real foreign keys, so a log row cannot point at nothing, and no names or phone numbers are written into the log. Before the OTP is verified, the patient ID is empty because we do not yet know who is opening the link.

## No session table

Patient and staff sessions are signed httpOnly cookies, as set in CLAUDE.md, so they need no database table. Idle timeout is handled by the cookie's own expiry, refreshed on activity.

## Indexes

Postgres does not index foreign keys automatically, so we added indexes where the app looks things up: `Order.patientId`, `ReportLink.orderId`, `Message(to, createdAt)` for the demo phone, `OtpChallenge(mobile, createdAt)` for the rate limit, `AccessLog(orderId, at)` and `CallbackTask(status, createdAt)`. We did not add a separate index on `Patient.mobile` because the `(mobile, name)` unique index already covers mobile lookups.

## Vitest 4, installed once with `--legacy-peer-deps`

Vitest 5.1.0 was published four days before we installed it, so we chose the latest stable 4.x release (4.1.12) and pinned Vite 7.3.7 next to it. npm 10 crashed (`Cannot read properties of null (reading 'edgesOut')`) while following a chain of optional peer dependencies (Vite devtools, which in turn want any Vitest version). We don't use any of those packages. Installing once with `--legacy-peer-deps` skips that chain, and a plain `npm install` works afterwards, so no one else needs the flag.

## Mobile normaliser returns a reason, not just null

`normaliseMobile` returns either `{ ok: true, e164 }` or `{ ok: false, reason }`. The CSV import preview needs to tell staff *why* a row was rejected ("Not a valid 10-digit Indian mobile number"), so the reason comes straight from this function. Accepted forms: 10 digits starting 6–9, optionally with spaces, dashes, dots or brackets, and an optional `+91`, `91`, `0091` or leading `0` prefix.

## Flags: one function, critical checked first

`assessResult` is the single entry point that both the seed and the CSV import call for a result row, and its output maps straight onto the Result columns, so the rules exist in exactly one place. It checks critical limits before the reference range, so a dangerous potassium is caught even if the LIS sends a garbled range. Anything it can't parse becomes UNKNOWN rather than a guess. The LIS status text ("Ready (critical)") is parsed by a separate small function, `parseLisStatus`, because it's a different concern from result values.

## bcryptjs instead of bcrypt

Both implement the same bcrypt algorithm. `bcrypt` is a native C++ module that has to compile on install, which often fails on Vercel and Windows. `bcryptjs` is plain JavaScript, so it installs everywhere. It is slower per hash, but we hash only at login and seeding, so that doesn't matter. Cost factor 12.

## Seed creates only LIS data

The seed creates the staff user, patients, orders and results: what an import would produce. It does not create report links, messages or callback tasks. Those come from the real sign-off logic, so the demo runs that code rather than a fake copy of it. Every write is an upsert on a unique key, so running the seed twice changes nothing.

## CSV has separate parameter and unit columns

Options were one combined column ("Haemoglobin g/dL", as in the sample) split by our code, or separate columns. Splitting by rule breaks on names with spaces or numbers ("Vitamin D 25-OH ng/mL"), so we chose separate columns: `order_id, patient_name, mobile, parameter, unit, result, reference_range, status, referring_doctor`.

## Design tokens in Tailwind v4 `@theme`

Colours, fonts and the card radius are defined once in `globals.css` as Tailwind theme tokens (`bg-accent`, `text-ink`, `rounded-card`), so every screen draws from the same small palette. Every text/background pair was checked against WCAG AA; the lowest is 5.4:1 (accent on soft accent). Muted text passes even on the bare background gradient, so text stays readable if the glass fails. Dark mode was removed: the brief doesn't ask for it, and one well-tested light theme is safer for elderly readers.

## Glass only where it counts, with a solid fallback

`.glass` (translucent white, 16px backdrop blur, light border) is used on the main card and the header only. Blur is expensive on low-end phones, so lists will use solid cards (`<Card surface="solid">`). If the browser can't blur, or the user has asked for reduced transparency, the card turns solid white with a visible border. The background gradient sits on a fixed pseudo-element rather than `background-attachment: fixed`, which repaints on every scroll on many phones.

## Fonts: Noto, self-hosted, scripts loaded only when used

`next/font` downloads Noto Sans, Noto Sans Telugu and Noto Sans Devanagari at build time and serves them from our own domain, so a patient's phone never contacts Google and we ship only the needed subsets. Only the Latin face is preloaded. The Telugu and Devanagari faces are declared with their Unicode ranges, so the browser downloads them only when a page actually shows those characters. Telugu and Hindi text get extra line height (1.85 and 1.75) for their stacked vowel signs.

## Text size by audience, not by page

Patient screens wrap content in `.patient-scale` (18px base). Staff screens keep 16px. Buttons have two explicit sizes, `md` (44px tall, staff) and `lg` (56px, full width, patient), so tap targets don't depend on the surrounding font size. All sizes are in rem, so a user's own browser text size is respected.

## Staff sessions: signed JWT in an httpOnly cookie

On sign-in we issue a JWT signed with HS256 and `SESSION_SECRET` (via jose), holding only the staff ID, and store it in an httpOnly, SameSite=Lax cookie (Secure in production) for 8 hours. httpOnly means page scripts can't read it, so a script-injection bug can't steal the session. Each token carries an audience (`staff` or `patient`), so a patient token can never pass as a staff session. The trade-off of a stateless token is that it can't be cancelled early on the server. Sign-out deletes the cookie, and every page re-checks that the staff account still exists. Server-side session revocation is in CUTS.md.

## Two layers of access control

Middleware checks the cookie's signature for every `/staff/*` request and redirects to sign-in if it's missing or invalid. It's fast and needs no database. It isn't the only check: Next.js can serve a cached layout without re-running it, and middleware has been bypassed in past Next.js vulnerabilities. So every staff page and server action also calls `requireStaff()`, which verifies the token and loads the staff account from the database.

## Failed sign-in limit stored in the database

Five failed attempts for one email within 15 minutes lock that email until the window passes. A success resets the count. On Vercel each request may run on a fresh instance, so an in-memory counter would reset constantly; instead each attempt is a row in `StaffLoginAttempt`, the same pattern as the OTP rate limit. Unknown emails are limited too, and an unknown email takes as long as a wrong password (we compare against a dummy bcrypt hash), so the form doesn't reveal which emails are staff accounts. Successful rows double as a staff sign-in log. The limit is per email, not per IP: IP addresses are personal data, and behind mobile carriers many people share one.

## Server actions for forms

Sign-in and sign-out are React server actions. The browser posts the form straight to server code, with no separate API route to secure. Next.js checks that the request comes from our own origin, which protects against cross-site request forgery. Sign-out is a POST form, not a link, so a link prefetch can't sign someone out.

## Import: preview is pure, commit rebuilds it

The import is split into a pure function, `buildImportPreview(rows, existingOrders)`, and a thin server layer. The pure function decides every outcome (New, Updated, Unchanged or Rejected, with a reason), so all the rules are unit-tested without a database. On Confirm the browser sends the same file again, never the preview, and the server rebuilds the preview from the database as it is now. It commits only if a hash of the plan matches what the staff member saw; otherwise it asks them to check the new preview. So a tampered or out-of-date preview can never be committed.

## Import: each order in its own transaction

Each order is saved in its own transaction (patient, order, results, then delivery). One failing order can't leave a half-saved report, and it doesn't block the rest of the file. A single transaction for the whole file would hold locks for the whole upload and roll back hundreds of good orders over one problem. Inside each transaction the order's status is checked again, so a signed report stays frozen even if two imports overlap.

## Sending exactly once: the database decides

The sign-off message is inserted with `ON CONFLICT DO NOTHING` on its unique `dedupeKey` (`signoff:ORD-71204`). Only if that insert actually adds a row do we create the report link and the callback task, in the same transaction. A re-import, a double click or two servers racing all reach the same unique index, and Postgres lets exactly one insert win. There are two layers: the preview plans nothing for an unchanged file, and the database refuses a second message even if code calls delivery again. Tests cover both, including five simultaneous deliveries against the real database.

## Seed is create-only and uses the real delivery

The seed now only creates missing rows and never overwrites, so re-seeding can't un-sign an order or undo an import. Seeded orders that are already Ready get their links from the same `deliverPendingSignoffs` function, so demo data goes through the production path.

## Database tests run only on request

`npm run test:db` runs the delivery tests against the configured Postgres, because only a real database can prove the unique-index guarantee. They use `TEST-` order IDs and a placeholder mobile and delete everything they create. A plain `npm test` skips them, so it never writes to a database.

## papaparse for CSV

Real LIS exports come from Excel-like tools: quoted commas in Indian numbers, Windows line endings, byte-order marks. papaparse is a widely used, tested parser for these cases, so we don't hand-roll one. It runs only on the server; the screen imports the column list from a separate tiny file, so the parser never reaches the browser.

## A signed order re-sent as "Ready (critical)" creates a callback task

If the LIS re-exports a signed order with identical values but now marks it "Ready (critical)", the import marks the order critical and creates a callback task instead of rejecting the row. Rejecting it would hide a possible emergency behind an import error that staff might not read closely. Accepting it changes nothing the patient has already seen: values, results and doctor stay frozen, and no second link is sent. If any value also changed, the row is still rejected as an amendment. The plan has its own kind (`MARK_CRITICAL`), so the commit can only set the flag and add the task, never touch results. It is idempotent like everything else: the task is unique per order.

## OTP codes: keyed hash, atomic attempts, single use

Codes are 6 digits from `crypto.randomInt`, stored as an HMAC-SHA256 keyed with a secret derived from `SESSION_SECRET`, with the challenge ID mixed in. A plain SHA-256 would be pointless: there are only a million codes, so anyone who saw the database could try them all in a second. Checking a code is two conditional database updates. First "claim an attempt" (attempts + 1 only while unused, unexpired and under 5), then "spend the code" (only while unused). So ten guesses arriving at once still stop at five, and two tabs submitting the right code at once still let exactly one through. Database tests prove both. Only the newest code for a mobile counts, so a resend makes older codes useless.

## One place for patient access control

Every read of patient data goes through `src/server/patientData.ts`, and every query there has the signed-in mobile in its WHERE clause (`patient: { mobile }`). IDs in the URL only say which record; the database won't return it unless it belongs to this phone. If it doesn't, the patient sees the same "We couldn't find this report" page as for an ID that doesn't exist, so we never confirm that someone else's report exists. Results of an unsigned order are never even loaded. Database tests cover two phones, a family sharing a phone, unsigned orders and made-up IDs; an HTTP check confirmed another phone's report and PDF both return "not found".

## Patient session: the mobile, in a signed cookie, 30-minute idle

The patient session cookie (`clara_patient`) holds only the verified mobile, signed with the `patient` audience so a staff token can't be used in its place, and the reverse. Middleware re-issues it on every page view (GET only, so it never undoes a sign-out action) for a 30-minute idle timeout. Opening a report link from a browser that already verified the same phone goes straight to the report; any other browser must enter a code. The link proves which report; the code proves who holds the phone now.

## Sign-in doesn't reveal who is a patient

`/login` gives the same answer, "If this number has reports with us, we've sent a code", whether or not the number is known. A code is only actually sent when there is something to see. Otherwise anyone could type numbers to find out who has had tests at the lab, which is health information in itself.

## Consent before any health data

After the code, and before any report, the patient sees the consent screen if this mobile hasn't agreed to the current wording version. The record stores mobile, version and time, and keeps the first time if agreed again. Consent is per phone, since the person holding the phone is the one agreeing, often for the family. Every patient page and the PDF route check it.

## Access log is written before data is shown

Link opens, code sends/failures/successes, report views and PDF downloads each write an `AccessLog` row with IDs only. The write is awaited before the page is returned: if the log can't be written, the page fails rather than showing health data unrecorded.

## PDF built on request, never stored

The PDF is generated from the stored results each time it is requested, by a route that checks the session, consent and ownership, logs the download, and sends `Cache-Control: private, no-store`. There is no file URL that could be shared or guessed. It uses the PDF standard fonts (no embedded font files) to stay around 2 KB on weak data; characters those fonts can't draw are replaced. That is why it is English only. pdf-lib's last release was in 2021: it is stable and widely used, but no longer actively maintained, which we would revisit for production.

## Language: a cookie, a glass switch, translated screens

The EN / తెలుగు / हिंदी switch is a plain form posting to a server action, so it works without JavaScript. It stores the choice in a cookie, which is not personal data, and every patient screen reads it. The switch labels use the system font, so showing "తెలుగు" on an English page doesn't download the Telugu web font. The font loads only when Telugu text is actually shown. Pages set `lang`, so Telugu and Hindi get their extra line height.

## Security headers

All pages send `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, a restrictive `Permissions-Policy` and HSTS. Report link pages (`/r/...`) send `Referrer-Policy: no-referrer`, so the secret token in the URL never leaks to another site. Patient pages are marked `noindex`.

## Demo phone

`/demo/phone` returns 404 unless `DEMO_MODE=true`. It lists the seeded numbers and shows each one's messages as a chat, with links clickable and refreshing every few seconds, so codes appear without reloading. The URL uses a short hash of the number, not the number itself.
