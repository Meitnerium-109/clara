# Assumptions

Everything here is something the brief does not state and we had to decide. Each line says why.

## Data from the LIS

- **The LIS CSV has these columns:** `order_id, patient_name, mobile, parameter, unit, result, reference_range, status, referring_doctor`. Separate parameter and unit columns avoid guessing where a name ends and a unit begins ("Vitamin D 25-OH ng/mL").
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

## Staff access

- **A staff session lasts 8 hours (one shift), then staff sign in again.** The brief only says staff sessions are separate from patient ones.
- **Front-desk staff are created by the seed or an administrator; there is no self-registration or password reset.** Both are out of scope for the take-home (see CUTS.md).

## Wording

- **The landing page's Telugu and Hindi taglines were AI-translated and need a native reviewer**, like the summary templates.
- **A result we can't compare (flag UNKNOWN) is labelled "Ask doctor", never "Normal".** Showing nothing could read as "fine".
