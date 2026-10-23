"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { changePassword, deleteAccount, signOutEverywhere, updateProfile } from "@/app/actions/account";
import { login, logout, signup, startDemo } from "@/app/actions/auth";
import { createGoal, createSemester, moveGoalMoney, setBudgetLimit } from "@/app/actions/ledger";
import { Field, FormError, SubmitButton, useAction } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import {
  currentMonth,
  cx,
  EXPENSE_CATEGORIES,
  formatMonth,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Auth                                                                *
 * ------------------------------------------------------------------ */

export function LoginForm({ next }) {
  const { state, formAction, errors, values, resetKey } = useAction(login);

  return (
    <form action={formAction} className="space-y-4" key={resetKey}>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="email" label="Email" error={errors.email}>
        {(props) => (
          <input {...props} type="email" autoComplete="email" required defaultValue={values.email ?? ""} autoFocus />
        )}
      </Field>
      <PasswordField name="password" label="Password" error={errors.password} autoComplete="current-password" />
      {state.status === "error" && !state.fieldErrors && (
        <p role="alert" className="rounded-lg bg-red-wash px-3 py-2 text-[0.8125rem] font-medium text-red">
          {state.message}
        </p>
      )}
      <SubmitButton className="h-12 w-full text-[0.9375rem]" pendingLabel="Checking…">
        Log in
        <Icon name="arrow" size={17} />
      </SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const { state, formAction, errors, values, resetKey } = useAction(signup);

  return (
    <form action={formAction} className="space-y-4" key={resetKey}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Your name" error={errors.name}>
          {(props) => <input {...props} autoComplete="name" required maxLength={60} defaultValue={values.name ?? ""} autoFocus />}
        </Field>
        <Field name="university" label="University (optional)" error={errors.university}>
          {(props) => (
            <input {...props} autoComplete="organization" maxLength={80} placeholder="e.g. Uttara University" defaultValue={values.university ?? ""} />
          )}
        </Field>
      </div>
      <Field name="email" label="Email" error={errors.email}>
        {(props) => <input {...props} type="email" autoComplete="email" required defaultValue={values.email ?? ""} />}
      </Field>
      <PasswordField
        name="password"
        label="Password"
        error={errors.password}
        autoComplete="new-password"
        hint="8+ characters. A short sentence works great."
        meter
      />
      <FormError state={state} />
      <SubmitButton className="h-12 w-full text-[0.9375rem]" pendingLabel="Creating your ledger…">
        Create my account
        <Icon name="arrow" size={17} />
      </SubmitButton>
    </form>
  );
}

/** A password input with a show/hide toggle and an optional strength hint. */
function PasswordField({ name, label, error, hint, autoComplete, meter = false }) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const score = strength(value);

  return (
    <Field name={name} label={label} error={error} hint={meter && value ? undefined : hint}>
      {(props) => (
        <>
          <div className="relative">
            <input
              {...props}
              className={cx(props.className, "pr-12")}
              type={visible ? "text" : "password"}
              autoComplete={autoComplete}
              required
              maxLength={128}
              onChange={meter ? (e) => setValue(e.target.value) : undefined}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute top-1/2 right-1.5 grid h-9 -translate-y-1/2 place-items-center rounded-md px-2.5 font-mono text-[0.6875rem] font-semibold text-ink-3 uppercase hover:bg-card-2 hover:text-ink"
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? "Hide" : "Show"}
            </button>
          </div>
          {meter && value && !error && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cx(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i < score ? ["bg-red", "bg-amber", "bg-green", "bg-green"][score - 1] : "bg-rule",
                    )}
                  />
                ))}
              </div>
              <span className="font-mono text-[0.6875rem] font-semibold text-ink-3 uppercase">
                {["Too short", "Weak", "Okay", "Good", "Strong"][score]}
              </span>
            </div>
          )}
        </>
      )}
    </Field>
  );
}

/** A rough nudge, not a gate — the server's passwordProblem() is the gate. */
function strength(pw) {
  if (pw.length < 8) return 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

export function DemoButton({ className, children = "Try the demo" }) {
  return (
    <form action={startDemo} className={className}>
      <DemoSubmit>{children}</DemoSubmit>
    </form>
  );
}

function DemoSubmit({ children }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-hl h-12 w-full px-5 text-[0.9375rem]">
      {pending ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Setting up your sandbox…
        </>
      ) : (
        <>
          <Icon name="bolt" size={17} strokeWidth={2.2} />
          {children}
        </>
      )}
    </button>
  );
}

export function LogoutButton({ className, labelClassName }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        title="Log out"
        className={cx("flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink-2 hover:bg-red-wash hover:text-red", className)}
      >
        <Icon name="logout" size={17} className="shrink-0" />
        <span className={labelClassName}>Log out</span>
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Budget                                                              *
 * ------------------------------------------------------------------ */

export function BudgetLimitForm({ limits }) {
  const { formAction, errors, resetKey } = useAction(setBudgetLimit);
  const [category, setCategory] = useState("");
  const existing = limits[category];

  return (
    <form action={formAction} className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={resetKey}>
      <Field name="category" label="Category" error={errors.category}>
        {(props) => (
          <select {...props} required value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" disabled>
              Choose…
            </option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {limits[c.id] ? " (has a limit)" : ""}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field name="limit" label="Monthly limit (৳)" error={errors.limit}>
        {(props) => (
          <input
            {...props}
            key={category}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={existing ? existing : "2000"}
            defaultValue={existing ?? ""}
            required
          />
        )}
      </Field>
      <SubmitButton pendingLabel="Saving…" className="h-11">
        {existing ? "Update limit" : "Set limit"}
      </SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Goals                                                               *
 * ------------------------------------------------------------------ */

export function GoalForm({ today }) {
  const { formAction, errors, resetKey } = useAction(createGoal);

  return (
    <form action={formAction} className="space-y-4 p-5" key={resetKey}>
      <Field name="name" label="Saving for" error={errors.name}>
        {(props) => <input {...props} required maxLength={50} placeholder="e.g. New laptop, Sajek trip" autoComplete="off" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="target" label="Target (৳)" error={errors.target}>
          {(props) => <input {...props} type="text" inputMode="decimal" required placeholder="15000" autoComplete="off" />}
        </Field>
        <Field name="deadline" label="By (optional)" error={errors.deadline}>
          {(props) => <input {...props} type="date" min={today} />}
        </Field>
      </div>
      <SubmitButton className="w-full" pendingLabel="Creating…">
        <Icon name="flag" size={16} />
        Start this goal
      </SubmitButton>
    </form>
  );
}

/** Save into, or take out of, one goal. */
export function GoalMoneyForm({ goalId, name }) {
  const { formAction, errors, resetKey } = useAction(moveGoalMoney);
  const [direction, setDirection] = useState("in");

  return (
    <form action={formAction} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]" key={resetKey}>
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="direction" value={direction} />
      <div className="segmented col-span-2 p-[3px]! sm:col-span-1">
        {[
          ["in", "plus", "Save"],
          ["out", "minus", "Take out"],
        ].map(([value, icon, text]) => (
          <label key={value} className="min-h-8! px-2.5! text-xs! whitespace-nowrap">
            <input
              type="radio"
              name={`dir-${goalId}`}
              checked={direction === value}
              onChange={() => setDirection(value)}
              className="sr-only"
            />
            <Icon name={icon} size={13} strokeWidth={2.6} />
            {text}
          </label>
        ))}
      </div>
      <div className="min-w-0">
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          required
          placeholder="৳ amount"
          aria-label={`Amount to ${direction === "in" ? "save towards" : "take out of"} ${name}`}
          aria-invalid={errors.amount ? true : undefined}
          className="field h-10!"
        />
        {errors.amount && <p className="mt-1 text-xs font-medium text-red">{errors.amount}</p>}
      </div>
      <SubmitButton className="btn-sm h-10!" pendingLabel="…">
        {direction === "in" ? "Add" : "Withdraw"}
      </SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Semester                                                            *
 * ------------------------------------------------------------------ */

export function SemesterForm() {
  const { formAction, errors, resetKey } = useAction(createSemester);

  return (
    <form action={formAction} className="grid gap-4 p-5 sm:grid-cols-[2fr_1.3fr_0.8fr_auto] sm:items-end" key={resetKey}>
      <Field name="name" label="Name" error={errors.name}>
        {(props) => <input {...props} required maxLength={60} placeholder="e.g. Spring 2027" autoComplete="off" />}
      </Field>
      <Field name="startMonth" label="Starts" error={errors.startMonth}>
        {(props) => <input {...props} type="month" defaultValue={currentMonth()} required />}
      </Field>
      <Field name="months" label="Months" error={errors.months}>
        {(props) => <input {...props} type="number" min={1} max={12} defaultValue={4} required />}
      </Field>
      <SubmitButton pendingLabel="Adding…" className="h-11">
        Add
      </SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Settings                                                            *
 * ------------------------------------------------------------------ */

export function ProfileForm({ user }) {
  const { formAction, errors } = useAction(updateProfile);

  return (
    <form action={formAction} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Name" error={errors.name}>
          {(props) => <input {...props} required maxLength={60} defaultValue={user.name} disabled={user.isDemo} />}
        </Field>
        <Field name="university" label="University" error={errors.university}>
          {(props) => <input {...props} maxLength={80} defaultValue={user.university} disabled={user.isDemo} />}
        </Field>
      </div>
      <Field name="email" label="Email" hint="Used to log in. It can't be changed yet.">
        {(props) => <input {...props} value={user.isDemo ? "demo sandbox" : user.email} readOnly disabled />}
      </Field>
      <SubmitButton pendingLabel="Saving…" disabled={user.isDemo}>
        Save profile
      </SubmitButton>
    </form>
  );
}

export function PasswordForm({ disabled }) {
  const { formAction, errors, resetKey } = useAction(changePassword);

  return (
    <form action={formAction} className="space-y-4 p-5" key={resetKey}>
      <Field name="current" label="Current password" error={errors.current}>
        {(props) => <input {...props} type="password" autoComplete="current-password" required disabled={disabled} />}
      </Field>
      <Field name="next" label="New password" error={errors.next} hint="Changing it signs out every other device.">
        {(props) => <input {...props} type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={disabled} />}
      </Field>
      <SubmitButton pendingLabel="Updating…" disabled={disabled}>
        <Icon name="lock" size={16} />
        Change password
      </SubmitButton>
    </form>
  );
}

export function SignOutEverywhereForm({ others }) {
  const { formAction } = useAction(signOutEverywhere);

  return (
    <form action={formAction}>
      <SubmitButton variant="" className="btn-sm" pendingLabel="Signing out…" disabled={others === 0}>
        <Icon name="logout" size={15} />
        Sign out other devices
      </SubmitButton>
    </form>
  );
}

export function DeleteAccountForm({ isDemo }) {
  const { formAction, errors } = useAction(deleteAccount);
  const [typed, setTyped] = useState("");

  return (
    <form action={formAction} className="space-y-4 p-5">
      <p className="text-sm text-ink-2">
        This erases your account and every entry, limit, goal and semester in it. There is no undo and no
        backup. Export your ledger first if you want to keep it.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="confirm" label='Type "DELETE"' error={errors.confirm}>
          {(props) => <input {...props} autoComplete="off" required value={typed} onChange={(e) => setTyped(e.target.value)} />}
        </Field>
        {!isDemo && (
          <Field name="password" label="Your password" error={errors.password}>
            {(props) => <input {...props} type="password" autoComplete="current-password" required />}
          </Field>
        )}
      </div>
      <SubmitButton variant="btn-danger" pendingLabel="Deleting…" disabled={typed !== "DELETE"}>
        <Icon name="trash" size={16} />
        Delete my account forever
      </SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Ledger filters                                                      *
 * ------------------------------------------------------------------ */

/**
 * Filters live in the URL, so the server component re-runs the query and the
 * filtered list is genuinely server-rendered — shareable, and correct with the
 * back button. This component only writes the query string.
 */
export function LedgerFilters({ months, initial }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(initial.search);
  const [pending, startTransition] = useTransition();

  function navigate(patch) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page"); // a new filter starts from the first page
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  // Debounced: re-querying on every keystroke would hit the database per letter.
  useEffect(() => {
    if (search === initial.search) return;
    const timer = setTimeout(() => navigate({ q: search.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const active = [initial.type, initial.category, initial.method, initial.month, initial.search].filter(Boolean).length;

  return (
    <div className={cx("space-y-3 border-b-[1.5px] border-dashed border-rule p-4 transition-opacity", pending && "opacity-60")}>
      <div className="relative">
        <Icon name="search" size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          aria-label="Search notes and categories"
          placeholder="Search — biriyani, rickshaw…"
          className="field pl-10"
          value={search}
          maxLength={60}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <FilterSelect label="Type" value={initial.type} onChange={(v) => navigate({ type: v, category: "" })}>
          <option value="">All types</option>
          <option value="expense">Money out</option>
          <option value="income">Money in</option>
        </FilterSelect>

        <FilterSelect label="Category" value={initial.category} onChange={(v) => navigate({ category: v })}>
          <option value="">All categories</option>
          {(initial.type !== "income" ? EXPENSE_CATEGORIES : []).map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
          {(initial.type !== "expense" ? INCOME_CATEGORIES : []).map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect label="Paid via" value={initial.method} onChange={(v) => navigate({ method: v })}>
          <option value="">Any method</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect label="Month" value={initial.month} onChange={(v) => navigate({ month: v })}>
          <option value="">All time</option>
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </FilterSelect>

        {active > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm col-span-2 h-10! shrink-0"
            onClick={() => {
              setSearch("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            <Icon name="close" size={14} />
            Clear {active}
          </button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx("field h-10! min-w-0 text-sm sm:w-auto sm:shrink-0", value && "border-edge! bg-hl/25 font-semibold")}
    >
      {children}
    </select>
  );
}

/** A select that navigates — used for the month and semester pickers. */
export function QueryPicker({ name, label, value, options }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label={label}
      className={cx("field h-10! w-auto min-w-40 font-semibold", pending && "opacity-60")}
      value={value}
      onChange={(event) => {
        const next = new URLSearchParams(params);
        next.set(name, event.target.value);
        startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function AuthSwitch({ href, children }) {
  return (
    <Link href={href} className="font-semibold text-ink underline decoration-hl decoration-[3px] underline-offset-4 hover:decoration-ink">
      {children}
    </Link>
  );
}
