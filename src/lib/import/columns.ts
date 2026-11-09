/** The agreed LIS export columns (see docs/ASSUMPTIONS.md). Kept apart from the
 * CSV reader so screens can show them without loading the parser. */
export const CSV_COLUMNS = [
  "order_id",
  "patient_name",
  "mobile",
  "parameter",
  "unit",
  "result",
  "reference_range",
  "status",
  "referring_doctor",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];
