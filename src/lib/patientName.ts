/**
 * Patients are matched on mobile + name, so the name must be compared in one
 * consistent form: trimmed, with repeated spaces collapsed. Case is kept as
 * the LIS wrote it (see docs/ASSUMPTIONS.md).
 */
export function normalisePatientName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}
