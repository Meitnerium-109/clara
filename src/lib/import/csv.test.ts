import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, MAX_ROWS, readLisCsv } from "./csv";

const HEADER = CSV_COLUMNS.join(",");
const ROW = 'ORD-1,Lakshmi Prasanna K,9000000001,Haemoglobin,g/dL,10.2,12.0-15.5,Ready,Dr. S. Ramanaiah';

describe("readLisCsv", () => {
  it("reads rows into named columns with spreadsheet row numbers", () => {
    const result = readLisCsv(`${HEADER}\n${ROW}\n`);
    expect(result).toEqual({
      ok: true,
      rows: [
        {
          line: 2,
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
          },
        },
      ],
    });
  });

  it("handles quoted fields with commas (Indian number format)", () => {
    const result = readLisCsv(`${HEADER}\nORD-2,Sai Kiran P,9000000010,Platelets,/cumm,"2,10,000","1,50,000-4,10,000",Processing,Dr. X`);
    expect(result.ok && result.rows[0].values.result).toBe("2,10,000");
    expect(result.ok && result.rows[0].values.reference_range).toBe("1,50,000-4,10,000");
  });

  it("accepts columns in any order, any case, with extra columns ignored", () => {
    const shuffled = ["STATUS", "extra", ...CSV_COLUMNS.filter((c) => c !== "status").map((c) => ` ${c} `)];
    const values = ["Ready", "ignored", "ORD-3", "A B", "9000000001", "TSH", "µIU/mL", "2.2", "0.4-4.0", "Dr. Y"];
    const result = readLisCsv(`${shuffled.join(",")}\n${values.join(",")}`);
    expect(result.ok && result.rows[0].values).toMatchObject({ status: "Ready", order_id: "ORD-3", parameter: "TSH" });
  });

  it("strips the byte-order mark Excel adds", () => {
    expect(readLisCsv(`﻿${HEADER}\n${ROW}`).ok).toBe(true);
  });

  it("handles Windows line endings", () => {
    const result = readLisCsv(`${HEADER}\r\n${ROW}\r\n`);
    expect(result.ok && result.rows[0].values.referring_doctor).toBe("Dr. S. Ramanaiah");
  });

  it("skips blank lines but keeps true row numbers", () => {
    const result = readLisCsv(`${HEADER}\n\n${ROW}\n,,,,,,,,\n`);
    expect(result.ok && result.rows.map((r) => r.line)).toEqual([3]);
  });

  it("fills a short row's missing cells with empty text (validation rejects it later)", () => {
    const result = readLisCsv(`${HEADER}\nORD-1,Name`);
    expect(result.ok && result.rows[0].values.status).toBe("");
  });

  it.each([
    ["", "The file is empty."],
    ["   \n  ", "The file is empty."],
    [HEADER, "The file has a header row but no results."],
  ])("rejects %j", (text, error) => {
    expect(readLisCsv(text)).toEqual({ ok: false, error });
  });

  it("names the missing columns", () => {
    const result = readLisCsv("order_id,patient_name,result\nORD-1,A,1");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/^Missing columns: mobile, parameter, unit, reference_range, status, referring_doctor\./);
  });

  it("rejects a broken quote", () => {
    const result = readLisCsv(`${HEADER}\nORD-1,"Unclosed,9000000001,Hb,g/dL,1,1-2,Ready,Dr`);
    expect(result.ok).toBe(false);
  });

  it("rejects files over the row limit", () => {
    const text = `${HEADER}\n${Array.from({ length: MAX_ROWS + 1 }, () => ROW).join("\n")}`;
    expect(readLisCsv(text)).toMatchObject({ ok: false, error: expect.stringMatching(/limit is 5000/) });
  });
});
