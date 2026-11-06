# Clara: project brief for Claude Code

Read this file fully before doing anything. It is the source of truth for what we are building, why, and how. If something here conflicts with a request, ask Pragati before acting.

## Who you are working with

Pragati is a third-year CS student building this alone as a take-home task for a Software Engineering Intern role at Isocode Labs. Reviewers read the code, the commit history and a design document, and will interview her about it. So:

- Explain every decision in plain words before or after you make it. She must be able to defend each one in an interview.
- When a choice is genuinely hers (product behaviour, design, trade-offs), stop and ask. Offer 2–3 options with the trade-off of each and a recommendation.
- Work in small steps. After each step, tell her what to test and suggest a commit message. She commits herself. Never squash or rewrite history.
- Never invent requirements. Use only the problem statement below. Anything we assume gets added to `docs/ASSUMPTIONS.md` with a one-line reason.

## Deadline and scoring

Submit by Mon 9 Nov 2026, 11:59 pm IST (aim for Monday early evening). Scoring: quality of work 50%, problem solving 30%, communication 20%.

Submission is a ZIP with (1) a Technical Design Document (PDF/Word, GitHub URL and live link at the top) and (2) `deployment.md`. Repo must be public, keep commit history, no secrets, no real personal data.

What great looks like: a product a client could try today; clean, readable code with clear structure; a UI that feels designed, not default; honest notes about limits; careful edge cases.
Common mistakes to avoid: a beautiful front end with nothing behind it; everything built, nothing working; no sample data; the AI part faked or not handling mistakes.

## The problem statement (Brief 1, verbatim essentials)

Client: Company A, Vijayawada. 6 labs, 38 collection centres in coastal Andhra Pradesh. 260 staff.

Today: a desktop lab information system (LIS) produces signed PDF reports. Front-desk staff send them one by one on WhatsApp from 9 shared phones. Patients call or walk in to ask if reports are ready. About 15 reports a month go to the wrong number.

The ask: patients should never have to call about a report. When the pathologist signs, the patient gets a safe link automatically. Many patients are elderly and read Telugu, so add a short plain explanation.

CORE BUILD (must work end to end, about 6–8 screens): LIS CSV import, automatic report link on sign-off, patient OTP portal with report view, plain-language summary, and front-desk resend. Roles: patient and front-desk staff. AI: summary of out-of-range values. Hard part: secure expiring links with OTP. Mock payments, messages and outside systems, and seed from the sample data.

AI rules from the brief: out-of-range flags come from rules using the report's reference ranges, not AI. AI only writes the summary. When the AI is wrong: summaries use locked templates for the most common tests, always link to the full report, and can be flagged by patients. Critical values get NO summary and create a callback task for staff.

Constraints: health data is sensitive personal data under the DPDP Act 2023: consent at registration, hosting in India, access logs. Links expire in 72 hours and need OTP to reopen. Patients use low-end phones on weak data, so pages must be light. One number often covers a whole family.

Design: minimal; clean layouts, white space, restrained palette, clear type, nothing without a purpose. Elderly patients on small phones: large text, one clear action per screen, a report page that reads well in Telugu.

Optional depth (only after the core is solid): referring-doctor view (last 90 days), delivery and access report for the operations head, pathologist review queue.

Out of scope: changes to the LIS, online test booking and payment, home-collection scheduling.

Sample data (seed from this; extend with more realistic, clearly fake rows):

| Order ID | Patient | Parameter | Result | Reference Range | Status | Referring Doctor |
|---|---|---|---|---|---|---|
| ORD-71204 | Lakshmi Prasanna K | Haemoglobin g/dL | 10.2 | 12.0-15.5 | Ready | Dr. S. Ramanaiah |
| ORD-71219 | Venkata Rao M | LDL cholesterol mg/dL | 142 | 0-100 | Processing | Dr. P. Anitha |
| ORD-71233 | Farzana Begum | Potassium mmol/L | 6.8 | 3.5-5.1 | Ready (critical) | Dr. K. Suresh |

## Decisions already made

| Area | Decision | Why |
|---|---|---|
| Name | **Clara** (Latin: clear, bright) | The product's job is making reports clear |
| Framework | Next.js (App Router) + TypeScript | One codebase for UI and API; Pragati knows TS from a client project |
| Styling | Tailwind CSS, custom design tokens, no component kit defaults | "Designed, not default" |
| Database | Postgres on Supabase, Mumbai region (ap-south-1), used only as a database | Meets "hosting in India" |
| ORM | Prisma | Typed queries, migrations, easy seeding |
| Validation | Zod on every input (forms, CSV rows, API bodies, AI output) | Basic security requirement |
| Auth | Custom: staff email + password (bcrypt); patients link + OTP. Sessions are signed httpOnly cookies (jose) | OTP flow is the "hard part" they want to see built, not outsourced |
| AI | Google Gemini (`gemini-2.5-flash`) via REST/SDK, key in env only | Pragati has used it; good Telugu/Hindi |
| Tests | Vitest for logic; one Playwright smoke test if time allows | Tests for the most important logic |
| Deploy | Vercel, functions pinned to Mumbai (`bom1`) | Free, fast, India region |
| Messages | Mocked: an Outbox table + a "demo phone" screen | Brief says mock outside systems |
| PDFs | Generated from result rows with pdf-lib, served only through an authenticated route | Mocks the LIS's signed PDF; never a public file URL |
| Fonts | Noto Sans, Noto Sans Telugu, Noto Sans Devanagari via `next/font` (self-hosted, subset) | Telugu must render well and load fast |

## Core flows

1. **Import.** Front-desk uploads the LIS CSV. Parse, validate each row with Zod, show a preview with row-level errors, then commit. Import is idempotent: re-importing the same file changes nothing and sends nothing twice (upsert by order ID + parameter).
2. **Sign-off triggers delivery.** When an order's status moves from Processing to Ready (signed), create exactly one report link and queue one message to the patient's mobile. Use a uniqueness guard so a re-import or double click can never send twice. "Ready (critical)" also creates a callback task.
3. **Patient opens the link.** `/r/[token]` → check token (exists, not expired, not revoked) → show masked number ("OTP sent to ••••••3210") → OTP → session → report. Expired link → friendly page → sign in with mobile + OTP → order list.
4. **Family.** One mobile can hold several patients. After OTP, if more than one, show a "Whose reports?" picker with large name buttons.
5. **Report view.** Each result shows value, unit, range, and a status label (Normal / Low / High / Critical) with icon + word, never colour alone. Plain summary in the chosen language (English, తెలుగు, हिंदी). Full PDF download. "This explanation seems wrong" button (stores a flag). Critical: no summary, instead "Please wait for a call from the lab. We are contacting you." Every view writes an access log row.
6. **Front-desk console.** Search by name, mobile or order ID; see delivery status per order (queued, sent, delivered, opened); resend link (revokes the old one, creates a new one, logs who did it); see the access log; work the callback task list for critical values.
7. **Demo phone.** `/demo/phone` (only when `DEMO_MODE=true`) shows mock WhatsApp/SMS messages for a chosen number, so a reviewer can receive links and OTPs. Label it clearly as a demo tool.

## Security design (the hard part: make it excellent and tested)

- Link tokens: 32 random bytes (crypto), base64url. Store only SHA-256 hash. 72-hour expiry. One order per link. Revocable. Resend revokes the old link.
- OTP: 6 digits from crypto, store hash only, 5-minute expiry, max 5 attempts then locked, single use. Rate limit sends: max 3 per mobile per 15 minutes (count rows in DB).
- Decision: the link proves which report; the OTP proves the person holds the phone now. OTP is required on every open from a new session. Honest limit for the TDD: if the LIS holds a wrong number, OTP goes to that wrong number too; automation removes manual typing (the current cause), and resend shows a masked number so staff can spot errors.
- Sessions: signed httpOnly, Secure, SameSite=Lax cookies; short patient sessions (30 min idle). Staff sessions separate.
- Access control on every server route: a patient session can only read orders for its own mobile; staff routes require a staff session. Never trust IDs from the client.
- No personal data in URLs, logs or AI prompts. Mask mobiles in the UI except where needed.
- Consent checkbox at first patient sign-in (DPDP), stored with timestamp.
- Security headers via `next.config`. Secrets only in env; `.env*` git-ignored; `.env.example` lists names only.

## AI design

- Flags are pure functions: parse the reference range, compare, return NORMAL / LOW / HIGH, plus CRITICAL from a small critical-limits table (for example potassium > 6.0 or < 2.8 mmol/L). Critical limits are an assumption: label them.
- Summary source order: (1) critical → no summary; (2) locked template exists for this test and language → use it; (3) otherwise call Gemini.
- Gemini input: only parameter, value, unit, range, flag, language. No names, numbers or IDs.
- Gemini output: JSON `{ "summary": string }`, validated with Zod, max length, must mention the parameter, must not contain diagnosis or medicine advice (simple banned-phrase check). Any failure, timeout or invalid output → fallback text "A simple explanation is not available. Please see your full report or ask your doctor." Never a broken page.
- Generate English at sign-off; generate Telugu/Hindi on first request and cache in the DB.
- Every summary records its source (TEMPLATE / AI / FALLBACK / NONE) and shows a small "Explanation, not a diagnosis. Your doctor will advise you." line.
- Locked templates: write for about 8 common tests (haemoglobin, LDL, fasting glucose, HbA1c, TSH, creatinine, platelets, vitamin D) in 3 languages. Telugu and Hindi templates were AI-translated and need a native reviewer: label this in ASSUMPTIONS.md.

## Data model (starting point; refine with Pragati)

StaffUser, Patient (name, mobile, consentAt), Order (orderId, patientId, referringDoctor, status, signedAt, critical), Result (orderId, parameter, unit, value, refLow, refHigh, flag), Summary (resultId, language, text, source, flaggedAt), ReportLink (orderId, tokenHash, expiresAt, revokedAt), OtpChallenge (mobile, codeHash, expiresAt, attempts, usedAt), Message (outbox: to, channel, body, status, orderId), AccessLog (actor type and id, action, orderId, at), CallbackTask (orderId, reason, status, doneBy), ImportBatch (fileName, rowCount, errorCount, by).

## Design system: "Clara glass"

Pragati wants blue-green and glassy. Keep it calm and readable, not flashy.

- Background: soft blue-green gradient (pale aqua to pale blue), fixed, no images.
- Glass surfaces: translucent white cards with backdrop blur and a 1px light border, used for the main card on each screen, the header and the language switch. Text always sits on a surface that passes WCAG AA contrast.
- Fallbacks: if `backdrop-filter` is unsupported, or the user prefers reduced transparency, cards become solid white. Low-end phones must stay fast: blur only on a few elements, never on long lists or tables.
- Ink: deep blue-green near-black for text. One accent: deep teal for primary actions. Status colours only for result flags (amber for low/high, red for critical), always with icon + word.
- Type: patient screens base 18px, results and buttons larger; staff screens 15–16px. Telugu line height generous.
- One clear primary action per patient screen. Large tap targets (48px+).
- Every list and page has designed loading, empty and error states.
- Responsive: patient side is phone-first; staff console works on phone and desktop.

## Code conventions

- `src/app` routes; `src/lib` pure logic (flags, ranges, tokens, otp, csv, ai) with tests next to them; `src/server` data access; `src/components`.
- Pure functions for anything testable. No business logic inside React components.
- Readable names, small files, comments only where the "why" isn't obvious.
- Tests for: range parsing and flags, critical detection, token creation/expiry/revocation, OTP expiry/attempts/single use/rate limit, access control, CSV validation and idempotent import, AI output validation and fallback.

## Docs to keep updated as we go

- `docs/ASSUMPTIONS.md`: every assumption, labelled.
- `docs/DECISIONS.md`: one paragraph per decision (what, options, why).
- `docs/CUTS.md`: what we cut and what we would do next.
These feed the TDD at the end.
