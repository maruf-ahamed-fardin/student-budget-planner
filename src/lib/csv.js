/**
 * CSV for the ledger export. Pure, so the test suite covers it directly.
 *
 * Two hazards are handled here rather than trusted to the spreadsheet:
 *  - Quoting: commas, quotes and newlines in a description must not split a row.
 *  - Formula injection: Excel and Sheets execute a cell that starts with
 *    = + - @ (or a tab / carriage return). A description like
 *    `=HYPERLINK("http://…")` would run when the student opens the file, so such
 *    cells get a leading apostrophe, which the spreadsheet shows as plain text.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === null || value === undefined) return "";

  let text = String(value);
  // Numbers are ours, not user input, and a negative number is not a formula.
  if (typeof value !== "number" && FORMULA_START.test(text)) text = "'" + text;

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header, rows) {
  // CRLF per RFC 4180; the BOM makes Excel read the ৳ sign as UTF-8.
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
