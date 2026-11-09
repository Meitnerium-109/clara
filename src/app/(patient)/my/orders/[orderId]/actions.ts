"use server";

import { z } from "zod";
import { requirePatientMobile } from "@/server/patientSession";
import { flagSummary } from "@/server/summaries";

const Input = z.object({ summaryId: z.string().min(1).max(40), note: z.string().trim().max(500) });

export async function flagExplanation(summaryId: string, note: string): Promise<{ ok: boolean }> {
  const mobile = await requirePatientMobile();
  const input = Input.safeParse({ summaryId, note });
  if (!input.success) return { ok: false };
  return { ok: await flagSummary(mobile, input.data.summaryId, input.data.note || null) };
}
