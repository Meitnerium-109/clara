import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildReportPdf, pdfSafe, type ReportPdfInput } from "./reportPdf";

const base: ReportPdfInput = {
  labName: "Company A Labs",
  patientName: "Lakshmi Prasanna K",
  lisOrderId: "ORD-71204",
  referringDoctor: "Dr. S. Ramanaiah",
  signedAt: new Date("2026-11-07T10:00:00Z"),
  critical: false,
  results: [{ parameter: "Haemoglobin", valueText: "10.2", unit: "g/dL", refText: "12.0-15.5", flag: "LOW" }],
};

describe("buildReportPdf", () => {
  it("produces a valid one-page PDF", async () => {
    const bytes = await buildReportPdf(base);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Test report ORD-71204");
  });

  it("stays small enough for a weak connection", async () => {
    expect((await buildReportPdf(base)).byteLength).toBeLessThan(10_000);
  });

  it("adds pages for long reports", async () => {
    const results = Array.from({ length: 80 }, (_, i) => ({ ...base.results[0], parameter: `Test ${i}` }));
    const doc = await PDFDocument.load(await buildReportPdf({ ...base, results }));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("doesn't crash on characters the PDF fonts can't draw", async () => {
    const input = {
      ...base,
      patientName: "లక్ష్మి ప్రసన్న",
      critical: true,
      results: [{ parameter: "TSH", valueText: "≤0.01", unit: "µIU/mL", refText: "0.4–4.0", flag: "CRITICAL_LOW" as const }],
    };
    await expect(buildReportPdf(input)).resolves.toBeInstanceOf(Uint8Array);
  });

  it("handles an unsigned date and empty unit and range", async () => {
    const input = { ...base, signedAt: null, results: [{ ...base.results[0], unit: "", refText: "", flag: "UNKNOWN" as const }] };
    await expect(buildReportPdf(input)).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("pdfSafe", () => {
  it("keeps Latin-1 (including µ) and maps common symbols", () => {
    expect(pdfSafe("µIU/mL ≤5.6 0.4–4.0")).toBe("µIU/mL <=5.6 0.4-4.0");
  });

  it("replaces other scripts with ?", () => {
    expect(pdfSafe("Hb లక్ష్మి")).toMatch(/^Hb \?+$/);
  });
});
