/**
 * Mock message provider. In production this would hand each queued message to
 * a WhatsApp/SMS gateway and record its receipts. Here it "accepts" everything
 * at once, and the demo phone marks messages delivered when it shows them, so
 * staff see a real queued → sent → delivered → opened ladder.
 */

import type { PrismaClient } from "@prisma/client";
import { db } from "./db";

export async function dispatchQueued(client: PrismaClient = db): Promise<number> {
  const { count } = await client.message.updateMany({ where: { status: "QUEUED" }, data: { status: "SENT" } });
  return count;
}

export async function markDelivered(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  await db.message.updateMany({ where: { id: { in: messageIds }, status: "SENT" }, data: { status: "DELIVERED" } });
}
