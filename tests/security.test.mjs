import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { csvCell, toCsv } from "../src/lib/csv.js";
import { hashPassword, passwordProblem, verifyPassword } from "../src/lib/password.js";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("mess-bill-paid-2026");
    assert.match(hash, /^scrypt\$32768\$8\$1\$/);
    assert.equal(await verifyPassword("mess-bill-paid-2026", hash), true);
    assert.equal(await verifyPassword("mess-bill-paid-2025", hash), false);
  });

  it("salts every hash", async () => {
    assert.notEqual(await hashPassword("same"), await hashPassword("same"));
  });

  it("treats malformed stored values as a failed login, not a crash", async () => {
    for (const stored of ["", "!demo", "bcrypt$x", "scrypt$1$2$3"]) {
      assert.equal(await verifyPassword("anything", stored), false);
    }
  });
});

describe("password rules", () => {
  it("rejects short, huge, common and self-referential passwords", () => {
    assert.ok(passwordProblem("short"));
    assert.ok(passwordProblem("x".repeat(129)));
    assert.ok(passwordProblem("password123"));
    assert.ok(passwordProblem("aaaaaaaaaa"));
    assert.ok(passwordProblem("rafiahmed99", { email: "rafiahmed@uni.edu" }));
    assert.equal(passwordProblem("tong-er-cha-at-4pm"), null);
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas in user text", () => {
    assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
    assert.equal(csvCell("+cmd"), "'+cmd");
    assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(csvCell("-2+3"), "'-2+3");
  });

  it("leaves our own negative numbers alone so SUM still works", () => {
    assert.equal(csvCell(-12.5), "-12.5");
  });

  it("quotes commas, quotes and newlines", () => {
    assert.equal(csvCell("tea, singara"), '"tea, singara"');
    assert.equal(csvCell('the "good" fuchka'), '"the ""good"" fuchka"');
    assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  });

  it("writes a BOM and CRLF rows", () => {
    const csv = toCsv(["a", "b"], [[1, "x"]]);
    assert.ok(csv.startsWith("﻿a,b\r\n1,x\r\n"));
  });
});
