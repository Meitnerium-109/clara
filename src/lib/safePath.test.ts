import { describe, expect, it } from "vitest";
import { safeLocalPath, safePatientNext } from "./safePath";

describe("safePatientNext", () => {
  it.each(["/my", "/my/orders/abc123", "/my/p/cm3x_9-k"])("allows %s", (path) => {
    expect(safePatientNext(path)).toBe(path);
  });

  it.each([
    undefined,
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/staff",
    "/myself",
    "/my/../staff",
    "/my?x=1",
    "/my/orders/a b",
  ])("falls back to /my for %j", (path) => {
    expect(safePatientNext(path)).toBe("/my");
  });
});

describe("safeLocalPath", () => {
  it.each(["/", "/login", "/r/abc_DEF-123", "/my/orders/x"])("allows %s", (path) => {
    expect(safeLocalPath(path)).toBe(path);
  });

  it.each([undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "login", "/a?b=c", "/a#b"])(
    "falls back to / for %j",
    (path) => {
      expect(safeLocalPath(path)).toBe("/");
    },
  );
});
