import {
  categoryLabel,
  daysInMonth,
  formatTaka,
  methodLabel,
  percentChange,
} from "./utils.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Turns the month's numbers into a few sentences a student would actually say
 * out loud: "Food is up 34% on last month", "You'll run out around the 24th".
 *
 * Pure — it takes the figures, not the database — so every rule here is covered
 * by the test suite without a fixture file.
 *
 * Each insight has a `tone` (good / warn / bad / neutral) and a `weight` used
 * to keep only the most useful handful.
 */
export function buildInsights({
  month,
  dayOfMonth,
  thisMonth,
  lastMonth,
  categories,
  lastCategories,
  weekdays,
  methods,
  budget,
}) {
  const insights = [];
  const add = (tone, weight, title, body) => insights.push({ tone, weight, title, body });

  const days = daysInMonth(month);
  // Forecasts are estimates; quoting them to the poisha implies false precision.
  const approx = (poisha) => formatTaka(Math.round(poisha / 100) * 100);
  const elapsed = Math.max(1, Math.min(dayOfMonth, days));

  /* Pace: at today's daily rate, where does the month land? */
  if (thisMonth.expensePoisha > 0 && elapsed < days) {
    const perDay = thisMonth.expensePoisha / elapsed;
    const projected = Math.round(perDay * days);
    const income = thisMonth.incomePoisha;

    if (income > 0 && projected > income) {
      // Day on which cumulative spend crosses income at the current rate.
      const runsOutOn = Math.ceil(income / perDay);
      add(
        "bad",
        10,
        `At this pace you run dry around the ${ordinal(runsOutOn)}`,
        `You're spending about ${approx(perDay)} a day. That projects to ${approx(projected)} this month against ${formatTaka(income)} coming in.`,
      );
    } else {
      add(
        "neutral",
        4,
        `On track for about ${approx(projected)} this month`,
        `That's ${approx(perDay)} a day so far, ${elapsed} day${elapsed === 1 ? "" : "s"} in.`,
      );
    }
  }

  /* Month over month, total and the category that moved most. */
  const change = percentChange(lastMonth.expensePoisha, thisMonth.expensePoisha);
  if (change !== null && elapsed >= days) {
    add(
      change > 0 ? "warn" : "good",
      6,
      `Spending ${change > 0 ? "up" : "down"} ${Math.abs(Math.round(change))}% on last month`,
      `${formatTaka(thisMonth.expensePoisha)} this month vs ${formatTaka(lastMonth.expensePoisha)} last month.`,
    );
  }

  const previous = new Map(lastCategories.map((c) => [c.category, c.poisha]));
  const complete = elapsed >= days;
  let mover = null;
  for (const c of categories) {
    const before = previous.get(c.category) ?? 0;
    // Ignore pocket-change swings; ৳300 is a meaningful move for a student.
    if (before < 30000 && c.poisha < 30000) continue;
    const delta = c.poisha - before;
    // Mid-month, a few days of spending is always "down" on a whole month,
    // which is meaningless. Already being *above* last month is not.
    if (!complete && delta < 0) continue;
    if (!mover || Math.abs(delta) > Math.abs(mover.delta)) mover = { ...c, before, delta };
  }
  if (mover && mover.before > 0 && Math.abs(mover.delta) >= 20000) {
    const pct = Math.round((mover.delta / mover.before) * 100);
    add(
      mover.delta > 0 ? "warn" : "good",
      7,
      `${categoryLabel(mover.category)} ${mover.delta > 0 ? "up" : "down"} ${Math.abs(pct)}%`,
      complete
        ? `${formatTaka(mover.poisha)} this month vs ${formatTaka(mover.before)} last month.`
        : `${formatTaka(mover.poisha)} so far vs ${formatTaka(mover.before)} all of last month.`,
    );
  }

  /* Biggest slice. */
  const top = [...categories].sort((a, b) => b.poisha - a.poisha)[0];
  if (top && top.share >= 25) {
    add(
      "neutral",
      5,
      `${categoryLabel(top.category)} is ${Math.round(top.share)}% of your spending`,
      `${formatTaka(top.poisha)} of ${formatTaka(thisMonth.expensePoisha)} this month went there.`,
    );
  }

  /* Weekday habit. */
  const weekTotal = weekdays.reduce((s, v) => s + v, 0);
  if (weekTotal > 0) {
    const peak = weekdays.indexOf(Math.max(...weekdays));
    const share = (weekdays[peak] / weekTotal) * 100;
    if (share >= 20) {
      add(
        "neutral",
        3,
        `${DAY_NAMES[peak]}s cost you the most`,
        `${Math.round(share)}% of the last six months' spending landed on a ${DAY_NAMES[peak]}.`,
      );
    }
  }

  /* Mobile wallets — the bKash/Nagad cash-out fee is real money. */
  const wallet = methods
    .filter((m) => m.method === "bkash" || m.method === "nagad" || m.method === "rocket")
    .reduce((s, m) => s + m.poisha, 0);
  const methodTotal = methods.reduce((s, m) => s + m.poisha, 0);
  if (methodTotal > 0 && wallet / methodTotal >= 0.3) {
    const main = methods.find((m) => m.method !== "cash" && m.method !== "card" && m.method !== "bank");
    add(
      "neutral",
      2,
      `${Math.round((wallet / methodTotal) * 100)}% paid by mobile wallet`,
      `Mostly ${methodLabel(main?.method ?? "bkash")}. Paying merchants directly avoids the ~1.85% cash-out charge.`,
    );
  }

  /* Budget limits. */
  if (budget.overCount > 0) {
    const over = budget.rows.filter((r) => r.status === "over");
    add(
      "bad",
      9,
      over.length === 1
        ? `${categoryLabel(over[0].category)} is over its limit`
        : `${over.length} categories are over their limits`,
      over
        .map((r) => `${categoryLabel(r.category)} by ${formatTaka(-r.remainingPoisha)}`)
        .join(", ") + ".",
    );
  } else if (budget.rows.length > 0 && thisMonth.expensePoisha > 0) {
    add("good", 5, "Every category is inside its limit", "Keep it that way and the month closes clean.");
  }

  /* Savings rate. */
  if (thisMonth.incomePoisha > 0 && elapsed >= days) {
    const rate = (thisMonth.balancePoisha / thisMonth.incomePoisha) * 100;
    if (rate >= 15) {
      add("good", 6, `You kept ${Math.round(rate)}% of what came in`, "Move some of it into a goal before it disappears.");
    }
  }

  return insights.sort((a, b) => b.weight - a.weight);
}

export function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
}

/**
 * What can be spent per remaining day without breaking anything.
 *
 * The plan: with budget limits, what's left of them *as a whole* — an
 * overspend in Food eats into the room left in Transport, because it's the
 * same pocket. Without limits, the month's income minus spending so far.
 *
 * Then capped by the wallet: limits are intentions, not money. ৳5,000 of
 * budget room with ৳500 actually unspent (and not parked in goals) is ৳500.
 *
 * Divided across the days left including today, rounded down to whole taka,
 * never negative — "৳0 a day" is the honest answer when the money is gone.
 */
export function safeToSpend({ budget, thisMonth, dayOfMonth, days, freePoisha = Infinity }) {
  const daysLeft = Math.max(1, days - dayOfMonth + 1);
  const hasBudget = budget.rows.length > 0;

  const plan = hasBudget
    ? Math.min(budget.headroomPoisha, budget.totalLimitPoisha - budget.totalSpentPoisha)
    : thisMonth.incomePoisha - thisMonth.expensePoisha;
  const pool = Math.max(0, Math.min(plan, freePoisha));

  return {
    perDayPoisha: Math.floor(pool / daysLeft / 100) * 100,
    daysLeft,
    poolPoisha: pool,
    basis: freePoisha < plan ? "wallet" : hasBudget ? "budget" : "income",
  };
}
