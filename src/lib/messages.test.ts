import { describe, expect, it } from "vitest";
import { callbackReason, reportLinkUrl, reportReadyMessage, signoffDedupeKey } from "./messages";

describe("signoffDedupeKey", () => {
  it("is one fixed key per order", () => {
    expect(signoffDedupeKey("ORD-71204")).toBe("signoff:ORD-71204");
    expect(signoffDedupeKey("ORD-71204")).toBe(signoffDedupeKey("ORD-71204"));
  });
});

describe("reportLinkUrl", () => {
  it("builds the patient link", () => {
    expect(reportLinkUrl("http://localhost:3000", "abc_-123")).toBe("http://localhost:3000/r/abc_-123");
  });

  it("copes with a trailing slash in the app URL", () => {
    expect(reportLinkUrl("https://clara.example/", "t")).toBe("https://clara.example/r/t");
  });
});

describe("reportReadyMessage", () => {
  const body = reportReadyMessage("https://clara.example/r/TOKEN");

  it("includes the link and the 72-hour notice", () => {
    expect(body).toContain("https://clara.example/r/TOKEN");
    expect(body).toContain("72 hours");
  });

  it("includes a Telugu line", () => {
    expect(body).toMatch(/[ఀ-౿]/);
  });
});

describe("callbackReason", () => {
  it("names each critical value and its direction", () => {
    expect(
      callbackReason([
        { parameter: "Potassium", valueText: "2.5", unit: "mmol/L", flag: "CRITICAL_LOW" },
        { parameter: "Sodium", valueText: "132", unit: "mmol/L", flag: "LOW" },
        { parameter: "Glucose", valueText: "452", unit: "mg/dL", flag: "CRITICAL_HIGH" },
      ]),
    ).toBe("Potassium 2.5 mmol/L (critically low); Glucose 452 mg/dL (critically high)");
  });

  it("falls back to the LIS's marking when no value crosses our limits", () => {
    expect(callbackReason([{ parameter: "LDL", valueText: "142", unit: "mg/dL", flag: "HIGH" }])).toBe(
      "Marked critical by the LIS",
    );
  });
});
