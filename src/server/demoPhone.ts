import { createHash } from "node:crypto";
import { maskMobile } from "@/lib/mobile";
import { db } from "./db";

/** An opaque key for a number, so the demo URL never contains a phone number. */
export function phoneKey(mobile: string): string {
  return createHash("sha256").update(`demo-phone:${mobile}`).digest("hex").slice(0, 12);
}

export async function demoNumbers() {
  const patients = await db.patient.findMany({ select: { mobile: true, name: true }, orderBy: { mobile: "asc" } });
  const byMobile = new Map<string, string[]>();
  for (const p of patients) byMobile.set(p.mobile, [...(byMobile.get(p.mobile) ?? []), p.name]);
  return [...byMobile.entries()].map(([mobile, names]) => ({ key: phoneKey(mobile), mobile, masked: maskMobile(mobile), names }));
}

export async function demoMessages(mobile: string) {
  const latest = await db.message.findMany({
    where: { to: mobile },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, channel: true, kind: true, body: true, createdAt: true },
  });
  return latest.reverse(); // oldest first, like a chat
}
