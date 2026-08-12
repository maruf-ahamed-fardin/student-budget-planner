/**
 * Pure helpers shared by the server and the browser: money, dates, categories,
 * navigation. Nothing here touches the database or the DOM.
 */

/* ------------------------------------------------------------------ *
 * Money — integer poisha (1 Taka = 100 poisha)                        *
 * ------------------------------------------------------------------ *
 * Amounts are never held as floating-point Taka. That is how budget
 * totals drift by a poisha and stop reconciling with the ledger.       */

export class MoneyError extends Error {}

/** Parse form input ("500", "12.50") into integer poisha. */
export function toPoisha(input) {
  const raw = String(input).trim().replace(/,/g, "");

  if (raw === "") throw new MoneyError("Amount is required.");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new MoneyError("Enter a valid amount, like 500 or 12.50.");
  }

  const [takaPart, poishaPart = ""] = raw.split(".");
  const poisha = Number(takaPart) * 100 + Number(poishaPart.padEnd(2, "0"));

  if (poisha <= 0) throw new MoneyError("Amount must be greater than zero.");
  if (poisha > 10_000_000_000) throw new MoneyError("That amount is too large.");

  return poisha;
}

/** Poisha to a Taka number — for chart datasets only, never for maths. */
export const toTaka = (poisha) => poisha / 100;

/**
 * Western digit grouping (8,200 / 19,450) to match the mockup. Hand-rolled
 * rather than Intl so the server and the browser can never disagree about
 * locale data and mismatch on every figure during hydration.
 */
function groupDigits(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Whole Taka render without decimals ("৳8,200"); amounts carrying poisha
 * render with exactly two ("৳12.50").
 */
export function formatTaka(poisha, { symbol = true } = {}) {
  const negative = poisha < 0;
  const abs = Math.abs(Math.round(poisha));

  let body = groupDigits(String(Math.floor(abs / 100)));
  const rest = abs % 100;
  if (rest !== 0) body += "." + String(rest).padStart(2, "0");
  if (symbol) body = "৳" + body;

  return negative ? "−" + body : body;
}

/** "+৳5,000" / "−৳500" for transaction rows. */
export function formatSigned(poisha, type) {
  return (type === "income" ? "+" : "−") + formatTaka(Math.abs(poisha));
}

/** Percentage of `part` against `whole`; null when there is no denominator. */
export function percentOf(part, whole) {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function formatPercent(value, fallback = "—") {
  return value === null || !Number.isFinite(value)
    ? fallback
    : `${Math.round(value)}%`;
}

/* ------------------------------------------------------------------ *
 * Dates — 'YYYY-MM-DD' strings and 'YYYY-MM' months, never Date       *
 * ------------------------------------------------------------------ *
 * The server may run in UTC while the student's phone runs Asia/Dhaka
 * (UTC+6, no DST). A Date-derived "today" would disagree between the two
 * for six hours every day and file a late-night rickshaw fare into the
 * wrong month. Fixing the offset here makes "today" identical everywhere,
 * and makes month filtering an exact, index-friendly string prefix.       */

const DHAKA_OFFSET_MINUTES = 6 * 60;

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function today() {
  return new Date(Date.now() + DHAKA_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);
}

export const currentMonth = () => today().slice(0, 7);

export function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isIsoMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const m = Number(value.slice(5, 7));
  return m >= 1 && m <= 12;
}

/** addMonths('2026-01', -1) → '2025-12' */
export function addMonths(month, delta) {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + delta;
  const newMonth = ((index % 12) + 12) % 12;
  return `${year + Math.floor(index / 12)}-${String(newMonth + 1).padStart(2, "0")}`;
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
export const formatMonthShort = (month) =>
  MONTH_SHORT[Number(month.slice(5, 7)) - 1];

/* ------------------------------------------------------------------ *
 * Categories                                                          *
 * ------------------------------------------------------------------ *
 * Localised to Bangladeshi student life, carried over from the team's
 * original prototype: mess bills, rickshaw fares, mobile recharge and
 * photocopy costs — not "Groceries" and "Utilities".                   */

export const EXPENSE_CATEGORIES = [
  { id: "Mess Bill", label: "Mess Bill" },
  { id: "Rickshaw Fare", label: "Rickshaw / Transport" },
  { id: "Mobile Recharge", label: "Mobile Recharge" },
  { id: "Photocopy/Print", label: "Photocopy / Print" },
  { id: "Food", label: "Food & Snacks" },
  { id: "Tuition", label: "Tuition Fee" },
  { id: "Other", label: "Other Expense" },
];

export const INCOME_CATEGORIES = [
  { id: "Family Support", label: "Family Support" },
  { id: "Tutoring", label: "Tutoring" },
  { id: "Stipend", label: "Stipend / Scholarship" },
  { id: "Other Income", label: "Other Income" },
];

const LABELS = new Map(
  [
    ...EXPENSE_CATEGORIES.map((c) => [c.id, { ...c, type: "expense" }]),
    ...INCOME_CATEGORIES.map((c) => [c.id, { ...c, type: "income" }]),
  ],
);

export const categoriesFor = (type) =>
  type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

/** Falls back to the raw id, so a retired category still reads sensibly. */
export const categoryLabel = (id) => LABELS.get(id)?.label ?? id;

export function isValidCategory(id, type) {
  const found = LABELS.get(id);
  if (!found) return false;
  return type ? found.type === type : true;
}

/* ------------------------------------------------------------------ *
 * Navigation + misc                                                   *
 * ------------------------------------------------------------------ */

/** The five pages from the mockup, in the mockup's order. */
export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", short: "Home", icon: "dashboard" },
  { href: "/transactions", label: "Transactions", short: "Ledger", icon: "receipt" },
  { href: "/budget", label: "Budget", short: "Budget", icon: "target" },
  { href: "/charts", label: "Charts", short: "Charts", icon: "chart" },
  { href: "/semester", label: "Semester", short: "Semester", icon: "calendar" },
];

/** "/" matches exactly; the others also match their sub-routes. */
export const isActivePath = (pathname, href) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

/** Joins class names, dropping anything falsy. */
export const cx = (...parts) => parts.filter(Boolean).join(" ");

/** Initial state for every `useActionState` form. */
export const IDLE = { status: "idle" };
