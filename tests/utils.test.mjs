import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addMonths,
  daysInMonth,
  firstWeekday,
  formatCompact,
  formatSigned,
  formatTaka,
  isIsoDate,
  isIsoMonth,
  isValidCategory,
  MoneyError,
  poishaToInput,
  safeNextPath,
  toPoisha,
  today,
  trailingMonths,
} from "../src/lib/utils.js";

describe("money parsing", () => {
  it("reads whole taka and poisha into integer poisha", () => {
    assert.equal(toPoisha("500"), 50_000);
    assert.equal(toPoisha("12.5"), 1_250);
    assert.equal(toPoisha("12.05"), 1_205);
    assert.equal(toPoisha(" 1,200.99 "), 120_099);
  });

  it("never drifts a poisha the way floats do", () => {
    // 0.1 + 0.2 !== 0.3 in floating point; in poisha it's exact.
    assert.equal(toPoisha("0.10") + toPoisha("0.20"), toPoisha("0.30"));
    assert.equal(toPoisha("19.99") * 3, 5_997);
  });

  it("rejects junk, zero, negatives, three decimals and absurd amounts", () => {
    for (const bad of ["", "abc", "0", "0.00", "-5", "1.234", "1e5", "12.", ".5", "99999999999"]) {
      assert.throws(() => toPoisha(bad), MoneyError, `should reject ${JSON.stringify(bad)}`);
    }
  });

  it("round-trips through the edit form", () => {
    for (const p of [1, 99, 100, 1_205, 50_000, 120_099]) {
      assert.equal(toPoisha(poishaToInput(p)), p);
    }
  });
});

describe("money formatting", () => {
  it("groups digits and only shows poisha when there are any", () => {
    assert.equal(formatTaka(820_000), "৳8,200");
    assert.equal(formatTaka(1_250), "৳12.50");
    assert.equal(formatTaka(-50_000), "−৳500");
    assert.equal(formatTaka(123_456_700, { symbol: false }), "1,234,567");
  });

  it("signs ledger rows by type", () => {
    assert.equal(formatSigned(50_000, "income"), "+৳500");
    assert.equal(formatSigned(50_000, "expense"), "−৳500");
  });

  it("compacts for axes", () => {
    assert.equal(formatCompact(1_240_000), "৳12.4k");
    assert.equal(formatCompact(15_000_000), "৳1.5L");
    assert.equal(formatCompact(4_000), "৳40");
  });
});

describe("dates", () => {
  it("uses Dhaka time, not the server's", () => {
    // 20:30 UTC on 31 Jan is already 02:30 on 1 Feb in Dhaka.
    assert.equal(today(Date.UTC(2026, 0, 31, 20, 30)), "2026-02-01");
    assert.equal(today(Date.UTC(2026, 0, 31, 17, 59)), "2026-01-31");
  });

  it("validates real calendar dates only", () => {
    assert.ok(isIsoDate("2028-02-29"));
    assert.ok(!isIsoDate("2026-02-29"));
    assert.ok(!isIsoDate("2026-13-01"));
    assert.ok(!isIsoDate("2026-1-01"));
    assert.ok(!isIsoDate(undefined));
    assert.ok(isIsoMonth("2026-12"));
    assert.ok(!isIsoMonth("2026-00"));
  });

  it("does month arithmetic across year boundaries", () => {
    assert.equal(addMonths("2026-01", -1), "2025-12");
    assert.equal(addMonths("2025-11", 3), "2026-02");
    assert.deepEqual(trailingMonths("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
    assert.equal(daysInMonth("2024-02"), 29);
    assert.equal(firstWeekday("2026-10"), 4); // 1 Oct 2026 is a Thursday
  });
});

describe("categories", () => {
  it("keeps income and expense lists apart", () => {
    assert.ok(isValidCategory("Mess Bill", "expense"));
    assert.ok(!isValidCategory("Mess Bill", "income"));
    assert.ok(isValidCategory("Tutoring", "income"));
    assert.ok(!isValidCategory("'; DROP TABLE users; --"));
  });
});

describe("post-login redirect", () => {
  it("allows same-site paths", () => {
    assert.equal(safeNextPath("/budget"), "/budget");
    assert.equal(safeNextPath("/transactions?month=2026-01"), "/transactions?month=2026-01");
  });

  it("refuses anything that leaves the site", () => {
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", undefined]) {
      assert.equal(safeNextPath(evil), "/dashboard", `should refuse ${evil}`);
    }
  });
});
