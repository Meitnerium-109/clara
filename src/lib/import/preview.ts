/**
 * Decides what an import would do, without touching the database: each row is
 * NEW, UPDATED, UNCHANGED or REJECTED (with a reason), and each order that
 * changes gets a plan for the commit step.
 *
 * Rules, in order:
 *  1. Every row passes Zod and our own checks (mobile, status, flags).
 *  2. An order is all-or-nothing: one bad row rejects all its rows, so a
 *     report is never signed with a result missing.
 *  3. A signed order can't change, gain results or go back to Processing.
 *     One exception, for safety: an unchanged signed order re-sent as
 *     "Ready (critical)" is marked critical and gets a callback task.
 *  4. An existing order can't move to a different patient or mobile.
 *  5. Nothing is ever deleted: results missing from the file are kept.
 */

import { z } from "zod";
import { assessResult, isOrderCritical, type AssessedResult, type ResultFlag } from "../flags";
import { parseLisStatus } from "../lisStatus";
import { callbackReason } from "../messages";
import { maskMobile, normaliseMobile } from "../mobile";
import { normalisePatientName } from "../patientName";
import type { RawRow } from "./csv";

// ---------- Types ----------

export type ExistingOrder = {
  lisOrderId: string;
  status: "PROCESSING" | "READY";
  critical: boolean;
  referringDoctor: string;
  patient: { name: string; mobile: string };
  results: Array<{ parameter: string; unit: string; valueText: string; refText: string; flag: ResultFlag }>;
};

export type RowOutcome = "NEW" | "UPDATED" | "UNCHANGED" | "REJECTED";

export type PreviewRow = {
  line: number;
  orderId: string;
  patientName: string;
  mobileDisplay: string; // masked when valid; as typed when invalid, so staff can fix it
  parameter: string;
  valueText: string;
  unit: string;
  refText: string;
  flag: ResultFlag | null;
  outcome: RowOutcome;
  note: string | null; // why it was rejected, or what changed
};

export type ResultPlan = AssessedResult & {
  parameter: string;
  unit: string;
  valueText: string;
  refText: string;
};

export type OrderPlan = {
  /** SAVE: create or update the order. MARK_CRITICAL: a signed order only gains a callback task. */
  kind: "SAVE" | "MARK_CRITICAL";
  lisOrderId: string;
  patientName: string;
  mobile: string; // E.164
  referringDoctor: string;
  status: "PROCESSING" | "READY";
  critical: boolean;
  /** True when this import signs the order: the moment a link is sent. */
  signs: boolean;
  callbackReason: string;
  results: ResultPlan[];
};

export type ImportPreview = {
  rows: PreviewRow[];
  plans: OrderPlan[];
  counts: Record<RowOutcome, number>;
};

// ---------- Row validation ----------

const RowSchema = z.object({
  order_id: z
    .string()
    .trim()
    .min(1, "order_id is missing")
    .max(40, "order_id is too long")
    .regex(/^[A-Za-z0-9-]+$/, "order_id can only contain letters, digits and dashes"),
  patient_name: z.string().trim().min(1, "patient_name is missing").max(120, "patient_name is too long"),
  mobile: z.string().trim().min(1, "mobile is missing"),
  parameter: z.string().trim().min(1, "parameter is missing").max(80, "parameter is too long"),
  unit: z.string().trim().max(30, "unit is too long"),
  result: z.string().trim().min(1, "result is missing").max(40, "result is too long"),
  reference_range: z.string().trim().max(60, "reference_range is too long"),
  status: z.string().trim().min(1, "status is missing"),
  referring_doctor: z
    .string()
    .trim()
    .min(1, "referring_doctor is missing")
    .max(120, "referring_doctor is too long"),
});

type ValidRow = {
  line: number;
  orderId: string;
  patientName: string;
  mobile: string;
  doctor: string;
  status: "PROCESSING" | "READY";
  lisCritical: boolean;
  result: ResultPlan;
};

type CheckedRow = { raw: RawRow; valid: ValidRow; error: null } | { raw: RawRow; valid: null; error: string };

function checkRow(raw: RawRow): CheckedRow {
  const parsed = RowSchema.safeParse(raw.values);
  if (!parsed.success) return { raw, valid: null, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const mobile = normaliseMobile(v.mobile);
  if (!mobile.ok) return { raw, valid: null, error: `mobile: ${mobile.reason}` };

  const lis = parseLisStatus(v.status);
  if (!lis) {
    return { raw, valid: null, error: `status "${v.status}" is not Processing, Ready or Ready (critical)` };
  }

  const input = { parameter: v.parameter, unit: v.unit, valueText: v.result, refText: v.reference_range };
  return {
    raw,
    error: null,
    valid: {
      line: raw.line,
      orderId: v.order_id,
      patientName: normalisePatientName(v.patient_name),
      mobile: mobile.e164,
      doctor: v.referring_doctor,
      status: lis.status,
      lisCritical: lis.lisCritical,
      result: { ...input, ...assessResult(input) },
    },
  };
}

// ---------- Preview rows ----------

function displayMobile(raw: string): string {
  const mobile = normaliseMobile(raw);
  return mobile.ok ? maskMobile(mobile.e164) : raw.trim();
}

function previewRow(row: CheckedRow, outcome: RowOutcome, note: string | null): PreviewRow {
  const v = row.raw.values;
  return {
    line: row.raw.line,
    orderId: v.order_id.trim(),
    patientName: v.patient_name.trim(),
    mobileDisplay: displayMobile(v.mobile),
    parameter: v.parameter.trim(),
    valueText: v.result.trim(),
    unit: v.unit.trim(),
    refText: v.reference_range.trim(),
    flag: row.valid?.result.flag ?? null,
    outcome,
    note,
  };
}

const rejectAll = (rows: CheckedRow[], reason: (row: CheckedRow) => string) =>
  rows.map((row) => previewRow(row, "REJECTED", reason(row)));

const sameResult = (a: { unit: string; valueText: string; refText: string }, b: typeof a) =>
  a.unit === b.unit && a.valueText === b.valueText && a.refText === b.refText;

const describeOld = (r: { valueText: string; unit: string; refText: string }) =>
  `${r.valueText}${r.unit ? ` ${r.unit}` : ""}, range ${r.refText || "none"}`;

// ---------- One order ----------

function previewOrder(rows: CheckedRow[], existing: ExistingOrder | undefined): {
  rows: PreviewRow[];
  plan: OrderPlan | null;
} {
  // Rule 2: one bad row rejects the whole order.
  const firstBad = rows.find((row) => row.error !== null);
  if (firstBad) {
    return {
      plan: null,
      rows: rejectAll(rows, (row) => row.error ?? `Another row for this order has an error (row ${firstBad.raw.line})`),
    };
  }
  const valid = rows.map((row) => row.valid as ValidRow);

  const lines = new Map<string, number[]>();
  for (const v of valid) lines.set(v.result.parameter, [...(lines.get(v.result.parameter) ?? []), v.line]);
  const duplicate = [...lines.entries()].find(([, at]) => at.length > 1);
  if (duplicate) {
    const [parameter, at] = duplicate;
    return {
      plan: null,
      rows: rejectAll(rows, () => `"${parameter}" appears more than once for this order (rows ${at.join(", ")})`),
    };
  }

  const head = valid[0];
  const disagreement = (
    [
      ["patient name", (v: ValidRow) => v.patientName],
      ["mobile", (v: ValidRow) => v.mobile],
      ["status", (v: ValidRow) => `${v.status}/${v.lisCritical}`],
      ["referring doctor", (v: ValidRow) => v.doctor],
    ] as const
  ).find(([, get]) => valid.some((v) => get(v) !== get(head)));
  if (disagreement) {
    return { plan: null, rows: rejectAll(rows, () => `Rows for this order disagree on ${disagreement[0]}`) };
  }

  // Rule 4: an order never moves to another patient or phone.
  if (existing && (existing.patient.mobile !== head.mobile || existing.patient.name !== head.patientName)) {
    return {
      plan: null,
      rows: rejectAll(rows, () => "This order already belongs to a different patient or mobile in Clara. Check the LIS."),
    };
  }

  const existingResult = (parameter: string) => existing?.results.find((r) => r.parameter === parameter);

  // Rule 3: signed reports are frozen.
  if (existing?.status === "READY") {
    if (head.status === "PROCESSING") {
      return { plan: null, rows: rejectAll(rows, () => "A signed report can't go back to Processing") };
    }
    const doctorChanged = existing.referringDoctor !== head.doctor;
    const frozenRows = rows.map((row, i) => {
        const old = existingResult(valid[i].result.parameter);
        if (!old) return previewRow(row, "REJECTED", "Can't add a result to a signed report");
        if (!sameResult(old, valid[i].result)) {
          return previewRow(row, "REJECTED", `A signed report can't be changed by import (was ${describeOld(old)})`);
        }
        if (doctorChanged) {
          return previewRow(row, "REJECTED", `A signed report can't be changed by import (doctor was ${existing.referringDoctor})`);
        }
        return previewRow(row, "UNCHANGED", null);
    });

    // Safety exception: values identical, but the LIS now marks it critical.
    const newlyCritical = head.lisCritical && !existing.critical;
    if (newlyCritical && frozenRows.every((row) => row.outcome === "UNCHANGED")) {
      return {
        rows: frozenRows.map((row) => ({
          ...row,
          outcome: "UPDATED" as const,
          note: "Marked critical by the LIS: a callback task will be created",
        })),
        plan: {
          kind: "MARK_CRITICAL",
          lisOrderId: head.orderId,
          patientName: head.patientName,
          mobile: head.mobile,
          referringDoctor: head.doctor,
          status: "READY",
          critical: true,
          signs: false,
          callbackReason: callbackReason(existing.results),
          results: [],
        },
      };
    }
    return { plan: null, rows: frozenRows };
  }

  // New order, or an unsigned order that may change.
  const orderChanges: string[] = [];
  if (existing && head.status === "READY") orderChanges.push("Signed: Processing → Ready");
  if (existing && existing.referringDoctor !== head.doctor) {
    orderChanges.push(`Doctor: ${existing.referringDoctor} → ${head.doctor}`);
  }

  const previewRows = rows.map((row, i) => {
    if (!existing) return previewRow(row, "NEW", null);
    const old = existingResult(valid[i].result.parameter);
    if (!old) return previewRow(row, "NEW", orderChanges.join("; ") || null);
    if (!sameResult(old, valid[i].result)) {
      return previewRow(row, "UPDATED", [`Was ${describeOld(old)}`, ...orderChanges].join("; "));
    }
    return orderChanges.length > 0
      ? previewRow(row, "UPDATED", orderChanges.join("; "))
      : previewRow(row, "UNCHANGED", null);
  });

  if (previewRows.every((row) => row.outcome === "UNCHANGED")) return { rows: previewRows, plan: null };

  // Results already stored but not in this file still count (rule 5).
  const incoming = new Set(valid.map((v) => v.result.parameter));
  const allResults = [
    ...valid.map((v) => v.result),
    ...(existing?.results.filter((r) => !incoming.has(r.parameter)) ?? []),
  ];

  return {
    rows: previewRows,
    plan: {
      kind: "SAVE",
      lisOrderId: head.orderId,
      patientName: head.patientName,
      mobile: head.mobile,
      referringDoctor: head.doctor,
      status: head.status,
      critical: isOrderCritical(
        head.lisCritical,
        allResults.map((r) => r.flag),
      ),
      signs: head.status === "READY",
      callbackReason: callbackReason(allResults),
      results: valid.map((v) => v.result),
    },
  };
}

// ---------- Whole file ----------

export function buildImportPreview(rawRows: RawRow[], existingOrders: ExistingOrder[]): ImportPreview {
  const existingById = new Map(existingOrders.map((order) => [order.lisOrderId, order]));

  // Group by order, keeping file order. Rows without a usable order_id stand alone.
  const groups = new Map<string, CheckedRow[]>();
  for (const raw of rawRows) {
    const checked = checkRow(raw);
    const key = checked.valid?.orderId ?? (raw.values.order_id.trim() || `#row-${raw.line}`);
    groups.set(key, [...(groups.get(key) ?? []), checked]);
  }

  const rows: PreviewRow[] = [];
  const plans: OrderPlan[] = [];
  for (const [orderId, group] of groups) {
    const result = previewOrder(group, existingById.get(orderId));
    rows.push(...result.rows);
    if (result.plan) plans.push(result.plan);
  }
  rows.sort((a, b) => a.line - b.line);

  const counts: Record<RowOutcome, number> = { NEW: 0, UPDATED: 0, UNCHANGED: 0, REJECTED: 0 };
  for (const row of rows) counts[row.outcome] += 1;

  return { rows, plans, counts };
}

/** The order IDs in a file, so the server can load just those orders. */
export function orderIdsIn(rawRows: RawRow[]): string[] {
  return [...new Set(rawRows.map((row) => row.values.order_id.trim()).filter(Boolean))];
}
