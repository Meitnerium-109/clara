import { describe, expect, it } from "vitest";
import { parseLisStatus } from "./lisStatus";

describe("parseLisStatus", () => {
  it.each([
    ["Processing", { status: "PROCESSING", lisCritical: false }],
    ["Ready", { status: "READY", lisCritical: false }],
    ["Ready (critical)", { status: "READY", lisCritical: true }],
    ["  READY  ", { status: "READY", lisCritical: false }],
    ["ready ( Critical )", { status: "READY", lisCritical: true }],
    ["Ready  (critical)", { status: "READY", lisCritical: true }],
  ])("parses %j", (text, expected) => {
    expect(parseLisStatus(text)).toEqual(expected);
  });

  it.each(["", "Signed", "Ready critical", "Cancelled", "Pending"])("rejects %j", (text) => {
    expect(parseLisStatus(text)).toBeNull();
  });
});
