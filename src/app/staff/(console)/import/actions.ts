"use server";

import { after } from "next/server";
import { z } from "zod";
import type { PreviewRow, RowOutcome } from "@/lib/import/preview";
import { commitImport, previewImport, type CommitSummary } from "@/server/import";
import { requireStaff } from "@/server/staffSession";
import { prepareEnglishSummaries } from "@/server/summaries";

const MAX_FILE_BYTES = 1_000_000; // ~10,000 rows; a day's export is far smaller

export type PreviewData = {
  rows: PreviewRow[];
  counts: Record<RowOutcome, number>;
  ordersToSave: number;
  linksToSend: number;
  criticalOrders: number;
  fingerprint: string;
};

export type PreviewActionResult = { ok: true; data: PreviewData } | { ok: false; error: string };
export type CommitActionResult =
  | { ok: true; summary: CommitSummary }
  | { ok: false; error: string; stale?: boolean };

async function readUpload(formData: FormData): Promise<{ ok: true; text: string; name: string } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file to import." };
  if (!file.name.toLowerCase().endsWith(".csv")) return { ok: false, error: "The file must be a .csv export from the LIS." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "The file is larger than 1 MB. Split it and import each part." };
  return { ok: true, text: await file.text(), name: file.name.slice(0, 200) };
}

// Errors are logged by name only: messages from the database can contain patient data.
function logFailure(where: string, error: unknown) {
  console.error(`${where} failed:`, error instanceof Error ? error.name : "unknown error");
}

export async function previewImportAction(formData: FormData): Promise<PreviewActionResult> {
  await requireStaff();
  try {
    const upload = await readUpload(formData);
    if (!upload.ok) return upload;

    const result = await previewImport(upload.text);
    if (!result.ok) return result;

    const { preview, fingerprint } = result;
    return {
      ok: true,
      data: {
        rows: preview.rows,
        counts: preview.counts,
        ordersToSave: preview.plans.length,
        linksToSend: preview.plans.filter((p) => p.signs).length,
        criticalOrders: preview.plans.filter((p) => p.critical && (p.signs || p.kind === "MARK_CRITICAL")).length,
        fingerprint,
      },
    };
  } catch (error) {
    logFailure("Import preview", error);
    return { ok: false, error: "We couldn't check this file right now. Please try again." };
  }
}

const Fingerprint = z.string().regex(/^[0-9a-f]{64}$/);

export async function commitImportAction(formData: FormData): Promise<CommitActionResult> {
  const staff = await requireStaff();
  try {
    const fingerprint = Fingerprint.safeParse(formData.get("fingerprint"));
    if (!fingerprint.success) return { ok: false, error: "Please preview the file again before confirming." };

    const upload = await readUpload(formData);
    if (!upload.ok) return upload;

    const result = await commitImport(upload.text, upload.name, staff.id, fingerprint.data);
    if (result.ok && result.summary.signedOrderIds.length > 0) {
      // English explanations at sign-off, after the response is sent: AI calls
      // never slow down the import. Failures only mean they're made on first view.
      const ids = result.summary.signedOrderIds;
      after(() => prepareEnglishSummaries(ids).catch((e) => logFailure("Preparing summaries", e)));
    }
    return result;
  } catch (error) {
    logFailure("Import commit", error);
    return {
      ok: false,
      error: "The import stopped part-way. Orders already saved are complete; please preview the file again to see what is left.",
    };
  }
}
