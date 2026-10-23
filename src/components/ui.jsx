import Link from "next/link";

import { Icon } from "@/components/icons";
import { cx, formatSigned, formatTaka } from "@/lib/utils";

/**
 * Presentational pieces shared across pages. None of them is a client
 * component, so they render to plain HTML on the server and ship no JS.
 */

/* ------------------------------------------------------------------ *
 * Page shell                                                          *
 * ------------------------------------------------------------------ */

/** `note` is a hand-written aside in the margin — the student's own voice. */
export function PageHeader({ eyebrow, title, note, action }) {
  return (
    <header className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-[1.9rem] leading-[1.05] font-extrabold sm:text-[2.4rem]">{title}</h1>
        {note && <p className="hand mt-1.5 -rotate-1 text-[1.35rem] text-ink-2">{note}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function Card({ children, className, i, flat = false, as: Tag = "section", ...props }) {
  return (
    <Tag
      className={cx(flat ? "card-flat" : "card", i !== undefined && "rise", className)}
      style={i !== undefined ? { "--i": i } : undefined}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHead({ title, hint, action, className }) {
  return (
    <div className={cx("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-base leading-tight font-bold">{title}</h2>
        {hint && <p className="mt-0.5 text-[0.8125rem] text-ink-3">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bits                                                                *
 * ------------------------------------------------------------------ */

const PILL = {
  neutral: "bg-card-2 text-ink-2",
  green: "bg-green-wash text-green",
  red: "bg-red-wash text-red",
  amber: "bg-amber-wash text-amber",
  ink: "bg-ink text-paper",
  hl: "bg-hl text-[#1a1915]",
};

export function Pill({ tone = "neutral", children, className }) {
  return <span className={cx("pill", PILL[tone], className)}>{children}</span>;
}

/** Budget status never rests on colour alone: icon + word + colour. */
const STATUS = {
  ok: { tone: "green", icon: "check", label: "On track" },
  warn: { tone: "amber", icon: "warning", label: "Close" },
  over: { tone: "red", icon: "warning", label: "Over" },
};

export function StatusPill({ status }) {
  const s = STATUS[status];
  return (
    <Pill tone={s.tone}>
      <Icon name={s.icon} size={11} strokeWidth={2.6} />
      {s.label}
    </Pill>
  );
}

const METER = { ok: "bg-green", warn: "bg-amber", over: "bg-red", ink: "bg-ink", hl: "bg-hl" };

/**
 * `value` is the true percentage and may exceed 100 — the fill is clamped but
 * the label beside it is not, so a 140% overspend reads as 140% on a full bar
 * rather than being flattened to a comfortable-looking 100%.
 */
export function Meter({ value, tone = "ok", label, i = 0, height = "h-2.5" }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div
      className={cx("w-full overflow-hidden rounded-full border-[1.5px] border-edge bg-card-2", height)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cx("grow-x h-full rounded-full", METER[tone])}
        style={{ width: `${clamped}%`, "--i": i }}
      />
    </div>
  );
}

export function Empty({ icon = "inbox", title, body, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 -rotate-3 place-items-center rounded-xl border-[1.5px] border-dashed border-ink-3 text-ink-3">
        <Icon name={icon} size={22} />
      </span>
      <p className="mt-4 text-[0.9375rem] font-bold">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const NOTICE = {
  red: "bg-red-wash border-red text-red",
  amber: "bg-amber-wash border-amber text-amber",
  green: "bg-green-wash border-green text-green",
  hl: "bg-hl/30 border-edge text-ink",
};

export function Notice({ tone = "red", icon = "warning", children, className }) {
  return (
    <div
      role="status"
      className={cx("flex items-start gap-3 rounded-xl border-[1.5px] px-4 py-3 text-sm", NOTICE[tone], className)}
    >
      <Icon name={icon} size={18} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1 text-ink">{children}</div>
    </div>
  );
}

/** Money with its sign coloured: green in, red out. */
export function Money({ poisha, type, className }) {
  return (
    <span
      className={cx(
        "tnum font-semibold whitespace-nowrap",
        type === "income" ? "text-green" : type === "expense" ? "text-red" : "",
        className,
      )}
    >
      {type ? formatSigned(poisha, type) : formatTaka(poisha)}
    </span>
  );
}

/** The category's chart colour, as a small square key. */
export function Swatch({ slot, className }) {
  return (
    <span
      aria-hidden="true"
      className={cx("inline-block size-2.5 shrink-0 rounded-[3px]", className)}
      style={{ backgroundColor: `var(--series-${slot})` }}
    />
  );
}

export function TextLink({ href, children, className }) {
  return (
    <Link
      href={href}
      className={cx(
        "-my-2.5 inline-flex items-center gap-1 py-2.5 text-[0.8125rem] font-semibold text-ink-2 underline decoration-ink-3/40 decoration-[1.5px] underline-offset-4 hover:text-ink hover:decoration-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * A figure whose digits roll into place (see `.odo` in globals.css). Screen
 * readers get the plain text once via aria-label; the strips are hidden.
 */
export function Odometer({ value, className }) {
  const chars = [...value];
  // Each digit's place among the digits alone, for the staggered roll.
  const column = chars.map((_, i) => chars.slice(0, i).filter((c) => /\d/.test(c)).length);
  return (
    <span className={cx("odo tnum", className)} aria-label={value} role="text">
      {chars.map((char, index) =>
        /\d/.test(char) ? (
          <span key={index} className="odo-col" aria-hidden="true">
            <span className="odo-strip" style={{ "--d": Number(char), "--c": column[index] }}>
              {DIGITS}
            </span>
          </span>
        ) : (
          <span key={index} aria-hidden="true">
            {char}
          </span>
        ),
      )}
    </span>
  );
}

const DIGITS = Array.from({ length: 10 }, (_, d) => <span key={d}>{d}</span>);
