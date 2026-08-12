import Link from "next/link";

import { BudgetLimitForm, RemoveLimitButton } from "@/client";
import { getBudgetOverview } from "@/db";
import { Alert, Badge, Card, CardHeader, EmptyState, PageTitle, ProgressBar } from "@/ui";
import { categoryLabel, currentMonth, formatMonth, formatPercent, formatTaka } from "@/utils";

export const metadata = { title: "Budget" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = { ok: "OK", warn: "Close", over: "Over" };

/**
 * Spend is summed from the ledger on every read rather than stored, so this
 * page can never drift out of sync with the transactions behind it.
 */
export default function BudgetPage() {
  const month = currentMonth();
  const budget = getBudgetOverview(month);

  return (
    <div className="space-y-4">
      <PageTitle
        title="Category Budget"
        subtitle={`Monthly spending limits · ${formatMonth(month)}`}
      />

      {budget.overCount > 0 && (
        <Alert>
          {budget.overCount === 1
            ? "One category has passed its limit this month."
            : `${budget.overCount} categories have passed their limits this month.`}
        </Alert>
      )}

      <Card>
        <CardHeader
          title="Limits vs. spending"
          action={
            budget.rows.length > 0 && (
              <span className="tnum text-xs text-ink-muted">
                {formatTaka(budget.totalSpentPoisha)} of{" "}
                {formatTaka(budget.totalLimitPoisha)}
              </span>
            )
          }
        />

        {budget.rows.length === 0 ? (
          <EmptyState
            icon="target"
            title="No limits set yet"
            description="Set a monthly limit below and this table will track your spending against it."
          />
        ) : (
          <ul className="divide-y divide-line">
            {budget.rows.map((row) => (
              <li key={row.category} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">
                    {categoryLabel(row.category)}
                  </span>
                  <Badge tone={row.status}>{STATUS_LABEL[row.status]}</Badge>
                  <RemoveLimitButton
                    category={row.category}
                    label={categoryLabel(row.category)}
                  />
                </div>

                <div className="mt-2">
                  <ProgressBar
                    value={row.percent}
                    tone={row.status}
                    label={`${categoryLabel(row.category)} budget used`}
                  />
                </div>

                <div className="tnum mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-xs text-ink-muted">
                  <span>
                    Spent{" "}
                    <span className="font-medium text-ink">
                      {formatTaka(row.spentPoisha)}
                    </span>{" "}
                    of {formatTaka(row.limitPoisha)}
                  </span>
                  <span>
                    {row.remainingPoisha >= 0 ? (
                      <>
                        {formatTaka(row.remainingPoisha)} left ·{" "}
                        {formatPercent(row.percent)}
                      </>
                    ) : (
                      <span className="font-medium text-expense">
                        {formatTaka(Math.abs(row.remainingPoisha))} over ·{" "}
                        {formatPercent(row.percent)}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {budget.unbudgetedPoisha > 0 && (
        <p className="text-xs text-ink-muted">
          {formatTaka(budget.unbudgetedPoisha)} was spent this month in categories with
          no limit set.{" "}
          <Link href="/transactions" className="underline underline-offset-2">
            See where it went
          </Link>
        </p>
      )}

      <Card>
        <CardHeader title="Set or update a limit" />
        <BudgetLimitForm />
      </Card>
    </div>
  );
}
