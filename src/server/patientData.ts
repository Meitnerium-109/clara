/**
 * Every read of patient data goes through here, and every query is filtered
 * by the signed-in mobile inside the WHERE clause. An order or patient ID from
 * the URL is only a "which one"; the database refuses to return it unless it
 * belongs to this mobile. Callers can't forget the check, because there's no
 * function here that skips it.
 */

import { db } from "./db";

export function patientsForMobile(mobile: string) {
  return db.patient.findMany({ where: { mobile }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export function patientForMobile(mobile: string, patientId: string) {
  return db.patient.findFirst({ where: { id: patientId, mobile }, select: { id: true, name: true } });
}

export function ordersForPatient(mobile: string, patientId: string) {
  return db.order.findMany({
    where: { patientId, patient: { mobile } },
    orderBy: { createdAt: "desc" },
    select: { id: true, lisOrderId: true, status: true, signedAt: true, createdAt: true },
  });
}

/**
 * The report for one order, or null if it isn't this mobile's. Results of an
 * unsigned order are never loaded: Processing values aren't final.
 */
export async function reportForMobile(mobile: string, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, patient: { mobile } },
    select: {
      id: true,
      lisOrderId: true,
      status: true,
      critical: true,
      signedAt: true,
      referringDoctor: true,
      patient: { select: { id: true, name: true } },
    },
  });
  if (!order) return null;
  if (order.status !== "READY") return { ...order, ready: false as const };

  const results = await db.result.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, parameter: true, unit: true, valueText: true, refText: true, flag: true },
  });
  return { ...order, ready: true as const, results };
}

/** Used before sending a sign-in code; the answer is never shown to the person typing. */
export async function mobileHasPatients(mobile: string): Promise<boolean> {
  return (await db.patient.count({ where: { mobile } })) > 0;
}
