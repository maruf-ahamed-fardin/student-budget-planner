import { removeBudgetLimit } from "@/app/actions/ledger";
import { DeleteForm } from "@/components/form-kit";
import { BudgetLimitForm } from "@/components/forms";
import { Card, CardHead, Empty, Meter, Notice, Odometer, PageHeader, StatusPill, Swatch, TextLink } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { safeToSpend } from "@/lib/insights";
import { getBudgetOverview, getSavedTotal, getSummary } from "@/lib/queries";
import {
  categoryLabel,
  categorySlot,
  currentMonth,
  daysInMonth,
  formatMonth,
  formatPercent,
  formatTaka,
  percentChange,
  poishaToInput,
  today,
} from "@/lib/utils";

export const metadata = { title: "Budget" };

/**
 * Spend is summed from the ledger on every read rather than stored, so this
 * page can never drift out of sync with the transactions behind it.
 */
export default async function BudgetPage() {
  const user = await requireUser();
  const month = currentMonth();
  const dayOfMonth = Number(today().slice(8, 10));
  const days = daysInMonth(month);

  const budget = getBudgetOverview(user.id, month);
  const thisMonth = getSummary(user.id, month);
  const free = getSummary(user.id).balancePoisha - getSavedTotal(user.id);
  const safe = safeToSpend({ budget, thisMonth, dayOfMonth, days, freePoisha: free });
  const used = budget.totalLimitPoisha > 0 ? (budget.totalSpentPoisha / budget.totalLimitPoisha) * 100 : 0;
  // Where the month "should" be if spending were perfectly even.
  const pace = (dayOfMonth / days) * 100;

  const limits = Object.fromEntries(budget.rows.map((r) => [r.category, poishaToInput(r.limitPoisha)]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Budget · ${formatMonth(month)}`}
        title="Limits you set, money you kept."
        note={budget.rows.length ? `day ${dayOfMonth} of ${days} — the dotted line is where you'd be at an even pace` : undefined}
      />

      {budget.overCount > 0 && (
        <Notice className="rise">
          {budget.overCount === 1
            ? "One category has blown through its limit this month."
            : `${budget.overCount} categories have blown through their limits this month.`}{" "}
          Every extra taka there comes out of something else.
        </Notice>
      )}

      {budget.rows.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card i={1} className="p-5 md:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Used this month</p>
                <p className="mt-2 text-4xl font-bold">
                  <Odometer value={formatTaka(budget.totalSpentPoisha)} />
                </p>
                <p className="mt-1 text-sm text-ink-3">of {formatTaka(budget.totalLimitPoisha)} across {budget.rows.length} limits</p>
              </div>
              <p className="tnum text-3xl font-bold text-ink-3">{formatPercent(used)}</p>
            </div>
            <div className="relative mt-4">
              <Meter value={used} tone={used >= 100 ? "over" : used > pace + 10 ? "warn" : "ok"} label="Total budget used" height="h-4" />
              <span
                className="absolute -top-1.5 -bottom-1.5 border-l-2 border-dotted border-ink"
                style={{ left: `${pace}%` }}
                title="Even pace for today"
                aria-hidden="true"
              />
            </div>
          </Card>
          <Card i={2} className="bg-hl! p-5 text-[#1a1915]">
            <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">Left to spend</p>
            <p className="mt-2 text-4xl font-bold">
              <Odometer value={formatTaka(safe.poolPoisha)} />
            </p>
            <p className="mt-1 text-sm">
              ≈ <strong className="tnum">{formatTaka(safe.perDayPoisha)}</strong> a day for {safe.daysLeft} days
              {safe.basis === "wallet" && (
                <span className="block text-xs opacity-70">Capped by what&apos;s actually in your wallet, not your limits.</span>
              )}
            </p>
          </Card>
        </div>
      )}

      <Card i={3}>
        <CardHead title="Category limits" hint="Monthly caps. Status turns amber at 80% and red at 100%." />
        {budget.rows.length === 0 ? (
          <Empty icon="target" title="No limits yet" body="Pick a category below and give it a monthly cap. Start with the one that always surprises you." />
        ) : (
          <ul className="divide-y-[1.5px] divide-dashed divide-rule border-t-[1.5px] border-dashed border-rule">
            {budget.rows.map((row, i) => {
              const vsLast = percentChange(row.lastMonthPoisha, row.spentPoisha);
              return (
                <li key={row.category} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Swatch slot={categorySlot(row.category)} className="size-3!" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{categoryLabel(row.category)}</span>
                    <StatusPill status={row.status} />
                    <DeleteForm
                      action={removeBudgetLimit}
                      fields={{ category: row.category }}
                      label={`Remove the ${categoryLabel(row.category)} limit`}
                      confirmLabel="Remove"
                    />
                  </div>
                  <div className="relative mt-3">
                    <Meter value={row.percent} tone={row.status} label={`${categoryLabel(row.category)} budget used`} i={i} />
                    <span className="absolute -top-1 -bottom-1 border-l-2 border-dotted border-ink/60" style={{ left: `${pace}%` }} aria-hidden="true" />
                  </div>
                  <div className="tnum mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[0.8125rem] text-ink-3">
                    <span>
                      <span className="font-semibold text-ink">{formatTaka(row.spentPoisha)}</span> of {formatTaka(row.limitPoisha)}
                      {vsLast !== null && (
                        <span className="ml-2 font-display text-xs">
                          (last month {formatTaka(row.lastMonthPoisha)})
                        </span>
                      )}
                    </span>
                    {row.remainingPoisha >= 0 ? (
                      <span>
                        {formatTaka(row.remainingPoisha)} left · {formatPercent(row.percent)}
                      </span>
                    ) : (
                      <span className="font-semibold text-red">
                        {formatTaka(-row.remainingPoisha)} over · {formatPercent(row.percent)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {budget.unbudgetedPoisha > 0 && (
        <p className="rise text-sm text-ink-3" style={{ "--i": 4 }}>
          <span className="hand text-lg text-ink-2">also:</span> {formatTaka(budget.unbudgetedPoisha)} went to categories with no
          limit this month. <TextLink href={`/transactions?type=expense&month=${month}`}>See where</TextLink>
        </p>
      )}

      <Card i={5}>
        <CardHead title="Set or change a limit" hint="Picking a category that already has one updates it." />
        <BudgetLimitForm limits={limits} />
      </Card>
    </div>
  );
}
