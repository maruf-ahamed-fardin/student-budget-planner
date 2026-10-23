import { deleteSemester } from "@/app/actions/ledger";
import { DeleteForm } from "@/components/form-kit";
import { QueryPicker, SemesterForm } from "@/components/forms";
import { Card, CardHead, Empty, PageHeader, Swatch } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSemester, getSemesterMatrix, getSemesters } from "@/lib/queries";
import { categoryLabel, categoryShort, categorySlot, formatMonth, formatMonthShort, formatTaka, monthRange } from "@/lib/utils";

export const metadata = { title: "Semester" };

/**
 * Every category's spending for each month side by side, generated entirely
 * from the ledger. Nothing here is typed in by hand except the semester's name
 * and date range.
 */
export default async function SemesterPage({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const semesters = getSemesters(user.id);

  const requested = Number(params.id);
  const selected = (Number.isSafeInteger(requested) && getSemester(user.id, requested)) || semesters[0] || null;
  const months = selected ? monthRange(selected.startMonth, selected.months) : [];
  const matrix = getSemesterMatrix(user.id, months);
  const hasData = matrix.rows.length > 0 || matrix.grandIncome > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Semester"
        title="The whole term on one sheet."
        note={selected ? `${formatMonth(months[0])} → ${formatMonth(months.at(-1))}` : undefined}
        action={
          semesters.length > 1 &&
          selected && (
            <QueryPicker
              name="id"
              label="Select semester"
              value={String(selected.id)}
              options={semesters.map((s) => ({ value: String(s.id), label: s.name }))}
            />
          )
        }
      />

      {!selected ? (
        <Card i={1}>
          <Empty icon="calendar" title="No semester yet" body="Add one below — the sheet fills itself in from the entries you've already logged." />
        </Card>
      ) : (
        <>
          <div className="rise grid grid-cols-3 gap-2 sm:gap-4" style={{ "--i": 1 }}>
            <Figure label="Total in" value={matrix.grandIncome} className="text-green" />
            <Figure label="Total out" value={matrix.grandExpense} className="text-red" />
            <Figure label="Left over" value={matrix.grandBalance} />
          </div>

          <Card i={2}>
            <CardHead
              title={selected.name}
              hint="Darker cells are that category's biggest months"
              action={<DeleteForm action={deleteSemester} fields={{ id: selected.id }} label={`Delete ${selected.name}`} confirmLabel="Delete" />}
            />

            {!hasData ? (
              <Empty icon="calendar" title="Nothing logged in this range" body="Entries dated inside the semester appear here automatically." />
            ) : (
              /* A matrix can't become cards on a phone, so it scrolls inside its
                 own box with the category column pinned; the page never does. */
              <>
                <p className="hand flex items-center gap-1.5 px-5 pb-2 text-lg text-ink-3 sm:hidden" aria-hidden="true">
                  swipe for every month →
                </p>
                <div className="scroll-x border-t-[1.5px] border-edge">
                  <table className="w-full min-w-max text-right text-[0.8125rem] sm:text-sm">
                    <thead>
                      <tr className="border-b-[1.5px] border-edge bg-card-2 font-mono text-[0.6875rem] tracking-wider text-ink-3 uppercase">
                        <th className="sticky left-0 z-10 border-r-[1.5px] border-rule bg-card-2 px-3 py-2.5 text-left font-semibold sm:px-5">Category</th>
                        {months.map((m) => (
                          <th key={m} className="px-3 py-2.5 font-semibold sm:px-4">
                            {formatMonthShort(m)}
                          </th>
                        ))}
                        <th className="px-3 py-2.5 font-semibold text-ink sm:px-5">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-rule">
                      {matrix.rows.map((row) => (
                        <tr key={row.category} className="hover:bg-card-2/60">
                          <th scope="row" className="sticky left-0 z-10 border-r-[1.5px] border-rule bg-card px-3 py-2.5 text-left font-semibold sm:px-5">
                            <span className="flex items-center gap-2">
                              <Swatch slot={categorySlot(row.category)} />
                              {/* Short names on phones keep the pinned column narrow,
                                  so the months get the screen. */}
                              <span className="sm:hidden">{categoryShort(row.category)}</span>
                              <span className="hidden sm:inline">{categoryLabel(row.category)}</span>
                            </span>
                          </th>
                          {row.cells.map((value, i) => (
                            <td
                              key={months[i]}
                              className="tnum px-3 py-2.5 sm:px-4"
                              // Shade each cell against its own row's peak, so the
                              // eye finds "the month mess bill spiked" instantly.
                              style={
                                value > 0
                                  ? { backgroundColor: `color-mix(in oklab, var(--series-${categorySlot(row.category)}) ${Math.round((value / row.peak) * 28)}%, transparent)` }
                                  : undefined
                              }
                            >
                              {/* A dash, not ৳0 — a column of zeroes is much harder to scan. */}
                              {value === 0 ? <span className="text-ink-3">–</span> : formatTaka(value, { symbol: false })}
                            </td>
                          ))}
                          <td className="tnum px-3 py-2.5 font-bold sm:px-5">{formatTaka(row.total, { symbol: false })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-[1.5px] border-edge">
                      <SummaryRow label="Out" values={matrix.expenseTotals} total={matrix.grandExpense} months={months} className="text-red" />
                      <SummaryRow label="In" values={matrix.incomeTotals} total={matrix.grandIncome} months={months} className="text-green" />
                      <SummaryRow label="Balance" values={matrix.balances} total={matrix.grandBalance} months={months} strong />
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      <Card i={3}>
        <CardHead title="Add a semester" hint="Most BD private universities run 4-month trimesters; public ones closer to 6." />
        <SemesterForm />
      </Card>
    </div>
  );
}

function Figure({ label, value, className }) {
  return (
    <div className="card-flat px-3 py-3 sm:px-4">
      <p className="eyebrow">{label}</p>
      <p className={`tnum mt-1 truncate text-base font-bold sm:text-xl ${className ?? ""}`}>{formatTaka(value)}</p>
    </div>
  );
}

function SummaryRow({ label, values, total, months, className = "", strong }) {
  const bg = strong ? "bg-hl/30" : "bg-card";
  return (
    <tr className={strong ? "bg-hl/30" : undefined}>
      <th scope="row" className={`sticky left-0 z-10 border-r-[1.5px] border-rule px-3 py-2.5 text-left sm:px-5 font-mono text-xs font-bold tracking-wider uppercase ${strong ? "bg-[color-mix(in_oklab,var(--hl)_30%,var(--card))]" : bg} ${className}`}>
        {label}
      </th>
      {values.map((value, i) => (
        <td key={months[i]} className={`tnum px-3 py-2.5 font-semibold sm:px-4 ${className} ${value < 0 ? "text-red" : ""}`}>
          {formatTaka(value, { symbol: false })}
        </td>
      ))}
      <td className={`tnum px-3 py-2.5 font-bold sm:px-5 ${className} ${total < 0 ? "text-red" : ""}`}>{formatTaka(total, { symbol: false })}</td>
    </tr>
  );
}
