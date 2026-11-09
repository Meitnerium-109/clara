"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sendOtp, verifyOtp } from "@/server/otp";
import { startPatientSession } from "@/server/patientSession";
import { openLink } from "@/server/reportLinks";
import type { FlowResult } from "../../flow";

const Input = z.object({ token: z.string().max(100), code: z.string().max(10).optional() });

// The browser sends only the token. Which mobile gets the code always comes
// from the database, never from the request.
export async function sendLinkCode(token: string): Promise<FlowResult> {
  const input = Input.safeParse({ token });
  if (!input.success) return { ok: false, reason: "LINK_INVALID" };
  const link = await openLink(input.data.token);
  if (link.state !== "VALID") return { ok: false, reason: "LINK_INVALID" };

  const sent = await sendOtp(link.mobile, { orderId: link.orderId, patientId: link.patientId });
  return sent.ok ? { ok: true } : { ok: false, reason: "RATE_LIMITED", minutes: sent.retryInMinutes };
}

export async function verifyLinkCode(token: string, code: string): Promise<FlowResult> {
  const input = Input.safeParse({ token, code });
  if (!input.success) return { ok: false, reason: "FORMAT" };
  const link = await openLink(input.data.token);
  if (link.state !== "VALID") return { ok: false, reason: "LINK_INVALID" };

  const result = await verifyOtp(link.mobile, input.data.code ?? "", { orderId: link.orderId, patientId: link.patientId });
  if (!result.ok) return result;

  await startPatientSession(link.mobile);
  redirect(`/my/orders/${link.orderId}`);
}
