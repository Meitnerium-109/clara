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
