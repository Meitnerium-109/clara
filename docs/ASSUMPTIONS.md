# Assumptions

Everything here is something the brief does not state and we had to decide. Each line says why.

## Data from the LIS

- **The LIS CSV export includes a mobile column.** The sample table has none, but sending a link automatically is impossible without one.
- **A patient is identified by mobile + name.** The brief shows no patient ID, and one mobile often covers a whole family.
- **The LIS spells a patient's name the same way on every order.** Names are only trimmed and have repeated spaces collapsed before matching, so a different spelling would create a second patient.
- **Mobiles are Indian numbers and are stored in E.164 (`+91XXXXXXXXXX`).** All centres are in Andhra Pradesh. One normalising function turns `98765 43210`, `09876543210` and `+91 98765 43210` into the same value.
- **The CSV status column holds only `Processing`, `Ready` or `Ready (critical)`.** These are the values in the sample. Anything else is a row error in the import preview.
- **One CSV row is one result (one parameter of one order).** This matches the sample table.

## Results and safety

- **An order is critical if the LIS marks it `Ready (critical)` or any result crosses our critical limits.** We would rather raise one callback too many than miss one.
- **Critical limits (e.g. potassium > 6.0 or < 2.8 mmol/L) are our assumption, not clinical guidance.** The brief asks for critical handling but gives no table, so a lab's pathologist would need to confirm the values.
- **Telugu and Hindi summary templates were AI-translated and need review by a native speaker.** We have no native reviewer available for the take-home.

## Consent

- **Consent is given once per mobile number, not once per patient.** The person holding the phone is the one who ticks the box, often for the whole family.
- **Consent is tied to a wording version, and new wording means asking again.** Under the DPDP Act, consent is only valid for the text the person actually saw.
