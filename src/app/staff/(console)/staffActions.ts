"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { markCallbackDone, resendLink, revealCallbackNumber, type ResendResult } from "@/server/staffActions";
import { requireStaff } from "@/server/staffSession";

const Id = z.string().min(1).max(40);

export async function resendLinkAction(orderId: string): Promise<ResendResult> {
  const staff = await requireStaff();
  const id = Id.safeParse(orderId);
  if (!id.success) return { ok: false, reason: "NOT_FOUND" };
  const result = await resendLink(id.data, staff.id);
  revalidatePath(`/staff/orders/${id.data}`);
  return result;
}

export async function markCalledAction(taskId: string, note: string): Promise<{ ok: boolean }> {
  const staff = await requireStaff();
  const input = z.object({ taskId: Id, note: z.string().trim().max(1000) }).safeParse({ taskId, note });
  if (!input.success) return { ok: false };
  const ok = await markCallbackDone(input.data.taskId, staff.id, input.data.note || null);
  revalidatePath("/staff/callbacks");
  revalidatePath("/staff", "layout"); // the count in the header
  return { ok };
}

export async function revealNumberAction(taskId: string): Promise<{ mobile: string | null }> {
  const staff = await requireStaff();
  const id = Id.safeParse(taskId);
  return { mobile: id.success ? await revealCallbackNumber(id.data, staff.id) : null };
}
