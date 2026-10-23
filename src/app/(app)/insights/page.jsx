import { Donut, HBars, TrendBars, WeekdayBars } from "@/components/charts";
import { QueryPicker } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Card, CardHead, Empty, Money, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildInsights } from "@/lib/insights";
import {
  getActiveMonths,
  getBudgetOverview,
  getCategoryBreakdown,
  getLargestExpenses,
  getMethodBreakdown,
  getMonthlyTrend,
  getSummary,
  getWeekdayTotals,
} from "@/lib/queries";
import {
  addMonths,
  categoryLabel,
  currentMonth,
  daysInMonth,
  formatDayMonth,
  formatMonth,
  isIsoMonth,
  methodLabel,
  today,
  trailingMonths,
} from "@/lib/utils";

export const metadata = { title: "Insights" };

const TONE = {
  good: { icon: "check", className: "bg-green-wash text-green" },
  warn: { icon: "warning", className: "bg-amber-wash text-amber" },
  bad: { icon: "warning", className: "bg-red-wash text-red" },
  neutral: { icon: "sparkle", className: "bg-card-2 text-ink-2" },
};

/**
 * The grouping happens in SQL; the charts are server-rendered SVG/HTML; the
 * sentences come from a pure function over those numbers. The only client
 * JavaScript here is the month picker.
 */
export default async function InsightsPage({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const thisMonthId = currentMonth();
  const activeMonths = getActiveMonths(user.id);
  const month = isIsoMonth(params.month) && params.month <= thisMonthId ? params.month : thisMonthId;
  const isCurrent = month === thisMonthId;
  const trendMonths = trailingMonths(month, 6);

  const thisMonth = getSummary(user.id, month);
  const lastMonth = getSummary(user.id, addMonths(month, -1));
  const categories = getCategoryBreakdown(user.id, month);
  const methods = getMethodBreakdown(user.id, month);
  const weekdays = getWeekdayTotals(user.id, trendMonths[0], month);

  const insights = buildInsights({
    month,
    dayOfMonth: isCurrent ? Number(today().slice(8, 10)) : daysInMonth(month),
    thisMonth,
    lastMonth,
    categories,
    lastCategories: getCategoryBreakdown(user.id, addMonths(month, -1)),
    weekdays,
    methods,
    budget: getBudgetOverview(user.id, month),
  }).slice(0, 4);

  const monthOptions = [...new Set([thisMonthId, month, ...activeMonths])]
    .sort()
    .reverse()
    .map((value) => ({ value, label: formatMonth(value) }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Where did it all go?"
        note={categories.length ? "the honest version" : undefined}
        action={<QueryPicker name="month" label="Select month" value={month} options={monthOptions} />}
      />

      {insights.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {insights.map((insight, i) => (
            <li key={insight.title} className="card lift rise flex gap-3 p-4" style={{ "--i": i + 1 }}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${TONE[insight.tone].className}`}>
                <Icon name={TONE[insight.tone].icon} size={17} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="font-bold leading-snug">{insight.title}</p>
                <p className="mt-0.5 text-sm text-ink-3">{insight.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card i={5} className="lg:col-span-7">
          <CardHead title={`Spending by category · ${formatMonth(month)}`} hint="Hover a slice for details" />
          <div className="px-5 pb-5">
            {categories.length === 0 ? (
              <Empty icon="chart" title={`No spending in ${formatMonth(month)}`} body="Pick another month, or log an expense." />
            ) : (
              <Donut id="cat" slices={categories} totalPoisha={thisMonth.expensePoisha} />
            )}
          </div>
        </Card>

        <Card i={6} className="lg:col-span-5">
          <CardHead title="How you paid" hint="Expenses by payment method" />
          <div className="px-5 pb-5">
            {methods.length === 0 ? (
              <Empty icon="wallet" title="Nothing to show yet" />
            ) : (
              <HBars
                items={methods.map((m) => ({
                  label: methodLabel(m.method),
                  value: m.poisha,
                  note: `${m.count}×`,
                }))}
              />
            )}
          </div>
        </Card>
      </div>

      <Card i={7}>
        <CardHead title="Six-month trend" hint={`${formatMonth(trendMonths[0])} – ${formatMonth(month)} · hover or tab through for numbers`} />
        <div className="px-5 pb-5">
          <TrendBars points={getMonthlyTrend(user.id, trendMonths)} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card i={8} className="lg:col-span-5">
          <CardHead title="Your expensive weekday" hint="Six months of spending by day (week starts Saturday)" />
          <div className="px-5 pb-5">
            {weekdays.every((v) => v === 0) ? <Empty icon="calendar" title="Not enough data yet" /> : <WeekdayBars totals={weekdays} />}
          </div>
        </Card>

        <Card i={9} className="lg:col-span-7">
          <CardHead title="Biggest hits" hint={`Largest single expenses in ${formatMonth(month)}`} />
          {(() => {
            const largest = getLargestExpenses(user.id, month, 5);
            if (largest.length === 0) return <Empty title="No expenses this month" />;
            return (
              <ol className="px-2 pb-3">
                {largest.map((row, i) => (
                  <li key={row.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-card-2">
                    <span className="hand w-6 text-center text-2xl text-ink-3">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{row.description || categoryLabel(row.category)}</span>
                      <span className="block text-xs text-ink-3">
                        {categoryLabel(row.category)} · {formatDayMonth(row.occurredOn)}
                      </span>
                    </span>
                    <Money poisha={row.amountPoisha} type="expense" className="text-sm" />
                  </li>
                ))}
              </ol>
            );
          })()}
        </Card>
      </div>
    </div>
  );
}
