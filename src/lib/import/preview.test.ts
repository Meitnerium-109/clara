import { describe, expect, it } from "vitest";
import type { RawRow } from "./csv";
import { buildImportPreview, orderIdsIn, type ExistingOrder, type ImportPreview } from "./preview";

// ---------- helpers ----------

let nextLine = 2;
function row(overrides: Partial<RawRow["values"]> = {}): RawRow {
  return {
    line: nextLine++,
    values: {
      order_id: "ORD-1",
      patient_name: "Lakshmi Prasanna K",
      mobile: "9000000001",
      parameter: "Haemoglobin",
      unit: "g/dL",
      result: "10.2",
      reference_range: "12.0-15.5",
      status: "Ready",
      referring_doctor: "Dr. S. Ramanaiah",
      ...overrides,
    },
  };
}

function existing(overrides: Partial<ExistingOrder> = {}): ExistingOrder {
  return {
    lisOrderId: "ORD-1",
    status: "READY",
    critical: false,
    referringDoctor: "Dr. S. Ramanaiah",
    patient: { name: "Lakshmi Prasanna K", mobile: "+919000000001" },
    results: [{ parameter: "Haemoglobin", unit: "g/dL", valueText: "10.2", refText: "12.0-15.5", flag: "LOW" }],
    ...overrides,
  };
}

/** What the database looks like after a preview's plans are committed. */
function afterCommit(preview: ImportPreview, before: ExistingOrder[] = []): ExistingOrder[] {
  const byId = new Map(before.map((o) => [o.lisOrderId, structuredClone(o)]));
  for (const plan of preview.plans) {
    const order = byId.get(plan.lisOrderId) ?? {
      lisOrderId: plan.lisOrderId,
      status: plan.status,
      critical: plan.critical,
      referringDoctor: plan.referringDoctor,
      patient: { name: plan.patientName, mobile: plan.mobile },
      results: [],
    };
    order.status = plan.status;
    order.critical = plan.critical;
    order.referringDoctor = plan.referringDoctor;
    for (const r of plan.results) {
      order.results = [...order.results.filter((x) => x.parameter !== r.parameter), r];
    }
    byId.set(plan.lisOrderId, order);
  }
  return [...byId.values()];
}

const outcomes = (p: ImportPreview) => p.rows.map((r) => r.outcome);
const notes = (p: ImportPreview) => p.rows.map((r) => r.note);
const signing = (p: ImportPreview) => p.plans.filter((plan) => plan.signs).map((plan) => plan.lisOrderId);

// ---------- tests ----------

describe("new orders", () => {
  it("marks every row NEW and plans to sign a Ready order", () => {
    const preview = buildImportPreview([row(), row({ parameter: "Platelets", unit: "/cumm", result: "98,000", reference_range: "1,50,000-4,10,000" })], []);
    expect(outcomes(preview)).toEqual(["NEW", "NEW"]);
    expect(preview.plans).toHaveLength(1);
    expect(preview.plans[0]).toMatchObject({
      lisOrderId: "ORD-1",
      mobile: "+919000000001",
      status: "READY",
      signs: true,
      critical: false,
    });
    expect(preview.plans[0].results.map((r) => r.flag)).toEqual(["LOW", "LOW"]);
  });

  it("does not sign a new order that is still Processing", () => {
    const preview = buildImportPreview([row({ status: "Processing" })], []);
    expect(preview.plans[0]).toMatchObject({ status: "PROCESSING", signs: false });
  });

  it("marks an order critical when the LIS says so", () => {
    const preview = buildImportPreview([row({ status: "Ready (critical)" })], []);
    expect(preview.plans[0]).toMatchObject({ critical: true, callbackReason: "Marked critical by the LIS" });
  });

  it("marks an order critical when our rules find a critical value, even if the LIS says plain Ready", () => {
    const preview = buildImportPreview([row({ result: "6.4" })], []);
    expect(preview.plans[0]).toMatchObject({
      critical: true,
      callbackReason: "Haemoglobin 6.4 g/dL (critically low)",
    });
    expect(preview.rows[0].flag).toBe("CRITICAL_LOW");
  });

  it("masks valid mobiles in the preview", () => {
    expect(buildImportPreview([row()], []).rows[0].mobileDisplay).toBe("••••••0001");
  });
});

describe("row validation", () => {
  it.each([
    [{ mobile: "12345" }, "mobile: Not a valid 10-digit Indian mobile number"],
    [{ mobile: "" }, "mobile is missing"],
    [{ status: "Signed" }, 'status "Signed" is not Processing, Ready or Ready (critical)'],
    [{ order_id: "" }, "order_id is missing"],
    [{ order_id: "ORD 1" }, "order_id can only contain letters, digits and dashes"],
    [{ patient_name: "  " }, "patient_name is missing"],
    [{ parameter: "" }, "parameter is missing"],
    [{ result: "" }, "result is missing"],
    [{ referring_doctor: "" }, "referring_doctor is missing"],
    [{ parameter: "x".repeat(81) }, "parameter is too long"],
  ])("rejects %o", (overrides, reason) => {
    const preview = buildImportPreview([row(overrides)], []);
    expect(preview.rows[0]).toMatchObject({ outcome: "REJECTED", note: reason });
    expect(preview.plans).toEqual([]);
  });

  it("shows an invalid mobile as typed, so staff can see what is wrong", () => {
    expect(buildImportPreview([row({ mobile: "12345" })], []).rows[0].mobileDisplay).toBe("12345");
  });

  it("accepts non-numeric results and empty ranges (flagged UNKNOWN, not rejected)", () => {
    const preview = buildImportPreview([row({ parameter: "Dengue NS1", unit: "", result: "Negative", reference_range: "" })], []);
    expect(preview.rows[0]).toMatchObject({ outcome: "NEW", flag: "UNKNOWN" });
  });

  it("rejects the whole order when one of its rows is bad", () => {
    const preview = buildImportPreview(
      [row({ order_id: "ORD-9" }), row({ order_id: "ORD-9", parameter: "TSH", result: "" })],
      [],
    );
    expect(outcomes(preview)).toEqual(["REJECTED", "REJECTED"]);
    expect(notes(preview)[0]).toMatch(/^Another row for this order has an error \(row \d+\)$/);
    expect(notes(preview)[1]).toBe("result is missing");
    expect(preview.plans).toEqual([]);
  });

  it("does not let a bad order affect other orders", () => {
    const preview = buildImportPreview([row({ order_id: "ORD-A", mobile: "1" }), row({ order_id: "ORD-B" })], []);
    expect(outcomes(preview)).toEqual(["REJECTED", "NEW"]);
    expect(preview.plans.map((p) => p.lisOrderId)).toEqual(["ORD-B"]);
  });

  it("rejects a parameter repeated within one order", () => {
    const a = row({ order_id: "ORD-D" });
    const b = row({ order_id: "ORD-D", result: "11" });
    const preview = buildImportPreview([a, b], []);
    expect(outcomes(preview)).toEqual(["REJECTED", "REJECTED"]);
    expect(notes(preview)[0]).toBe(`"Haemoglobin" appears more than once for this order (rows ${a.line}, ${b.line})`);
  });

  it.each([
    [{ patient_name: "Someone Else" }, "patient name"],
    [{ mobile: "9000000002" }, "mobile"],
    [{ status: "Processing" }, "status"],
    [{ status: "Ready (critical)" }, "status"],
    [{ referring_doctor: "Dr. Other" }, "referring doctor"],
  ])("rejects an order whose rows disagree: %o", (overrides, field) => {
    const preview = buildImportPreview([row({ order_id: "ORD-E" }), row({ order_id: "ORD-E", parameter: "TSH", ...overrides })], []);
    expect(notes(preview)).toEqual([`Rows for this order disagree on ${field}`, `Rows for this order disagree on ${field}`]);
  });

  it("treats spacing differences in names and mobiles as the same", () => {
    const preview = buildImportPreview(
      [row({ order_id: "ORD-F" }), row({ order_id: "ORD-F", parameter: "TSH", patient_name: " Lakshmi  Prasanna K", mobile: "+91 90000 00001" })],
      [],
    );
    expect(outcomes(preview)).toEqual(["NEW", "NEW"]);
  });
});

describe("signed orders are frozen", () => {
  it("leaves an identical signed order UNCHANGED, with nothing to commit or send", () => {
    const preview = buildImportPreview([row()], [existing()]);
    expect(outcomes(preview)).toEqual(["UNCHANGED"]);
    expect(preview.plans).toEqual([]);
  });

  it("rejects a changed value and says what it was", () => {
    const preview = buildImportPreview([row({ result: "10.8" })], [existing()]);
    expect(preview.rows[0]).toMatchObject({
      outcome: "REJECTED",
      note: "A signed report can't be changed by import (was 10.2 g/dL, range 12.0-15.5)",
    });
    expect(preview.plans).toEqual([]);
  });

  it("rejects a changed unit or range", () => {
    expect(buildImportPreview([row({ unit: "g/L" })], [existing()]).rows[0].outcome).toBe("REJECTED");
    expect(buildImportPreview([row({ reference_range: "11.5-15.5" })], [existing()]).rows[0].outcome).toBe("REJECTED");
  });

  it("rejects only the changed row; identical rows stay UNCHANGED", () => {
    const signed = existing({
      results: [
        { parameter: "Haemoglobin", unit: "g/dL", valueText: "10.2", refText: "12.0-15.5", flag: "LOW" },
        { parameter: "TSH", unit: "µIU/mL", valueText: "2.2", refText: "0.4-4.0", flag: "NORMAL" },
      ],
    });
    const preview = buildImportPreview(
      [row(), row({ parameter: "TSH", unit: "µIU/mL", result: "9.9", reference_range: "0.4-4.0" })],
      [signed],
    );
    expect(outcomes(preview)).toEqual(["UNCHANGED", "REJECTED"]);
    expect(preview.plans).toEqual([]);
  });

  it("rejects a new result added to a signed order", () => {
    const preview = buildImportPreview([row(), row({ parameter: "TSH", result: "2" })], [existing()]);
    expect(notes(preview)).toEqual([null, "Can't add a result to a signed report"]);
  });

  it("rejects a signed order going back to Processing", () => {
    const preview = buildImportPreview([row({ status: "Processing" })], [existing()]);
    expect(preview.rows[0]).toMatchObject({ outcome: "REJECTED", note: "A signed report can't go back to Processing" });
  });

  it("rejects a changed referring doctor on a signed order", () => {
    const preview = buildImportPreview([row({ referring_doctor: "Dr. New" })], [existing()]);
    expect(preview.rows[0].note).toBe("A signed report can't be changed by import (doctor was Dr. S. Ramanaiah)");
  });
});

describe("a signed order re-sent as critical", () => {
  it("is marked critical with a callback task when the values are unchanged", () => {
    const preview = buildImportPreview([row({ status: "Ready (critical)" })], [existing()]);
    expect(preview.rows[0]).toMatchObject({
      outcome: "UPDATED",
      note: "Marked critical by the LIS: a callback task will be created",
    });
    expect(preview.plans).toEqual([
      expect.objectContaining({ kind: "MARK_CRITICAL", lisOrderId: "ORD-1", critical: true, signs: false, results: [] }),
    ]);
  });

  it("names the LIS as the reason when no value crosses our limits", () => {
    const preview = buildImportPreview([row({ status: "Ready (critical)" })], [existing()]);
    expect(preview.plans[0].callbackReason).toBe("Marked critical by the LIS");
  });

  it("is still rejected when a value also changed", () => {
    const preview = buildImportPreview([row({ status: "Ready (critical)", result: "10.8" })], [existing()]);
    expect(preview.rows[0].outcome).toBe("REJECTED");
    expect(preview.plans).toEqual([]);
  });

  it("is UNCHANGED when the order is already critical", () => {
    const preview = buildImportPreview([row({ status: "Ready (critical)" })], [existing({ critical: true })]);
    expect(outcomes(preview)).toEqual(["UNCHANGED"]);
    expect(preview.plans).toEqual([]);
  });

  it("is a no-op the second time", () => {
    const first = buildImportPreview([row({ status: "Ready (critical)" })], [existing()]);
    const second = buildImportPreview([row({ status: "Ready (critical)" })], afterCommit(first, [existing()]));
    expect(second.plans).toEqual([]);
  });
});

describe("unsigned orders", () => {
  const processing = existing({ status: "PROCESSING" });

  it("signs an order moving from Processing to Ready", () => {
    const preview = buildImportPreview([row()], [processing]);
    expect(preview.rows[0]).toMatchObject({ outcome: "UPDATED", note: "Signed: Processing → Ready" });
    expect(signing(preview)).toEqual(["ORD-1"]);
  });

  it("updates a changed value on a Processing order without signing it", () => {
    const preview = buildImportPreview([row({ status: "Processing", result: "10.9" })], [processing]);
    expect(preview.rows[0]).toMatchObject({ outcome: "UPDATED", note: "Was 10.2 g/dL, range 12.0-15.5" });
    expect(preview.plans[0]).toMatchObject({ signs: false, status: "PROCESSING" });
  });

  it("adds a new result to a Processing order", () => {
    const preview = buildImportPreview([row({ status: "Processing" }), row({ status: "Processing", parameter: "TSH", result: "2" })], [processing]);
    expect(outcomes(preview)).toEqual(["UNCHANGED", "NEW"]);
  });

  it("leaves an identical Processing order UNCHANGED", () => {
    const preview = buildImportPreview([row({ status: "Processing" })], [processing]);
    expect(outcomes(preview)).toEqual(["UNCHANGED"]);
    expect(preview.plans).toEqual([]);
  });

  it("keeps stored results that are missing from the file when judging critical", () => {
    const withCriticalPotassium = existing({
      status: "PROCESSING",
      results: [
        { parameter: "Haemoglobin", unit: "g/dL", valueText: "10.2", refText: "12.0-15.5", flag: "LOW" },
        { parameter: "Potassium", unit: "mmol/L", valueText: "6.8", refText: "3.5-5.1", flag: "CRITICAL_HIGH" },
      ],
    });
    const preview = buildImportPreview([row()], [withCriticalPotassium]);
    expect(preview.plans[0]).toMatchObject({ signs: true, critical: true, callbackReason: "Potassium 6.8 mmol/L (critically high)" });
  });

  it("rejects an order that would move to a different mobile", () => {
    const preview = buildImportPreview([row({ mobile: "9000000002" })], [processing]);
    expect(preview.rows[0].note).toBe("This order already belongs to a different patient or mobile in Clara. Check the LIS.");
  });

  it("rejects an order that would move to a different patient name", () => {
    expect(buildImportPreview([row({ patient_name: "Lakshmi K" })], [processing]).rows[0].outcome).toBe("REJECTED");
  });
});

describe("re-importing never signs (and so never sends) twice", () => {
  const file = () => [
    row({ order_id: "ORD-10" }),
    row({ order_id: "ORD-11", patient_name: "Venkata Rao M", mobile: "9000000002", parameter: "LDL cholesterol", unit: "mg/dL", result: "142", reference_range: "0-100" }),
    row({ order_id: "ORD-12", patient_name: "Farzana Begum", mobile: "9000000003", parameter: "Potassium", unit: "mmol/L", result: "6.8", reference_range: "3.5-5.1", status: "Ready (critical)" }),
    row({ order_id: "ORD-13", status: "Processing", parameter: "TSH", unit: "µIU/mL", result: "2.2", reference_range: "0.4-4.0" }),
  ];

  it("the first import signs the three Ready orders", () => {
    expect(signing(buildImportPreview(file(), []))).toEqual(["ORD-10", "ORD-11", "ORD-12"]);
  });

  it("importing the same file again finds everything UNCHANGED and plans nothing", () => {
    const first = buildImportPreview(file(), []);
    const second = buildImportPreview(file(), afterCommit(first));
    expect(new Set(outcomes(second))).toEqual(new Set(["UNCHANGED"]));
    expect(second.plans).toEqual([]);
  });

  it("a third import is still a no-op", () => {
    const first = buildImportPreview(file(), []);
    const db = afterCommit(first);
    const second = buildImportPreview(file(), db);
    const third = buildImportPreview(file(), afterCommit(second, db));
    expect(third.plans).toEqual([]);
  });

  it("signing a Processing order later signs only that order", () => {
    const first = buildImportPreview(file(), []);
    const later = file().map((r) => (r.values.order_id === "ORD-13" ? { ...r, values: { ...r.values, status: "Ready" } } : r));
    expect(signing(buildImportPreview(later, afterCommit(first)))).toEqual(["ORD-13"]);
  });
});

describe("orderIdsIn", () => {
  it("lists each order once, skipping blanks", () => {
    expect(orderIdsIn([row({ order_id: "A" }), row({ order_id: " A " }), row({ order_id: "" }), row({ order_id: "B" })])).toEqual(["A", "B"]);
  });
});
