"use server";

import { z } from "zod";
import { searchOrders, type OrderListItem } from "@/server/staffData";
import { requireStaff } from "@/server/staffSession";

// A server action, not ?q= in the URL: a patient's name or number in a URL
// would end up in browser history and server logs.
export async function searchOrdersAction(query: string): Promise<{ ok: true; orders: OrderListItem[] } | { ok: false }> {
  await requireStaff();
  const q = z.string().max(100).safeParse(query);
  if (!q.success) return { ok: false };
  try {
    return { ok: true, orders: await searchOrders(q.data) };
  } catch {
    return { ok: false };
  }
}
