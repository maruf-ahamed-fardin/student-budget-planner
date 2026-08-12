/**
 * Development seed:  npm run seed
 *
 * Loads the sample figures from page 05 of the approved mockup, so the app has
 * a realistic six-month semester to render and the matrix it produces can be
 * checked against the design.
 *
 * This WIPES the existing rows first — it is a demo fixture, not a migration.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SCHEMA } from "../src/schema.js";

/* Dhaka is UTC+6 with no DST — the same offset the app uses for "today". */
const TODAY = new Date(Date.now() + 6 * 60 * 60_000).toISOString().slice(0, 10);
const CURRENT_MONTH = TODAY.slice(0, 7);
const TODAY_DAY = Number(TODAY.slice(8, 10));

function addMonths(month, delta) {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + delta;
  const newMonth = ((index % 12) + 12) % 12;
  return `${year + Math.floor(index / 12)}-${String(newMonth + 1).padStart(2, "0")}`;
}

/** Six months ending with the current one, so the dashboard is never empty. */
const MONTHS = Array.from({ length: 6 }, (_, i) => addMonths(CURRENT_MONTH, i - 5));

/** A day inside `month`, never in the future — tomorrow's mess bill looks broken. */
const dateIn = (month, day) =>
  `${month}-${String(month === CURRENT_MONTH ? Math.min(day, TODAY_DAY) : day).padStart(2, "0")}`;

const poisha = (taka) => Math.round(taka * 100);

/* Expense amounts per month, straight from the mockup's semester matrix. */
const EXPENSES = {
  "Mess Bill": [1500, 1650, 1400, 1700, 1600, 1650],
  "Rickshaw Fare": [250, 310, 280, 320, 300, 320],
  Tuition: [3000, 0, 0, 3000, 0, 0],
  "Mobile Recharge": [100, 100, 150, 100, 100, 100],
  Other: [300, 150, 200, 400, 250, 220],
};

/* Income: 7,000 in months with a tutoring payment, 5,000 otherwise. */
const INCOME_TOTALS = [7000, 5000, 5000, 7000, 5000, 7000];

const DETAIL = {
  "Mess Bill": { day: 5, description: "Monthly mess bill" },
  "Rickshaw Fare": { day: 8, description: "Rickshaw to campus" },
  Tuition: { day: 10, description: "Tuition instalment" },
  "Mobile Recharge": { day: 12, description: "Mobile recharge" },
  Other: { day: 20, description: "Photocopies and snacks" },
};

/* Limits from page 03 of the mockup. */
const BUDGET_LIMITS = {
  "Mess Bill": 2000,
  "Rickshaw Fare": 800,
  Tuition: 3000,
  "Mobile Recharge": 300,
  Other: 500,
};

const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, "budget.db"));
db.exec("PRAGMA foreign_keys = ON");
db.exec(SCHEMA);

db.exec("BEGIN");
try {
  db.exec("DELETE FROM semesters");
  db.exec("DELETE FROM budget_limits");
  db.exec("DELETE FROM transactions");
  db.exec("DELETE FROM sqlite_sequence");

  const insertTx = db.prepare(
    `INSERT INTO transactions (type, amount_poisha, category, description, occurred_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  let clock = Date.now() - MONTHS.length * 30 * 86_400_000;
  let count = 0;

  const add = (type, taka, category, description, date) => {
    insertTx.run(type, poisha(taka), category, description, date, clock++);
    count += 1;
  };

  MONTHS.forEach((month, i) => {
    add("income", 5000, "Family Support", "Family allowance", dateIn(month, 1));

    const extra = INCOME_TOTALS[i] - 5000;
    if (extra > 0) {
      add("income", extra, "Tutoring", "Part-time tutoring", dateIn(month, 25));
    }

    for (const [category, amounts] of Object.entries(EXPENSES)) {
      const amount = amounts[i];
      if (amount === 0) continue;

      const { day, description } = DETAIL[category];

      // Transport is split so the ledger reads like real trips, not one lump.
      if (category === "Rickshaw Fare") {
        const first = Math.round(amount * 0.6);
        add("expense", first, category, description, dateIn(month, day));
        add("expense", amount - first, category, "Rickshaw home", dateIn(month, day + 9));
        continue;
      }

      add("expense", amount, category, description, dateIn(month, day));
    }
  });

  const insertLimit = db.prepare(
    `INSERT INTO budget_limits (category, limit_poisha, updated_at) VALUES (?, ?, ?)`,
  );
  for (const [category, limit] of Object.entries(BUDGET_LIMITS)) {
    insertLimit.run(category, poisha(limit), Date.now());
  }

  db.prepare(
    `INSERT INTO semesters (name, start_month, months, created_at) VALUES (?, ?, ?, ?)`,
  ).run(`Semester ${MONTHS[0].slice(0, 4)}`, MONTHS[0], MONTHS.length, Date.now());

  db.exec("COMMIT");

  const totals = db
    .prepare(
      `SELECT
         SUM(CASE WHEN type = 'income'  THEN amount_poisha ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' THEN amount_poisha ELSE 0 END) AS expense
       FROM transactions`,
    )
    .get();

  const tk = (value) => "Tk " + (value / 100).toLocaleString("en-US");

  console.log(`Seeded ${count} transactions, ${MONTHS[0]} … ${MONTHS.at(-1)}`);
  console.log(`  income   ${tk(totals.income)}`);
  console.log(`  expenses ${tk(totals.expense)}`);
  console.log(`  balance  ${tk(totals.income - totals.expense)}`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
