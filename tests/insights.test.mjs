import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildInsights, ordinal, safeToSpend } from "../src/lib/insights.js";

const money = (income, expense) => ({
  incomePoisha: income * 100,
  expensePoisha: expense * 100,
  balancePoisha: (income - expense) * 100,
});

const noBudget = { rows: [], headroomPoisha: 0, overCount: 0 };

const base = {
  month: "2026-10",
  dayOfMonth: 10,
  thisMonth: money(6000, 3000),
  lastMonth: money(6000, 5000),
  categories: [],
  lastCategories: [],
  weekdays: [0, 0, 0, 0, 0, 0, 0],
  methods: [],
  budget: noBudget,
};

describe("insights", () => {
  it("warns when the pace runs out before the month does", () => {
    // ৳300/day over 31 days = ৳9,300 projected against ৳6,000 in.
    const [first] = buildInsights(base);
    assert.equal(first.tone, "bad");
    assert.match(first.title, /run dry around the 20th/);
  });

  it("says on track when the pace fits", () => {
    const insights = buildInsights({ ...base, thisMonth: money(6000, 1000) });
    assert.ok(insights.some((i) => i.title.startsWith("On track")));
  });

  it("flags over-limit categories ahead of everything else", () => {
    const budget = {
      rows: [{ category: "Food", status: "over", remainingPoisha: -25_000 }],
      headroomPoisha: 0,
      overCount: 1,
    };
    const insights = buildInsights({ ...base, thisMonth: money(6000, 1000), budget });
    assert.equal(insights[0].title, "Food & Snacks is over its limit");
    assert.match(insights[0].body, /৳250/);
  });

  it("names the weekday that costs the most", () => {
    const insights = buildInsights({ ...base, weekdays: [10, 10, 10, 10, 90, 10, 10] });
    assert.ok(insights.some((i) => i.title === "Thursdays cost you the most"));
  });
});

describe("safe to spend", () => {
  const budgetWith = (headroom, limit, spent) => ({
    rows: [{}],
    headroomPoisha: headroom * 100,
    totalLimitPoisha: limit * 100,
    totalSpentPoisha: spent * 100,
  });

  it("divides budget headroom across the days left, including today", () => {
    const result = safeToSpend({ budget: budgetWith(310, 1000, 690), thisMonth: money(0, 0), dayOfMonth: 22, days: 31 });
    assert.deepEqual([result.daysLeft, result.perDayPoisha, result.basis], [10, 3_100, "budget"]);
  });

  it("lets an overspend in one category eat into the others", () => {
    // Transport has ৳1,000 left, but Food is ৳600 over: ৳400 really remains.
    const result = safeToSpend({ budget: budgetWith(1000, 3000, 2600), thisMonth: money(0, 0), dayOfMonth: 27, days: 30 });
    assert.equal(result.poolPoisha, 40_000);
    assert.equal(result.perDayPoisha, 10_000);
  });

  it("never promises more than is actually in the wallet", () => {
    const result = safeToSpend({
      budget: budgetWith(5000, 8000, 3000),
      thisMonth: money(0, 0),
      dayOfMonth: 21,
      days: 30,
      freePoisha: 50_000,
    });
    assert.deepEqual([result.poolPoisha, result.perDayPoisha, result.basis], [50_000, 5_000, "wallet"]);
  });

  it("falls back to income left, and never goes negative", () => {
    const result = safeToSpend({ budget: noBudget, thisMonth: money(1000, 4000), dayOfMonth: 5, days: 30 });
    assert.equal(result.perDayPoisha, 0);
  });

  it("rounds down to whole taka", () => {
    const result = safeToSpend({ budget: noBudget, thisMonth: money(1000, 0), dayOfMonth: 25, days: 31 });
    assert.equal(result.perDayPoisha, 14_200); // ৳142.85 → ৳142
  });
});

describe("category movers", () => {
  const food = (taka) => [{ category: "Food", poisha: taka * 100, share: 50 }];

  it("ignores a mid-month 'decrease' — a few days always look lower than a whole month", () => {
    const insights = buildInsights({ ...base, dayOfMonth: 5, categories: food(500), lastCategories: food(2000) });
    assert.ok(!insights.some((i) => i.title.startsWith("Food & Snacks down")));
  });

  it("does report a mid-month increase", () => {
    const insights = buildInsights({ ...base, dayOfMonth: 12, categories: food(2500), lastCategories: food(1500) });
    assert.ok(insights.some((i) => i.title === "Food & Snacks up 67%"));
  });

  it("reports a decrease once the month is complete", () => {
    const insights = buildInsights({ ...base, dayOfMonth: 31, categories: food(1000), lastCategories: food(2000) });
    assert.ok(insights.some((i) => i.title === "Food & Snacks down 50%"));
  });
});

it("writes ordinals properly", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal), [
    "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd",
  ]);
});
