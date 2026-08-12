import { cookies } from "next/headers";

import { CategoryDoughnut, MonthlyBar } from "@/charts";
import { QueryPicker } from "@/client";
import { getActiveMonths, getCategoryBreakdown, getMonthlyTrend, getSummary } from "@/db";
import { Card, CardHeader, EmptyState, PageTitle } from "@/ui";
import { currentMonth, formatMonth, formatTaka, isIsoMonth, trailingMonths } from "@/utils";

export const metadata = { title: "Charts" };
export const dynamic = "force-dynamic";

/**
 * The grouping happens in SQL on the server; the client components only draw.
 * The theme is read here from the same cookie the layout uses, so the charts
 * paint with the right palette immediately rather than flipping after hydration.
 */
export default async function ChartsPage({ searchParams }) {
  const params = await searchParams;
  const store = await cookies();
  const theme = store.get("sbp-theme")?.value === "dark" ? "dark" : "light";

  const activeMonths = getActiveMonths();
  const fallbackMonth = activeMonths[0] ?? currentMonth();
  const month = isIsoMonth(params.month) ? params.month : fallbackMonth;

  const slices = getCategoryBreakdown(month);
  const trend = getMonthlyTrend(trailingMonths(month, 6));
  const monthSummary = getSummary(month);

  // Always offer the selected month, even if every entry in it was deleted.
  const monthOptions = [...new Set([month, ...activeMonths])]
    .sort()
    .reverse()
    .map((value) => ({ value, label: formatMonth(value) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Spending Charts" subtitle="Where the money actually goes" />
        <QueryPicker
          name="month"
          label="Select month"
          value={month}
          options={monthOptions}
        />
      </div>

      <Card>
        <CardHeader
          title={`Spending by category · ${formatMonth(month)}`}
          action={
            <span className="tnum text-xs text-ink-muted">
              {formatTaka(monthSummary.expensePoisha)} total
            </span>
          }
        />
        <div className="p-4">
          {slices.length === 0 ? (
            <EmptyState
              icon="chart"
              title={`No expenses in ${formatMonth(month)}`}
              description="Pick another month, or log an expense from the dashboard."
            />
          ) : (
            <CategoryDoughnut slices={slices} theme={theme} />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Monthly spending trend" />
        <div className="p-4">
          {trend.every((point) => point.expensePoisha === 0) ? (
            <EmptyState
              icon="chart"
              title="No spending in the last six months"
              description="Once you log a few expenses the trend will appear here."
            />
          ) : (
            <MonthlyBar points={trend} theme={theme} />
          )}
        </div>
      </Card>
    </div>
  );
}
