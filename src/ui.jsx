import Link from "next/link";

import { cx } from "@/utils";

/**
 * Small presentational pieces shared across the five pages. Nothing here is a
 * client component, so it all renders on the server.
 */

/* ------------------------------------------------------------------ *
 * Icons                                                               *
 * ------------------------------------------------------------------ *
 * Inlined rather than pulled from a CDN like the original prototype: a few
 * hundred bytes, renders on the server, and works with no connection.   */

const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2-2-1.33" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  chart: (
    <>
      <path d="M21 12A9 9 0 1 1 12 3v9z" />
      <path d="M15.5 3.9A9 9 0 0 1 20.1 8.5L12 12z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  wallet: (
    <>
      <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6" />
      <circle cx="16.5" cy="14" r="1.25" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  up: <path d="M7 17 17 7M9 7h8v8" />,
  down: <path d="M7 7l10 10M17 9v8H9" />,
  inbox: (
    <>
      <path d="M21 12h-5l-2 3h-4l-2-3H3" />
      <path d="M5.5 5h13l2.5 7v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z" />
    </>
  ),
};

export function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Page shell                                                          *
 * ------------------------------------------------------------------ */

export function PageTitle({ title, subtitle }) {
  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      {subtitle && <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className }) {
  return <section className={cx("card", className)}>{children}</section>;
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <h2 className="text-[0.8125rem] font-semibold text-ink">{title}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bits                                                                *
 * ------------------------------------------------------------------ */

const TONE = {
  neutral: "bg-surface-2 text-ink-muted",
  ok: "bg-income-wash text-income",
  warn: "bg-warn-wash text-warn",
  over: "bg-expense-wash text-expense",
  accent: "bg-accent-wash text-accent",
};

export function Badge({ children, tone = "neutral" }) {
  return (
    <span
      className={cx(
        "inline-block rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold",
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

const BAR = { ok: "bg-income", warn: "bg-warn", over: "bg-expense" };

/**
 * `value` is the true percentage and may exceed 100 — the fill is clamped but
 * the label beside it is not, so a 140% overspend reads as 140% on a full bar
 * rather than being flattened to a comfortable-looking 100%.
 */
export function ProgressBar({ value, tone = "ok", label }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cx("h-full origin-left rounded-full animate-grow", BAR[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, description }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
      <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-muted">
        <Icon name={icon} />
      </span>
      <p className="text-[0.8125rem] font-semibold text-ink">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-ink-muted">{description}</p>
      )}
    </div>
  );
}

export function Alert({ tone = "over", children }) {
  return (
    <div
      role="status"
      className={cx(
        "flex items-start gap-2 rounded-md px-3 py-2 text-[0.8125rem]",
        TONE[tone],
      )}
    >
      <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-ink">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Buttons                                                             *
 * ------------------------------------------------------------------ */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-[0.8125rem] font-medium " +
  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const BUTTON_VARIANT = {
  primary:
    "h-9 px-3.5 bg-navy-900 text-white hover:bg-navy-800 dark:bg-gold-500 dark:text-navy-950 dark:hover:bg-gold-400",
  secondary: "h-9 px-3 border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "h-8 px-2 text-ink-muted hover:text-ink hover:bg-surface-2",
};

export function Button({ variant = "primary", className, children, ...props }) {
  return (
    <button className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "secondary", className, children, ...props }) {
  return (
    <Link className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], className)} {...props}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * Form field                                                          *
 * ------------------------------------------------------------------ */

/**
 * Wraps a control with its label and error, wiring aria-invalid and
 * aria-describedby so a screen reader announces the message with the field
 * rather than as loose text elsewhere on the page. `children` is a render
 * function so the caller still owns the input itself.
 */
export function Field({ name, label, hint, error, children, className }) {
  const id = `f-${name}`;
  const messageId = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cx("min-w-0", className)}>
      <label className="label" htmlFor={id}>
        {label}
      </label>

      {children({
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": messageId,
        className: cx("field", error && "border-expense!"),
      })}

      {error ? (
        <p id={messageId} className="mt-1 text-xs text-expense">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
