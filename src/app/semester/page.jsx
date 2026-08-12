import { DeleteSemesterButton, QueryPicker, SemesterForm } from "@/client";
import { getSemester, getSemesterMatrix, getSemesters } from "@/db";
import { Card, CardHeader, EmptyState, PageTitle } from "@/ui";
import { categoryLabel, currentMonth, formatMonth, formatMonthShort, formatTaka, monthRange } from "@/utils";

export const metadata = { title: "Semester" };
export const dynamic = "force-dynamic";

/**
 * The matrix from page 05 of the mockup: every category's spending for each
 * month side by side, generated entirely from the ledger. Nothing on this page
 * is typed in by hand except the semester's name and date range.
 */
export default async function SemesterPage({ searchParams }) {
  const params = await searchParams;
  const semesters = getSemesters();

  const requested = Number(params.id);
  const selected =
    (Number.isInteger(requested) && getSemester(requested)) || semesters[0] || null;

  const months = selected
    ? monthRange(selected.startMonth, selected.months)
    : monthRange(currentMonth(), 1);

  const matrix = getSemesterMatrix(months);
  const hasData = matrix.rows.length > 0 || matrix.grandIncome > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          title="Semester View"
          subtitle="Month-by-month comparison across the semester"
        />

        {semesters.length > 1 && selected && (
          <QueryPicker
            name="id"
            label="Select semester"
            value={String(selected.id)}
            options={semesters.map((item) => ({
              value: String(item.id),
              label: item.name,
            }))}
          />
        )}
      </div>

      {!selected ? (
        <Card>
          <EmptyState
            icon="calendar"
            title="No semester set up yet"
            description="Add one below — the matrix fills itself in from the transactions you have already logged."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`${selected.name} · ${formatMonth(months[0])} – ${formatMonth(months.at(-1))}`}
            action={<DeleteSemesterButton id={selected.id} name={selected.name} />}
          />

          {!hasData ? (
            <EmptyState
              icon="calendar"
              title="Nothing logged in this range"
              description="Transactions dated inside the semester will appear here automatically."
            />
          ) : (
            /* A matrix cannot become cards on a phone, so it scrolls inside its
               own box with the category column pinned. The page itself never
               scrolls sideways. */
            <div className="scroll-x">
              <table className="w-full min-w-max text-right text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-muted">
                    <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-medium">
                      Category
                    </th>
                    {months.map((month) => (
                      <th key={month} className="px-3 py-2 font-medium">
                        {formatMonthShort(month)}
                      </th>
                    ))}
                    <th className="px-4 py-2 font-medium">Total</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line">
                  {matrix.rows.map((row) => (
                    <tr key={row.category} className="hover:bg-surface-2">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-medium text-ink"
                      >
                        {categoryLabel(row.category)}
                      </th>
                      {row.cells.map((value, index) => (
                        <td key={months[index]} className="tnum px-3 py-2 text-ink-muted">
                          {/* A dash, not ৳0 — no spend and zero spend read the same
                              but a column of zeroes is much harder to scan. */}
                          {value === 0 ? "–" : formatTaka(value, { symbol: false })}
                        </td>
                      ))}
                      <td className="tnum px-4 py-2 font-semibold text-ink">
                        {formatTaka(row.total, { symbol: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="border-t-2 border-line">
                  <SummaryRow
                    label="Total expenses"
                    values={matrix.expenseTotals}
                    total={matrix.grandExpense}
                    months={months}
                    className="text-expense"
                  />
                  <SummaryRow
                    label="Total income"
                    values={matrix.incomeTotals}
                    total={matrix.grandIncome}
                    months={months}
                    className="text-income"
                  />
                  <SummaryRow
                    label="Balance"
                    values={matrix.balances}
                    total={matrix.grandBalance}
                    months={months}
                    className="text-ink"
                    emphasise
                  />
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Add a semester" />
        <SemesterForm />
      </Card>
    </div>
  );
}

function SummaryRow({ label, values, total, months, className, emphasise }) {
  return (
    <tr className={emphasise ? "bg-surface-2" : undefined}>
      <th
        scope="row"
        className={`sticky left-0 z-10 px-4 py-2 text-left text-xs font-semibold ${
          emphasise ? "bg-surface-2" : "bg-surface"
        } ${className}`}
      >
        {label}
      </th>
      {values.map((value, index) => (
        <td key={months[index]} className={`tnum px-3 py-2 font-medium ${className}`}>
          {formatTaka(value, { symbol: false })}
        </td>
      ))}
      <td className={`tnum px-4 py-2 font-bold ${className}`}>
        {formatTaka(total, { symbol: false })}
      </td>
    </tr>
  );
}
