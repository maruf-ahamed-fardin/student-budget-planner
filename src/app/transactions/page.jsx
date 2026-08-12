import { DeleteButton, TransactionFilters } from "@/client";
import { getActiveMonths, getFilteredTransactions } from "@/db";
import { Badge, Card, EmptyState, PageTitle } from "@/ui";
import {
  categoryLabel,
  formatDayMonth,
  formatFullDate,
  formatSigned,
  formatTaka,
  isIsoMonth,
} from "@/utils";

export const metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

/**
 * Filters arrive as search params, so the query runs on the server and the
 * filtered list is genuinely server-rendered — shareable as a URL and correct
 * with the back button, rather than re-filtered in the browser.
 */
export default async function TransactionsPage({ searchParams }) {
  const params = await searchParams;

  const filters = {
    type: params.type === "income" || params.type === "expense" ? params.type : "",
    category: typeof params.category === "string" ? params.category : "",
    month: isIsoMonth(params.month) ? params.month : "",
    search: typeof params.q === "string" ? params.q.slice(0, 60) : "",
  };

  const { rows, summary } = getFilteredTransactions(filters);
  const months = getActiveMonths();

  return (
    <div className="space-y-4">
      <PageTitle title="Transactions" subtitle="Every income and expense you have logged" />

      {/* Totals describe the filtered view, not the whole ledger. */}
      <div className="grid grid-cols-3 gap-3">
        <Total label="Income" value={formatTaka(summary.incomePoisha)} className="text-income" />
        <Total label="Expenses" value={formatTaka(summary.expensePoisha)} className="text-expense" />
        <Total label="Net" value={formatTaka(summary.balancePoisha)} className="text-ink" />
      </div>

      <Card>
        <TransactionFilters months={months} initial={{ ...filters, search: filters.search }} />

        {rows.length === 0 ? (
          <EmptyState
            title="No matching transactions"
            description="Try clearing a filter, or add a transaction from the dashboard."
          />
        ) : (
          <>
            {/* Desktop: a real table. */}
            <div className="hidden sm:block">
              <table className="w-full text-left text-[0.8125rem]">
                <thead className="border-b border-line text-xs text-ink-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-2">
                      <td className="px-4 py-2 whitespace-nowrap text-ink-muted">
                        <time dateTime={row.occurredOn} title={formatFullDate(row.occurredOn)}>
                          {formatDayMonth(row.occurredOn)}
                        </time>
                      </td>
                      <td className="max-w-0 truncate px-4 py-2 font-medium text-ink">
                        {row.description || categoryLabel(row.category)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={row.type === "income" ? "ok" : "neutral"}>
                          {categoryLabel(row.category)}
                        </Badge>
                      </td>
                      <td
                        className={`tnum px-4 py-2 text-right font-semibold whitespace-nowrap ${
                          row.type === "income" ? "text-income" : "text-expense"
                        }`}
                      >
                        {formatSigned(row.amountPoisha, row.type)}
                      </td>
                      <td className="px-2 py-2">
                        <DeleteButton
                          id={row.id}
                          label={row.description || categoryLabel(row.category)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone: the same rows as cards. A five-column table cannot be made
                readable at 375px, so it isn't attempted. */}
            <ul className="divide-y divide-line sm:hidden">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium text-ink">
                      {row.description || categoryLabel(row.category)}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {categoryLabel(row.category)} · {formatDayMonth(row.occurredOn)}
                    </p>
                  </div>
                  <span
                    className={`tnum shrink-0 text-[0.8125rem] font-semibold ${
                      row.type === "income" ? "text-income" : "text-expense"
                    }`}
                  >
                    {formatSigned(row.amountPoisha, row.type)}
                  </span>
                  <DeleteButton
                    id={row.id}
                    label={row.description || categoryLabel(row.category)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <p className="text-xs text-ink-muted">
        Showing {rows.length} {rows.length === 1 ? "entry" : "entries"}.
      </p>
    </div>
  );
}

function Total({ label, value, className }) {
  return (
    <div className="card p-3">
      <p className="text-[0.6875rem] font-medium tracking-wide text-ink-muted uppercase">
        {label}
      </p>
      <p className={`tnum mt-0.5 text-base font-semibold ${className}`}>{value}</p>
    </div>
  );
}
