import Link from "next/link";

import { QuickAddForm } from "@/client";
import { getBudgetOverview, getRecentTransactions, getSummary } from "@/db";
import { Alert, Card, CardHeader, EmptyState, Icon, PageTitle } from "@/ui";
import {
  categoryLabel,
  currentMonth,
  formatDayMonth,
  formatFullDate,
  formatMonth,
  formatPercent,
  formatSigned,
  formatTaka,
  percentOf,
  today,
} from "@/utils";

export const metadata = { title: "Dashboard" };

/**
 * The ledger is a live local database, not build-time content, so every request
 * re-reads it. Without this the route could be prerendered once and go on
 * serving yesterday's totals.
 */
export const dynamic = "force-dynamic";

/**
 * Server Component: the totals, the recent list and the budget warning are all
 * read from SQLite here and shipped as finished HTML. Only the Quick Add form
 * hydrates in the browser.
 */
export default function DashboardPage() {
  const month = currentMonth();
  const summary = getSummary();
  const recent = getRecentTransactions(5);
  const overspent = getBudgetOverview(month).rows.filter((r) => r.status === "over");

  // "Remaining Goal" from the mockup: the share of income still unspent.
  const spentShare = percentOf(summary.expensePoisha, summary.incomePoisha);
  const remaining =
    spentShare === null ? null : Math.max(0, Math.min(100, 100 - spentShare));

  return (
    <div className="space-y-4">
      <PageTitle title="Dashboard" subtitle={`Your money at a glance · ${formatMonth(month)}`} />

      {overspent.length > 0 && (
        <Alert>
          <span className="font-semibold">
            {overspent.length === 1
              ? `${categoryLabel(overspent[0].category)} is over budget`
              : `${overspent.length} categories are over budget`}
          </span>{" "}
          this month.{" "}
          <Link href="/budget" className="underline underline-offset-2">
            Review limits
          </Link>
        </Alert>
      )}

      {/* Balance headline plus the mockup's three summary figures. */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-card bg-navy-900 p-4 sm:col-span-1">
          <p className="text-[0.6875rem] font-medium tracking-wide text-gold-400 uppercase">
            Current Balance
          </p>
          <p className="tnum mt-1 text-2xl font-semibold text-white">
            {formatTaka(summary.balancePoisha)}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {summary.count} {summary.count === 1 ? "entry" : "entries"}
          </p>
        </div>

        <Stat label="Total Income" value={formatTaka(summary.incomePoisha)} tone="income" icon="up" />
        <Stat
          label="Total Expenses"
          value={formatTaka(summary.expensePoisha)}
          tone="expense"
          icon="down"
        />
        <Stat
          label="Remaining Goal"
          value={formatPercent(remaining)}
          tone="accent"
          icon="target"
          hint={remaining === null ? "Log income to track this" : "of income unspent"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Quick Add Transaction" />
          <QuickAddForm today={today()} />
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Recent Transactions"
            action={
              recent.length > 0 && (
                <Link
                  href="/transactions"
                  className="text-xs text-ink-muted hover:text-ink"
                >
                  View all
                </Link>
              )
            }
          />

          {recent.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              description="Add your first transaction on the left and it will show up here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((row) => (
                <li key={row.id}>
                  {/* Tapping a row answers the obvious next question: what else
                      have I spent in this category? */}
                  <Link
                    href={`/transactions?category=${encodeURIComponent(row.category)}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded ${
                        row.type === "income"
                          ? "bg-income-wash text-income"
                          : "bg-expense-wash text-expense"
                      }`}
                    >
                      <Icon name={row.type === "income" ? "up" : "down"} size={14} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-medium text-ink">
                        {row.description || categoryLabel(row.category)}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {categoryLabel(row.category)} ·{" "}
                        <time
                          dateTime={row.occurredOn}
                          title={formatFullDate(row.occurredOn)}
                        >
                          {formatDayMonth(row.occurredOn)}
                        </time>
                      </p>
                    </div>

                    <span
                      className={`tnum shrink-0 text-[0.8125rem] font-semibold ${
                        row.type === "income" ? "text-income" : "text-expense"
                      }`}
                    >
                      {formatSigned(row.amountPoisha, row.type)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

const STAT_TONE = {
  income: "text-income",
  expense: "text-expense",
  accent: "text-accent",
};

function Stat({ label, value, tone, icon, hint }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide text-ink-muted uppercase">
        <Icon name={icon} size={13} />
        {label}
      </p>
      <p className={`tnum mt-1 text-xl font-semibold ${STAT_TONE[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
