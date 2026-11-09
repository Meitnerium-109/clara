# Assumptions

Everything here is something the brief does not state and we had to decide. Each line says why.

## Data from the LIS

- **The LIS CSV format** (agreed, example in `samples/lis-export.csv`):
  - One row per result. Header row required; columns may be in any order and in any case, and extra columns are ignored.
  - Columns: `order_id, patient_name, mobile, parameter, unit, result, reference_range, status, referring_doctor`.
  - Separate parameter and unit columns avoid guessing where a name ends and a unit begins ("Vitamin D 25-OH ng/mL").
  - UTF-8, comma-separated, standard quoting (`"1,50,000"`). An Excel byte-order mark and Windows line endings are accepted.
  - Required: `order_id` (letters, digits, dashes), `patient_name`, `mobile`, `parameter`, `result`, `status`, `referring_doctor`. `unit` and `reference_range` may be empty (the flag is then UNKNOWN).
  - Every row of one order must agree on patient, mobile, status and doctor.
  - Limits: 1 MB and 5,000 rows per file.
- **The LIS CSV export includes a mobile column.** The sample table has none, but sending a link automatically is impossible without one.
- **A patient is identified by mobile + name.** The brief shows no patient ID, and one mobile often covers a whole family.
- **The LIS spells a patient's name the same way on every order.** Names are only trimmed and have repeated spaces collapsed before matching, so a different spelling would create a second patient.
- **Mobiles are Indian numbers and are stored in E.164 (`+91XXXXXXXXXX`).** All centres are in Andhra Pradesh. One normalising function turns `98765 43210`, `09876543210` and `+91 98765 43210` into the same value.
- **Only Indian mobiles are accepted. Landlines and foreign numbers are row errors.** Links and OTPs travel by WhatsApp/SMS, which a landline cannot receive. Staff must fix such rows in the LIS.
- **The CSV status column holds only `Processing`, `Ready` or `Ready (critical)`.** These are the values in the sample. Anything else is a row error in the import preview.
- **One CSV row is one result (one parameter of one order).** This matches the sample table.

## Results and safety

- **An order is critical if the LIS marks it `Ready (critical)` or any result crosses our critical limits.** We would rather raise one callback too many than miss one.
- **Critical limits are our assumption, not clinical guidance.** The brief asks for critical handling but gives no table, so Company A's pathologist must confirm these common textbook values (in `src/lib/criticalLimits.ts`):

  | Test | Unit | Critical if |
  |---|---|---|
  | Potassium | mmol/L | < 2.8 or > 6.0 |
  | Sodium | mmol/L | < 120 or > 160 |
  | Haemoglobin | g/dL | < 7 |
  | Glucose (fasting, random, FBS, RBS) | mg/dL | < 50 or > 400 |
  | Calcium | mg/dL | < 6.0 or > 13.0 |

- **A critical limit applies only when the unit matches exactly.** A glucose result in mmol/L is never compared with mg/dL limits, so an unexpected unit can't raise a false alarm (or hide one by being misread).
- **"12.0-15.5" includes both ends; "<200" and ">40" exclude the boundary.** This is how labs usually mean them: 15.5 is normal, but a cholesterol of exactly 200 is not below 200.
- **Numbers may use Indian (1,50,000) or Western (150,000) grouping.** Platelet counts are commonly written this way in India. A European decimal comma ("10,2") is rejected, not misread as 102.
- **Non-numeric results ("Negative", "Nil", "<0.01") are flagged UNKNOWN.** Comparing words is a judgement we don't make by rule. The patient still sees the lab's own value and range.
- **Telugu and Hindi summary templates were AI-translated and need review by a native speaker.** We have no native reviewer available for the take-home.

## Consent

- **Consent is given once per mobile number, not once per patient.** The person holding the phone is the one who ticks the box, often for the whole family.
- **Consent is tied to a wording version, and new wording means asking again.** Under the DPDP Act, consent is only valid for the text the person actually saw.

## Demo data

- **Everyone in the seed data is fictional, and mobiles use the placeholder range 90000 000xx.** The brief forbids real personal data, and no message is really sent because the outbox is mocked.
- **The seed stores parameter and unit separately** (the sample shows them together, e.g. "Haemoglobin g/dL"). This matches the CSV format we chose, which has separate columns.

## Import and delivery

- **An order is imported all-or-nothing.** If any row of an order is rejected, none of its rows are saved, so a report is never signed with a result missing.
- **Import never deletes.** A result stored earlier but missing from a later file is kept; the LIS export may cover only part of an order.
- **Every change to a signed report's values, results or doctor is rejected.** Amended reports are a cut. The one exception is a later "Ready (critical)" marking with unchanged values, which creates a callback task (see DECISIONS.md).
- **An existing order can't move to a different patient or mobile by import.** That is how wrong-number deliveries happen; staff must fix it in the LIS.
- **The report-ready message has no name or test details.** If the number is wrong, the stranger learns nothing, and opening the link still needs an OTP sent to that phone.
- **Report links go by WhatsApp first.** The channel is stored per message, so SMS can be added.
- **The message's Telugu line was AI-translated** and needs a native reviewer.

## Patient access

- **Patient screens are in English, Telugu and Hindi; the Telugu and Hindi text (including the consent wording) was AI-translated and must be checked by native speakers.** The brief asks for a report page that reads well in Telugu, and the DPDP Act expects consent notices in a language the person understands.
- **The consent wording is version `2026-11-v1`.** Changing the text means bumping the version, so everyone is asked again.
- **Sign-in codes go by SMS, report links by WhatsApp.** SMS is the usual channel for codes and works on any phone. Both are mocked in the outbox.
- **A patient session lasts 30 minutes without activity.** Each page view extends it; there is no absolute maximum yet (see CUTS.md).
- **The downloadable PDF is English only.** It stands in for the LIS's signed PDF, which is in English today.
- **The demo phone is open to anyone when DEMO_MODE is on.** That is the point for reviewers; DEMO_MODE must be off in any real deployment.

## Explanations (the AI part)

- **Only out-of-range results (Low or High) get an explanation.** The brief asks for a "summary of out-of-range values". Normal results need none, results we can't compare get none, and critical orders get none at all (the lab calls instead).
- **The 8 locked templates and their Telugu/Hindi text were written and AI-translated by us, and need review by a clinician and native speakers.** They say only what the test measures and which side of the range the value is.
- **What is sent to Gemini is not personal data.** Only test name, value, unit, range, direction and language: no name, number, ID, doctor or date. Google's servers are outside India, so this is how the AI step fits "hosting in India": nothing that identifies a person leaves our Mumbai database.
- **The banned-phrase list is a safety net, not a guarantee.** It catches the obvious diagnosis and medicine words in three languages; locked templates for the common tests are the main protection.

## Front desk

- **Front-desk staff may see results and the full mobile number.** They answer patient calls today and phone critical results. Full numbers appear only when a staff member clicks "Show number to call", and each reveal is logged.
- **Message delivery is mocked.** A queued message is immediately "sent" by a mock provider, and "delivered" once the demo phone shows it. A real gateway would report these itself.

## Staff access

- **A staff session lasts 8 hours (one shift), then staff sign in again.** The brief only says staff sessions are separate from patient ones.
- **Front-desk staff are created by the seed or an administrator; there is no self-registration or password reset.** Both are out of scope for the take-home (see CUTS.md).

## Wording

- **The landing page's Telugu and Hindi taglines were AI-translated and need a native reviewer**, like the summary templates.
- **A result we can't compare (flag UNKNOWN) is labelled "Ask doctor", never "Normal".** Showing nothing could read as "fine".
