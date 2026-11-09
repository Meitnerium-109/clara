/**
 * Read-only queries for the front-desk console. Callers must have checked the
 * staff session (requireStaff) first. Full mobiles never leave this file:
 * every result carries only the masked number, because anything returned may
 * end up serialised into the page. The one way to get a full number is
 * revealCallbackNumber, which logs it.
 */

import type { Prisma } from "@prisma/client";
import { deliveryStage } from "@/lib/deliveryStatus";
import { maskMobile } from "@/lib/mobile";
import { db } from "./db";

const listSelect = {
  id: true,
  lisOrderId: true,
  status: true,
  critical: true,
  signedAt: true,
  updatedAt: true,
  patient: { select: { name: true, mobile: true } },
  messages: {
    where: { kind: "REPORT_LINK" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { status: true, createdAt: true },
  },
  accessLogs: { where: { action: "REPORT_VIEWED" }, orderBy: { at: "desc" }, take: 1, select: { at: true } },
} satisfies Prisma.OrderSelect;

type ListRow = Prisma.OrderGetPayload<{ select: typeof listSelect }>;

function toListItem(o: ListRow) {
  return {
    id: o.id,
    lisOrderId: o.lisOrderId,
    patientName: o.patient.name,
    mobile: maskMobile(o.patient.mobile),
    status: o.status,
    critical: o.critical,
    signedAt: o.signedAt,
    delivery: deliveryStage({ orderStatus: o.status, latestMessage: o.messages[0] ?? null, latestViewAt: o.accessLogs[0]?.at ?? null }),
  };
}

export type OrderListItem = ReturnType<typeof toListItem>;

/** Name, mobile (4+ digits, any format) or order ID. Empty query → most recent orders. */
export async function searchOrders(query: string): Promise<OrderListItem[]> {
  const q = query.trim();
  const digits = q.replace(/\D/g, "").slice(-10); // "+91 98765 43210" and "09876543210" both end in the same 10
  const or: Prisma.OrderWhereInput[] = [
    { lisOrderId: { contains: q, mode: "insensitive" } },
    { patient: { name: { contains: q, mode: "insensitive" } } },
  ];
  if (digits.length >= 4) or.push({ patient: { mobile: { contains: digits } } });

  const orders = await db.order.findMany({
    where: q ? { OR: or } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: listSelect,
  });
  return orders.map(toListItem);
}

export async function orderDetail(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      ...listSelect,
      referringDoctor: true,
      createdAt: true,
      results: { orderBy: { createdAt: "asc" }, select: { id: true, parameter: true, valueText: true, unit: true, refText: true, flag: true } },
      links: {
        orderBy: { createdAt: "desc" },
        select: { id: true, reason: true, createdAt: true, expiresAt: true, revokedAt: true, createdBy: { select: { name: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, channel: true, status: true, createdAt: true },
      },
      accessLogs: {
        orderBy: { at: "desc" },
        take: 100,
        select: { id: true, at: true, actorType: true, action: true, staffUser: { select: { name: true } } },
      },
      callbackTask: { select: { id: true, reason: true, status: true, note: true, doneAt: true, createdAt: true, doneBy: { select: { name: true } } } },
    },
  });
  if (!order) return null;

  const latestLinkMessage = order.messages.find((m) => m.kind === "REPORT_LINK") ?? null;
  const latestView = order.accessLogs.find((l) => l.action === "REPORT_VIEWED")?.at ?? null;
  // Drop the raw number here: anything returned may be serialised to the browser.
  const { patient, ...rest } = order;
  return {
    ...rest,
    mobile: maskMobile(patient.mobile),
    patientName: patient.name,
    delivery: deliveryStage({ orderStatus: order.status, latestMessage: latestLinkMessage, latestViewAt: latestView }),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof orderDetail>>>;

export async function callbackTasks() {
  const select = {
    id: true,
    reason: true,
    status: true,
    note: true,
    createdAt: true,
    doneAt: true,
    doneBy: { select: { name: true } },
    order: { select: { id: true, lisOrderId: true, patient: { select: { name: true, mobile: true } } } },
  } satisfies Prisma.CallbackTaskSelect;
  const [open, done] = await Promise.all([
    db.callbackTask.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, select }), // longest waiting first
    db.callbackTask.findMany({ where: { status: "DONE" }, orderBy: { doneAt: "desc" }, take: 20, select }),
  ]);
  // Only the masked number leaves this function; the full one needs revealCallbackNumber (logged).
  const mask = ({ order: { patient, ...order }, ...task }: (typeof open)[number]) => ({
    ...task,
    order: { ...order, patient: { name: patient.name } },
    mobile: maskMobile(patient.mobile),
  });
  return { open: open.map(mask), done: done.map(mask) };
}

export async function flaggedSummaries() {
  return db.summary.findMany({
    where: { flaggedAt: { not: null } },
    orderBy: { flaggedAt: "desc" },
    take: 100,
    select: {
      id: true,
      text: true,
      source: true,
      language: true,
      flaggedAt: true,
      flagNote: true,
      result: { select: { parameter: true, valueText: true, unit: true, order: { select: { id: true, lisOrderId: true } } } },
    },
  });
}

export async function consoleCounts() {
  const [openCallbacks, flagged] = await Promise.all([
    db.callbackTask.count({ where: { status: "OPEN" } }),
    db.summary.count({ where: { flaggedAt: { not: null } } }),
  ]);
  return { openCallbacks, flagged };
}
