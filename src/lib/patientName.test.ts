import { describe, expect, it } from "vitest";
import { normalisePatientName } from "./patientName";

describe("normalisePatientName", () => {
  it("trims and collapses repeated spaces", () => {
    expect(normalisePatientName("  Lakshmi   Prasanna  K ")).toBe("Lakshmi Prasanna K");
  });

  it("keeps the LIS's capitalisation", () => {
    expect(normalisePatientName("Farzana Begum")).toBe("Farzana Begum");
  });
});
