/**
 * Pure helpers shared by the server, the browser and the test suite: money,
 * dates, categories, navigation. Nothing here touches the database or the DOM,
 * and nothing here imports through the `@/` alias, so `node --test` can load it
 * directly.
 */

/* ------------------------------------------------------------------ *
 * Money — integer poisha (1 Taka = 100 poisha)                        *
 * ------------------------------------------------------------------ *
 * Amounts are never held as floating-point Taka. That is how budget
 * totals drift by a poisha and stop reconciling with the ledger.       */

export class MoneyError extends Error {}

/** Largest single amount accepted: ৳10 crore. Anything above is a typo. */
export const MAX_POISHA = 10_000_000_000;

/** Parse form input ("500", "12.50", "1,200") into integer poisha. */
export function toPoisha(input) {
  const raw = String(input ?? "").trim().replace(/,/g, "");

  if (raw === "") throw new MoneyError("Amount is required.");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new MoneyError("Enter a valid amount, like 500 or 12.50.");
  }

  const [takaPart, poishaPart = ""] = raw.split(".");
  const poisha = Number(takaPart) * 100 + Number(poishaPart.padEnd(2, "0"));

  if (poisha <= 0) throw new MoneyError("Amount must be greater than zero.");
  if (poisha > MAX_POISHA) throw new MoneyError("That amount is too large.");

  return poisha;
}

/** Poisha back to an editable string: 1250 → "12.50", 50000 → "500". */
export function poishaToInput(poisha) {
  const taka = Math.floor(poisha / 100);
  const rest = poisha % 100;
  return rest === 0 ? String(taka) : `${taka}.${String(rest).padStart(2, "0")}`;
}

/**
 * Western digit grouping (8,200 / 19,450). Hand-rolled rather than Intl so the
 * server and the browser can never disagree about locale data and mismatch on
 * every figure during hydration.
 */
function groupDigits(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "৳8,200"; amounts carrying poisha render with exactly two decimals. */
export function formatTaka(poisha, { symbol = true } = {}) {
  const negative = poisha < 0;
  const abs = Math.abs(Math.round(poisha));

  let body = groupDigits(String(Math.floor(abs / 100)));
  const rest = abs % 100;
  if (rest !== 0) body += "." + String(rest).padStart(2, "0");
  if (symbol) body = "৳" + body;

  return negative ? "−" + body : body;
}

/** "৳12.4k" — for chart axes and tight spots, never for the ledger itself. */
export function formatCompact(poisha) {
  const taka = Math.abs(poisha) / 100;
  const sign = poisha < 0 ? "−" : "";
  if (taka >= 100_000) return `${sign}৳${trimZero(taka / 100_000)}L`;
  if (taka >= 1_000) return `${sign}৳${trimZero(taka / 1_000)}k`;
  return `${sign}৳${Math.round(taka)}`;
}

const trimZero = (n) => n.toFixed(1).replace(/\.0$/, "");

/** "+৳5,000" / "−৳500" for transaction rows. */
export function formatSigned(poisha, type) {
  return (type === "income" ? "+" : "−") + formatTaka(Math.abs(poisha));
}

/** Percentage of `part` against `whole`; null when there is no denominator. */
export function percentOf(part, whole) {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function formatPercent(value, fallback = "—") {
  return value === null || !Number.isFinite(value) ? fallback : `${Math.round(value)}%`;
}

/** Change from `before` to `after` as a percentage; null if `before` is zero. */
export function percentChange(before, after) {
  return before > 0 ? ((after - before) / before) * 100 : null;
}

/* ------------------------------------------------------------------ *
 * Dates — 'YYYY-MM-DD' strings and 'YYYY-MM' months, never Date       *
 * ------------------------------------------------------------------ *
 * The server may run in UTC while the student's phone runs Asia/Dhaka
 * (UTC+6, no DST). A Date-derived "today" would disagree between the two
 * for six hours every day and file a late-night rickshaw fare into the
 * wrong month. Fixing the offset here makes "today" identical everywhere,
 * and makes month filtering an exact, index-friendly string prefix.       */

const DHAKA_OFFSET_MS = 6 * 60 * 60_000;

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dhakaNow = (now = Date.now()) => new Date(now + DHAKA_OFFSET_MS);

export const today = (now) => dhakaNow(now).toISOString().slice(0, 10);

export const currentMonth = (now) => today(now).slice(0, 7);

/** 0–23 in Dhaka, for the greeting. */
export const dhakaHour = (now) => dhakaNow(now).getUTCHours();

export function greeting(hour) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= daysInMonth(value.slice(0, 7)) && y >= 2000;
}

export function isIsoMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const m = Number(value.slice(5, 7));
  return m >= 1 && m <= 12;
}

export function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Sunday, for the first day of `month`. */
export function firstWeekday(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

/** addMonths('2026-01', -1) → '2025-12' */
export function addMonths(month, delta) {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + delta;
  const newMonth = ((index % 12) + 12) % 12;
  return `${year + Math.floor(index / 12)}-${String(newMonth + 1).padStart(2, "0")}`;
}

/** Whole days from `from` to `to`, both 'YYYY-MM-DD'. */
export function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** `count` consecutive months starting at `start`, inclusive. */
export const monthRange = (start, count) =>
  Array.from({ length: Math.max(0, count) }, (_, i) => addMonths(start, i));

/** The last `count` months ending at (and including) `end`. */
export const trailingMonths = (end, count) =>
  monthRange(addMonths(end, -(count - 1)), count);

/** 'Jun 17' */
export const formatDayMonth = (date) =>
  `${MONTH_SHORT[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;

/** '17 Jun 2026' */
export const formatFullDate = (date) =>
  `${Number(date.slice(8, 10))} ${MONTH_SHORT[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** 'Jun 2026' */
export const formatMonth = (month) =>
  `${MONTH_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** 'Jun' — matrix column headers, where the year is implied by the range. */
export const formatMonthShort = (month) => MONTH_SHORT[Number(month.slice(5, 7)) - 1];

/* ------------------------------------------------------------------ *
 * Categories                                                          *
 * ------------------------------------------------------------------ *
 * Localised to Bangladeshi student life: mess bills, rickshaw fares,
 * mobile recharge and photocopies — not "Groceries" and "Utilities".
 *
 * `slot` is the category's fixed chart colour (1–7, see globals.css).
 * Colour follows the category, never its rank, so "Food" is the same
 * orange on every page and every month. "Other" is deliberately grey.  */

export const EXPENSE_CATEGORIES = [
  { id: "Mess Bill", label: "Mess Bill", short: "Mess", slot: 1 },
  { id: "Rickshaw Fare", label: "Rickshaw & Transport", short: "Transport", slot: 2 },
  { id: "Food", label: "Food & Snacks", short: "Food", slot: 3 },
  { id: "Mobile Recharge", label: "Recharge & Data", short: "Recharge", slot: 4 },
  { id: "Photocopy/Print", label: "Photocopy & Books", short: "Study", slot: 5 },
  { id: "Tuition", label: "Tuition & Fees", short: "Tuition", slot: 6 },
  { id: "Hangout", label: "Hangout & Outing", short: "Hangout", slot: 7 },
  { id: "Other", label: "Other Expense", short: "Other", slot: 0 },
];

export const INCOME_CATEGORIES = [
  { id: "Family Support", label: "Family Support", short: "Family" },
  { id: "Tutoring", label: "Tuition (I teach)", short: "Tutoring" },
  { id: "Stipend", label: "Stipend / Scholarship", short: "Stipend" },
  { id: "Part-time Job", label: "Part-time / Freelance", short: "Job" },
  { id: "Other Income", label: "Other Income", short: "Other" },
];

const CATEGORY_INDEX = new Map([
  ...EXPENSE_CATEGORIES.map((c) => [c.id, { ...c, type: "expense" }]),
  ...INCOME_CATEGORIES.map((c) => [c.id, { ...c, type: "income", slot: 0 }]),
]);

export const categoriesFor = (type) =>
  type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

/** Falls back to the raw id, so a retired category still reads sensibly. */
export const categoryLabel = (id) => CATEGORY_INDEX.get(id)?.label ?? id;
export const categoryShort = (id) => CATEGORY_INDEX.get(id)?.short ?? id;
export const categorySlot = (id) => CATEGORY_INDEX.get(id)?.slot ?? 0;

/** Fixed display order, used to keep chart segments in a validated sequence. */
export const categoryOrder = (id) => {
  const index = EXPENSE_CATEGORIES.findIndex((c) => c.id === id);
  return index === -1 ? 99 : index;
};

export function isValidCategory(id, type) {
  const found = CATEGORY_INDEX.get(id);
  if (!found) return false;
  return type ? found.type === type : true;
}

/* ------------------------------------------------------------------ *
 * Payment methods                                                     *
 * ------------------------------------------------------------------ *
 * Half of a Dhaka student's money moves through mobile wallets, so
 * "how did I pay" matters as much as "what for".                       */

export const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "bkash", label: "bKash" },
  { id: "nagad", label: "Nagad" },
  { id: "rocket", label: "Rocket" },
  { id: "card", label: "Card" },
  { id: "bank", label: "Bank" },
];

const METHOD_LABELS = new Map(PAYMENT_METHODS.map((m) => [m.id, m.label]));

export const methodLabel = (id) => METHOD_LABELS.get(id) ?? id;
export const isValidMethod = (id) => METHOD_LABELS.has(id);

/* ------------------------------------------------------------------ *
 * Navigation + misc                                                   *
 * ------------------------------------------------------------------ */

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: "home" },
  { href: "/transactions", label: "Ledger", short: "Ledger", icon: "receipt" },
  { href: "/budget", label: "Budget", short: "Budget", icon: "target" },
  { href: "/goals", label: "Goals", short: "Goals", icon: "flag" },
  { href: "/insights", label: "Insights", short: "Insights", icon: "chart" },
  { href: "/semester", label: "Semester", short: "Semester", icon: "calendar" },
];

export const isActivePath = (pathname, href) =>
  pathname === href || pathname.startsWith(href + "/");

/**
 * Only same-origin paths survive as a post-login destination. "//evil.com" and
 * "/\evil.com" are protocol-relative to a browser, so they are rejected too —
 * otherwise the login page becomes an open redirect.
 */
export function safeNextPath(value, fallback = "/dashboard") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value.length > 200 ? fallback : value;
}

/** Joins class names, dropping anything falsy. */
export const cx = (...parts) => parts.filter(Boolean).join(" ");

/** Initial state for every `useActionState` form. */
export const IDLE = { status: "idle" };

/** "Maruf Ahamed" → "MA" */
export function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase();
}
