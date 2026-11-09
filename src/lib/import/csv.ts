/**
 * Reads the LIS CSV export into raw text rows. No business rules here: this
 * only checks the file is readable and has the agreed columns.
 */

import Papa from "papaparse";
import { CSV_COLUMNS, type CsvColumn } from "./columns";

export { CSV_COLUMNS, type CsvColumn };

export type RawRow = {
  /** Spreadsheet row number (the header is row 1), so staff can find it in Excel. */
  line: number;
  values: Record<CsvColumn, string>;
};

export type CsvReadResult = { ok: true; rows: RawRow[] } | { ok: false; error: string };

export const MAX_ROWS = 5000;

export function readLisCsv(text: string): CsvReadResult {
  const content = text.replace(/^﻿/, ""); // Excel adds a byte-order mark
  if (content.trim() === "") return { ok: false, error: "The file is empty." };

  const parsed = Papa.parse<string[]>(content, { skipEmptyLines: false });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    const where = first.row !== undefined ? ` near row ${first.row + 1}` : "";
    return { ok: false, error: `The file could not be read${where}: ${first.message}.` };
  }

  const [header = [], ...dataRows] = parsed.data;
  const headerNames = header.map((name) => name.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((column) => !headerNames.includes(column));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Expected: ${CSV_COLUMNS.join(", ")}.`,
    };
  }

  const rows: RawRow[] = [];
  dataRows.forEach((cells, index) => {
    if (cells.every((cell) => cell.trim() === "")) return; // blank line
    const values = Object.fromEntries(
      CSV_COLUMNS.map((column) => [column, cells[headerNames.indexOf(column)] ?? ""]),
    ) as Record<CsvColumn, string>;
    rows.push({ line: index + 2, values });
  });

  if (rows.length === 0) return { ok: false, error: "The file has a header row but no results." };
  if (rows.length > MAX_ROWS) {
    return { ok: false, error: `The file has ${rows.length} rows; the limit is ${MAX_ROWS}. Split it and import each part.` };
  }
  return { ok: true, rows };
}
