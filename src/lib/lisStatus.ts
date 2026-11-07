/**
 * Turns the LIS status text into our two separate facts: is the report signed,
 * and did the LIS mark it critical. Unknown text → null (a row error on import).
 */

export type LisStatus = {
  status: "PROCESSING" | "READY";
  lisCritical: boolean;
};

const STATUSES: Record<string, LisStatus> = {
  processing: { status: "PROCESSING", lisCritical: false },
  ready: { status: "READY", lisCritical: false },
  "ready (critical)": { status: "READY", lisCritical: true },
};

export function parseLisStatus(text: string): LisStatus | null {
  const key = text.trim().toLowerCase().replace(/\s+/g, " ").replace(/\(\s*/, "(").replace(/\s*\)/, ")");
  return STATUSES[key] ?? null;
}
