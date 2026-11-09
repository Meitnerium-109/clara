import type { AccessAction, ActorType } from "@prisma/client";
import { db } from "./db";

type Entry = {
  actorType: ActorType;
  action: AccessAction;
  orderId?: string | null;
  patientId?: string | null;
  staffUserId?: string | null;
};

/**
 * Records who did what to which report (DPDP access log). Awaited on purpose:
 * if the log can't be written, the view fails rather than going unrecorded.
 * IDs only, never names or numbers.
 */
export async function logAccess(entry: Entry): Promise<void> {
  await db.accessLog.create({ data: entry });
}
