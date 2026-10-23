import { addMonths, currentMonth, daysInMonth, formatMonthShort, today } from "./utils.js";

/**
 * A believable six months of a Dhaka student's money: a family transfer over
 * bKash on the 1st, a private tuition on the 25th, the mess bill, a dozen
 * rickshaw rides, photocopies before exams, a tuition-fee instalment that the
 * family tops up for. Used by `npm run seed` and by "Try the demo", so a
 * recruiter clicking around sees a lived-in account rather than zeros.
 *
 * Deterministic: a seeded PRNG means the demo looks the same on every run,
 * which is what you want when screenshots go in a README.
 */

function prng(seed) {
  // mulberry32 — tiny, fast, good enough for fake rickshaw fares.
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RIDES = ["Rickshaw to campus", "Rickshaw home", "Bus to Farmgate", "CNG to Uttara", "Pathao bike"];
const SNACKS = ["Singara & cha", "Lunch at canteen", "Fuchka with friends", "Biriyani", "Coffee before class", "Tong cha", "Khichuri"];
const STUDY = ["Lecture sheet photocopy", "Lab report print", "Question bank", "Used textbook", "Assignment print"];
const HANGOUT = ["Movie at Star Cineplex", "Birthday treat", "Dhanmondi lake adda", "Gaming zone", "Friend's farewell"];

export function seedSampleData(db, userId, { now = Date.now(), seed = 42 } = {}) {
  const random = prng(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const between = (min, max, step = 10) =>
    Math.round((min + random() * (max - min)) / step) * step;

  const todayIso = today(now);
  const thisMonth = currentMonth(now);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, i - 5));

/** A day inside `month`. Future dates in the current month are skipped by
   *  tx() rather than clamped, so they don't all pile up on today. */
  const dateIn = (month, day) =>
    `${month}-${String(Math.max(1, Math.min(day, daysInMonth(month)))).padStart(2, "0")}`;

  const insertTx = db.prepare(
    `INSERT INTO transactions (user_id, type, amount_poisha, category, method, description, occurred_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let clock = now - 200 * 86_400_000;
  let count = 0;
  const tx = (type, taka, category, method, description, date) => {
    // Skip future-dated entries in the current month instead of piling them on today.
    if (date > todayIso) return;
    insertTx.run(userId, type, taka * 100, category, method, description, date, (clock += 1000));
    count += 1;
  };

  months.forEach((month, i) => {
    const isFeeMonth = i === 1 || i === 4;
    const days = daysInMonth(month);

    tx("income", 6000, "Family Support", "bkash", "Monthly allowance from Abbu", dateIn(month, 1));
    if (isFeeMonth) {
      tx("income", 12000, "Family Support", "bank", "Semester fee top-up", dateIn(month, 6));
      tx("expense", 12000, "Tuition", "bank", "Tuition fee instalment", dateIn(month, 7));
    }
    if (i !== 2) tx("income", 3500, "Tutoring", "cash", "Class 8 student tuition", dateIn(month, 25));
    if (i === 3) tx("income", 2500, "Stipend", "bank", "Merit scholarship", dateIn(month, 15));
    if (i === 5) tx("income", 1800, "Part-time Job", "bkash", "Logo design gig", dateIn(month, 12));

    tx("expense", between(2100, 2400, 50), "Mess Bill", "cash", "Mess bill + meal", dateIn(month, 3));

    for (let r = 0; r < 12; r++) {
      tx("expense", between(30, 120), "Rickshaw Fare", "cash", pick(RIDES), dateIn(month, 2 + Math.floor(random() * (days - 2))));
    }
    for (let f = 0; f < 9; f++) {
      tx("expense", between(40, 280), "Food", random() < 0.3 ? "bkash" : "cash", pick(SNACKS), dateIn(month, 1 + Math.floor(random() * days)));
    }
    tx("expense", 299, "Mobile Recharge", "bkash", "GP 30-day internet pack", dateIn(month, 4));
    tx("expense", between(50, 120), "Mobile Recharge", "bkash", "Talk-time recharge", dateIn(month, 18));
    for (let s = 0; s < 3 + (i % 2); s++) {
      tx("expense", between(20, 180), "Photocopy/Print", "cash", pick(STUDY), dateIn(month, 5 + Math.floor(random() * (days - 5))));
    }
    for (let h = 0; h < 2; h++) {
      tx("expense", between(150, 650), "Hangout", random() < 0.5 ? "nagad" : "bkash", pick(HANGOUT), dateIn(month, 8 + Math.floor(random() * (days - 8))));
    }
    if (i === 2) tx("expense", 450, "Other", "cash", "Medicine from pharmacy", dateIn(month, 14));
  });

  const insertLimit = db.prepare(
    `INSERT INTO budget_limits (user_id, category, limit_poisha, updated_at) VALUES (?, ?, ?, ?)`,
  );
  for (const [category, taka] of [
    ["Mess Bill", 2500], ["Rickshaw Fare", 900], ["Food", 1500],
    ["Mobile Recharge", 450], ["Photocopy/Print", 400], ["Hangout", 700],
  ]) {
    insertLimit.run(userId, category, taka * 100, now);
  }

  const insertGoal = db.prepare(
    `INSERT INTO goals (user_id, name, target_poisha, deadline, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertEntry = db.prepare(
    `INSERT INTO goal_entries (goal_id, user_id, amount_poisha, occurred_on, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const goals = [
    { name: "Laptop for thesis", target: 55000, deadlineIn: 8, deposits: [1500, 1000, 1000, 2000, 1500, 1500] },
    { name: "Cox's Bazar study tour", target: 8000, deadlineIn: 3, deposits: [0, 0, 800, 1000, 700, 800] },
    { name: "Eid shopping", target: 5000, deadlineIn: 2, deposits: [0, 0, 0, 800, 1000, 1500] },
  ];
  for (const goal of goals) {
    const deadline = `${addMonths(thisMonth, goal.deadlineIn)}-15`;
    const { lastInsertRowid } = insertGoal.run(userId, goal.name, goal.target * 100, deadline, now);
    goal.deposits.forEach((taka, i) => {
      const date = dateIn(months[i], 26);
      if (taka > 0 && date <= todayIso) insertEntry.run(lastInsertRowid, userId, taka * 100, date, now);
    });
  }

  db.prepare(
    `INSERT INTO semesters (user_id, name, start_month, months, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(
    userId,
    `${formatMonthShort(months[0])}–${formatMonthShort(months[5])} ${months[5].slice(0, 4)}`,
    months[0],
    6,
    now,
  );

  return { transactions: count, months };
}
