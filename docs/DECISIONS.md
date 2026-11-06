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
