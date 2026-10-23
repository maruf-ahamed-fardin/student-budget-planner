import Link from "next/link";

import { SpendCalendar } from "@/components/charts";
import { Icon } from "@/components/icons";
import { AddEntryButton } from "@/components/tx-dialog";
import { Card, CardHead, Empty, Meter, Money, Notice, Odometer, PageHeader, Pill, StatusPill, TextLink } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { safeToSpend } from "@/lib/insights";
import {
  getBudgetOverview,
  getDailySpending,
  getGoals,
  getRecentTransactions,
  getSavedTotal,
  getSummary,
} from "@/lib/queries";
import {
  addMonths,
  categoryLabel,
  currentMonth,
  daysInMonth,
  dhakaHour,
  formatDayMonth,
  formatFullDate,
  formatMonth,
  formatPercent,
  formatTaka,
  greeting,
  methodLabel,
  percentChange,
  percentOf,
  today,
  WEEKDAYS,
} from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const BASIS = {
  budget: "from what's left in your limits",
  income: "from this month's income left",
  wallet: "capped by what's actually in your wallet",
};

/**
 * Server Component: every figure is read from SQLite here and shipped as
 * finished HTML. The only JavaScript on this page belongs to the shell (the
 * add-entry dialog and navigation).
 */
export default async function DashboardPage({ searchParams }) {
  const user = await requireUser();
  const { welcome } = await searchParams;

  const date = today();
  const month = currentMonth();
  const dayOfMonth = Number(date.slice(8, 10));
  const days = daysInMonth(month);

  const all = getSummary(user.id);
  const thisMonth = getSummary(user.id, month);
  const lastMonth = getSummary(user.id, addMonths(month, -1));
  const budget = getBudgetOverview(user.id, month);
  const daily = getDailySpending(user.id, month);
  const recent = getRecentTransactions(user.id, 7);
  const goals = getGoals(user.id).slice(0, 3);
  const saved = getSavedTotal(user.id);

  const safe = safeToSpend({ budget, thisMonth, dayOfMonth, days, freePoisha: all.balancePoisha - saved });
  const spentToday = daily[dayOfMonth - 1] ?? 0;
  const outChange = percentChange(lastMonth.expensePoisha, thisMonth.expensePoisha);
  const spentShare = percentOf(thisMonth.expensePoisha, thisMonth.incomePoisha);
  const firstName = user.name.split(/\s+/)[0];
  const weekday = WEEKDAYS[new Date(date).getUTCDay()];

  const note =
    all.count === 0
      ? "start with today's rickshaw fare →"
      : spentToday === 0
        ? "nothing spent today. legend."
        : safe.perDayPoisha > 0 && spentToday > safe.perDayPoisha
          ? `today's ${formatTaka(spentToday)} is over your daily pace`
          : `${formatTaka(spentToday)} spent today — on pace`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${weekday} · ${formatFullDate(date)}`}
        title={
          <>
            {greeting(dhakaHour())}, <span className="hl">{firstName}</span>.
          </>
        }
        note={note}
        action={
          <>
            <a href="/api/export" className="btn btn-sm hidden sm:inline-flex" download>
              <Icon name="download" size={15} />
              Export CSV
            </a>
            <AddEntryButton className="btn btn-ink hidden md:inline-flex">
              <Icon name="plus" size={17} strokeWidth={2.4} />
              New entry
            </AddEntryButton>
          </>
        }
      />

      {welcome && (
        <Notice tone="green" icon="sparkle" className="rise">
          {welcome === "demo" ? (
            <>
              <strong>Welcome to the demo.</strong> This sandbox has six months of a real-feeling student&apos;s
              money. Add, edit or delete anything — it&apos;s yours alone. Tip: press{" "}
              <kbd className="rounded border border-rule bg-card px-1 font-mono text-xs">N</kbd> to add an entry.
            </>
          ) : (
            <>
              <strong>Your ledger is ready.</strong> Log what you spent today, then set a monthly limit or two on the
              Budget page.
            </>
          )}
        </Notice>
      )}

      {budget.overCount > 0 && (
        <Notice className="rise">
          <strong>
            {budget.overCount === 1
              ? `${categoryLabel(budget.rows.find((r) => r.status === "over").category)} is over budget`
              : `${budget.overCount} categories are over budget`}
          </strong>{" "}
          this month. <TextLink href="/budget">Review limits</TextLink>
        </Notice>
      )}

      {/* ---- Headline numbers ---- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <section
          className="rise relative overflow-hidden rounded-xl border-[1.5px] border-edge bg-ink p-5 text-paper shadow-[3px_3px_0_var(--shadow)] md:col-span-2 lg:col-span-5 dark:bg-card-2 dark:text-ink"
          style={{ "--i": 1 }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.12em] text-hl uppercase">
              Wallet balance
            </p>
            <Pill tone="hl">{all.count} entries</Pill>
          </div>
          <p className="mt-3 text-[2.6rem] leading-none font-bold sm:text-5xl">
            <Odometer value={formatTaka(all.balancePoisha)} />
          </p>
          <p className="mt-2 text-sm opacity-70">
            {saved > 0 ? (
              <>
                {formatTaka(saved)} parked in goals ·{" "}
                <span className="font-semibold opacity-100">{formatTaka(Math.max(0, all.balancePoisha - saved))} free</span>
              </>
            ) : (
              "Everything you've earned minus everything you've spent."
            )}
          </p>
          {/* A faint ৳ watermark, stamped crooked. */}
          <span aria-hidden="true" className="bn pointer-events-none absolute -right-4 -bottom-16 rotate-12 text-[11rem] leading-none font-bold opacity-[0.07]">
            ৳
          </span>
        </section>

        <section
          className="rise rounded-xl border-[1.5px] border-edge bg-hl p-5 text-[#1a1915] shadow-[3px_3px_0_var(--shadow)] lg:col-span-3"
          style={{ "--i": 2 }}
        >
          <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">Safe to spend</p>
          <p className="mt-3 text-4xl leading-none font-bold">
            <Odometer value={formatTaka(safe.perDayPoisha)} />
            <span className="ml-1 font-mono text-base font-semibold opacity-60">/day</span>
          </p>
          <p className="mt-2 text-sm">
            for the next {safe.daysLeft} day{safe.daysLeft === 1 ? "" : "s"}
            <span className="block text-xs opacity-70">
              {BASIS[safe.basis]}
            </span>
          </p>
        </section>

        <Card i={3} className="p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{formatMonth(month)}</p>
            {outChange !== null && (
              <Pill tone={outChange > 0 ? "red" : "green"}>
                <Icon name={outChange > 0 ? "up" : "down"} size={11} strokeWidth={2.6} />
                {Math.abs(Math.round(outChange))}% vs last month
              </Pill>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs font-semibold text-ink-3">Money in</dt>
              <dd className="tnum mt-0.5 text-xl font-bold text-green">{formatTaka(thisMonth.incomePoisha)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-3">Money out</dt>
              <dd className="tnum mt-0.5 text-xl font-bold text-red">{formatTaka(thisMonth.expensePoisha)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <Meter
              value={spentShare ?? 0}
              tone={spentShare === null ? "ink" : spentShare >= 100 ? "over" : spentShare >= 80 ? "warn" : "ok"}
              label="Share of this month's income spent"
              i={4}
            />
            <p className="mt-1.5 text-xs text-ink-3">
              {spentShare === null ? "Log this month's income to see how much is gone." : `${formatPercent(spentShare)} of this month's income spent`}
            </p>
          </div>
        </Card>
      </div>

      {/* ---- Calendar + budgets ---- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card i={4} className="lg:col-span-7">
          <CardHead
            title="Spending calendar"
            hint={`Every day of ${formatMonth(month)}, darker = more spent`}
            action={<TextLink href="/insights">Insights →</TextLink>}
          />
          <div className="px-5 pb-5">
            <SpendCalendar month={month} days={daily} today={date} />
          </div>
        </Card>

        <Card i={5} className="lg:col-span-5">
          <CardHead
            title="Budget check"
            hint={
              budget.rows.length
                ? `${formatTaka(budget.totalSpentPoisha)} of ${formatTaka(budget.totalLimitPoisha)} used`
                : "No limits yet"
            }
            action={<TextLink href="/budget">Manage →</TextLink>}
          />
          {budget.rows.length === 0 ? (
            <Empty
              icon="target"
              title="Set a limit on what leaks"
              body="Rickshaw and snacks are the usual suspects."
              action={<Link href="/budget" className="btn btn-sm">Set limits</Link>}
            />
          ) : (
            <ul className="space-y-4 px-5 pb-5">
              {[...budget.rows]
                .sort((a, b) => b.percent - a.percent)
                .slice(0, 5)
                .map((row, i) => (
                  <li key={row.category}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{categoryLabel(row.category)}</span>
                      <span className="flex items-center gap-2">
                        <span className="tnum text-xs text-ink-3">{formatPercent(row.percent)}</span>
                        <StatusPill status={row.status} />
                      </span>
                    </div>
                    <Meter value={row.percent} tone={row.status} label={`${categoryLabel(row.category)} budget used`} i={i} height="h-2" />
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ---- Receipt + goals ---- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card i={6} className="receipt-edge mb-2 lg:col-span-7">
          <div className="flex items-center justify-between border-b-[1.5px] border-dashed border-rule px-5 py-3">
            <div>
              <p className="font-mono text-xs font-bold tracking-[0.2em] uppercase">*** Recent ***</p>
              <p className="font-mono text-[0.6875rem] text-ink-3">
                {user.name.toUpperCase()} · {date}
              </p>
            </div>
            <TextLink href="/transactions">Full ledger →</TextLink>
          </div>

          {recent.length === 0 ? (
            <Empty
              title="Nothing on the receipt yet"
              body="Your first entry will print here."
              action={<AddEntryButton className="btn btn-sm btn-ink">Add the first one</AddEntryButton>}
            />
          ) : (
            <ul className="print px-2 py-2" style={{ "--i": 6 }}>
              {recent.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/transactions?category=${encodeURIComponent(row.category)}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-card-2"
                  >
                    <time dateTime={row.occurredOn} className="w-12 shrink-0 font-mono text-[0.6875rem] font-semibold text-ink-3 uppercase">
                      {formatDayMonth(row.occurredOn)}
                    </time>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{row.description || categoryLabel(row.category)}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {categoryLabel(row.category)} · {methodLabel(row.method)}
                      </span>
                    </span>
                    <Money poisha={row.amountPoisha} type={row.type} className="text-sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between border-t-[1.5px] border-dashed border-rule px-5 py-3 font-mono text-xs font-bold">
            <span>NET THIS MONTH</span>
            <span className={thisMonth.balancePoisha >= 0 ? "text-green" : "text-red"}>
              {formatTaka(thisMonth.balancePoisha)}
            </span>
          </div>
        </Card>

        <Card i={7} className="h-fit lg:col-span-5">
          <CardHead title="Saving for" hint={saved > 0 ? `${formatTaka(saved)} put away so far` : undefined} action={<TextLink href="/goals">All goals →</TextLink>} />
          {goals.length === 0 ? (
            <Empty
              icon="flag"
              title="No goals yet"
              body="A laptop, a trip to Sajek, Eid shopping — give your savings a name."
              action={<Link href="/goals" className="btn btn-sm">Start a goal</Link>}
            />
          ) : (
            <ul className="space-y-4 px-5 pb-5">
              {goals.map((goal, i) => {
                const pct = (goal.savedPoisha / goal.targetPoisha) * 100;
                return (
                  <li key={goal.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{goal.name}</span>
                      <span className="tnum shrink-0 text-xs text-ink-3">
                        {formatTaka(goal.savedPoisha)} / {formatTaka(goal.targetPoisha)}
                      </span>
                    </div>
                    <Meter value={pct} tone={pct >= 100 ? "ok" : "ink"} label={`${goal.name} progress`} i={i} height="h-2" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
