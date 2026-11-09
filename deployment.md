# Clara: deployment and demo guide

**GitHub:** https://github.com/Meitnerium-109/clara
**Live app:** (added in the final submission)

## 1. Run locally

**Needs:** Node.js 22 (developed on 22.23.4) and a Postgres database. We use Supabase in the Mumbai region.

1. **Install dependencies**
   ```bash
   git clone https://github.com/Meitnerium-109/clara.git
   cd clara
   npm install
   ```
2. **Create `.env`** from the template and fill in the values (see section 3):
   ```bash
   cp .env.example .env
   ```
   For a session secret, `openssl rand -base64 48` gives a suitable random value. Set `DEMO_MODE=true` and `APP_URL=http://localhost:3000` to use the demo phone locally.
3. **Create the tables**
   ```bash
   npx prisma migrate deploy      # or `npx prisma migrate dev` while developing
   ```
4. **Load the demo data:** the staff user from `SEED_STAFF_EMAIL` / `SEED_STAFF_PASSWORD`, 14 fictional patients and 14 orders. Signed orders get their report links through the real sign-off code.
   ```bash
   npm run db:seed
   ```
   It is safe to run again: it only creates what's missing and never sends a second link. Report links in the messages use the `APP_URL` set at the time you seed.
5. **Start the app**
   ```bash
   npm run dev                    # http://localhost:3000
   ```
6. **Run the tests**
   ```bash
   npm test                       # 439 unit tests, no database needed
   npm run test:db                # database tests against the database in .env
   ```
   `test:db` writes to the configured database. It uses `TEST-` order IDs and placeholder numbers and deletes everything it creates.

A sample LIS export for the import screen is in `samples/lis-export.csv`.

## 2. How it is deployed

The planned setup, to be confirmed with the live link in the final submission:

- **App:** Vercel, with serverless functions pinned to the Mumbai region (`bom1`), close to the database and to patients.
- **Database:** Supabase Postgres in Mumbai (ap-south-1), used only as a database. The app connects through the pooled URL; migrations use the direct URL.
- **Build:** the Prisma client must be generated during the build, e.g. build command `prisma generate && next build`.
- **Environment variables:** set in the Vercel project, never committed. Set `APP_URL` to the public address so links in messages point to it.
- **Migrations:** run once against the production database (`npx prisma migrate deploy`), then seed for the demo.

## 3. Environment variables

Names and purpose only. `.env.example` lists them; values are never committed.

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection used by the app at runtime. |
| `DIRECT_URL` | Direct Postgres connection used by migrations. |
| `SESSION_SECRET` | Signs staff and patient session cookies, and keys the one-time-code hashes. At least 32 random characters. |
| `GEMINI_API_KEY` | Google Gemini key for plain-language explanations. Without it, explanations fall back to the safe text. |
| `GEMINI_MODEL` | Optional. Overrides the Gemini model (default `gemini-3.5-flash`). |
| `APP_URL` | Public base URL used in report links, e.g. `http://localhost:3000`. |
| `DEMO_MODE` | `true` turns on the demo phone and stores message text in the outbox. Leave unset in a real deployment. |
| `SEED_STAFF_EMAIL` | Email of the demo front-desk user created by the seed. |
| `SEED_STAFF_PASSWORD` | Password of that user (12+ characters). |

## 4. Demo login (front desk)

- **URL:** `/staff/login`
- **Email:** frontdesk@clara.demo
- **Password:** ClaraDemo2026Desk

From there: Orders (search, delivery status), Callbacks, Flagged, Import.

## 5. Using the demo phone

Clara doesn't send real WhatsApp or SMS messages; it writes them to an outbox. The **demo phone** (`/demo/phone`, only when `DEMO_MODE=true`, also linked from the landing page) shows what each patient's phone would receive.

**Open a report from a link**
1. Open `/demo/phone` and choose a number.
2. Click the link in the WhatsApp "report ready" message. It opens in a new tab.
3. Click **Send code**. The code arrives on the demo phone within a few seconds as an SMS; the page refreshes by itself.
4. Type the code and continue. The first time on each number, you'll see the consent screen.

**Sign in with a number:** on the landing page, choose **See my reports**, enter one of the numbers below, and take the code from the demo phone.

**Numbers to try (all fictional):**

| Mobile | Who | What you'll see |
|---|---|---|
| 90000 00001 | Lakshmi Prasanna K | A normal Ready report with one low result (haemoglobin) and its locked-template explanation. |
| 90000 00010 | Suryanarayana Rao P, Padmavathi P, Sai Kiran P | The family number: "Whose reports?" with three names. One order is still "Being tested". |
| 90000 00003 | Farzana Begum | A critical report: "Please expect a call from the lab", no explanations. It appears on the staff Callbacks list. |
| 90000 00006 | Srinivas Reddy B | Cholesterol results with both a template (LDL) and AI explanations (total cholesterol, HDL). |

**Good to know**
- Codes expire after 5 minutes.
- Five wrong codes lock that code.
- Each number can receive at most 3 codes per 15 minutes.
- Switch the language with EN / తెలుగు / हिंदी at the top of any patient screen.
