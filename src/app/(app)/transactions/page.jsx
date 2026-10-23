import Link from "next/link";

import { DeleteForm } from "@/components/form-kit";
import { LedgerFilters } from "@/components/forms";
import { Icon } from "@/components/icons";
import { AddEntryButton, EditEntryButton, EntryRowButton } from "@/components/tx-dialog";
import { Card, Empty, Money, PageHeader, Pill, Swatch } from "@/components/ui";
import { deleteTransaction } from "@/app/actions/ledger";
import { requireUser } from "@/lib/auth";
import { getActiveMonths, getLedger, PAGE_SIZE } from "@/lib/queries";
import {
  categoryLabel,
  categorySlot,
  formatFullDate,
  formatTaka,
  isIsoMonth,
  isValidCategory,
  isValidMethod,
  methodLabel,
} from "@/lib/utils";

export const metadata = { title: "Ledger" };

/**
 * Filters arrive as search params and are validated against the known lists
 * before they reach SQL — an unknown value is dropped, not passed through.
 */
export default async function LedgerPage({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const filters = {
    type: params.type === "income" || params.type === "expense" ? params.type : "",
    category: isValidCategory(params.category) ? params.category : "",
    method: isValidMethod(params.method) ? params.method : "",
    month: isIsoMonth(params.month) ? params.month : "",
    search: typeof params.q === "string" ? params.q.slice(0, 60) : "",
  };
  const requestedPage = Math.max(1, Number.parseInt(params.page, 10) || 1);

  const { rows, summary, page, pages } = getLedger(user.id, filters, requestedPage);
  const months = getActiveMonths(user.id);

  // Group the page by day, so the ledger reads like a diary.
  const byDay = [];
  for (const row of rows) {
    const last = byDay.at(-1);
    if (last?.date === row.occurredOn) last.rows.push(row);
    else byDay.push({ date: row.occurredOn, rows: [row] });
  }

  const pageHref = (n) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, page: n > 1 ? String(n) : "" })) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/transactions?${query}` : "/transactions";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ledger"
        title="Every taka, in order."
        note={summary.count ? `${summary.count} entries match` : undefined}
        action={
          <>
            <a href="/api/export" className="btn btn-sm" download>
              <Icon name="download" size={15} />
              CSV
            </a>
            <AddEntryButton className="btn btn-ink btn-sm hidden md:inline-flex">
              <Icon name="plus" size={15} strokeWidth={2.4} />
              New entry
            </AddEntryButton>
          </>
        }
      />

      {/* Totals describe the filtered view, not the whole ledger. */}
      <div className="rise grid grid-cols-3 gap-2 sm:gap-4" style={{ "--i": 1 }}>
        <Total label="In" value={summary.incomePoisha} className="text-green" />
        <Total label="Out" value={summary.expensePoisha} className="text-red" />
        <Total label="Net" value={summary.balancePoisha} />
      </div>

      <Card i={2}>
        <LedgerFilters months={months} initial={filters} />

        {rows.length === 0 ? (
          <Empty
            title={summary.count === 0 && !Object.values(filters).some(Boolean) ? "Your ledger is empty" : "Nothing matches"}
            body="Try clearing a filter, or add an entry."
            action={<AddEntryButton className="btn btn-sm btn-ink">Add entry</AddEntryButton>}
          />
        ) : (
          <div>
            {byDay.map((day, d) => (
              <section key={day.date} className="rise" style={{ "--i": Math.min(d, 8) + 2 }}>
                <h3 className="sticky top-14 z-10 flex items-center justify-between border-b-[1.5px] border-dashed border-rule bg-card/95 px-5 py-2 font-mono text-[0.6875rem] font-bold tracking-[0.12em] text-ink-3 uppercase backdrop-blur md:top-0">
                  <time dateTime={day.date}>{formatFullDate(day.date)}</time>
                  <DayTotal rows={day.rows} />
                </h3>
                <ul>
                  {day.rows.map((row) => {
                    const label = row.description || categoryLabel(row.category);
                    return (
                      <li key={row.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-card-2 sm:gap-4">
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-lg border-[1.5px] border-edge"
                          style={{
                            backgroundColor: row.type === "income" ? "var(--green-wash)" : `color-mix(in oklab, var(--series-${categorySlot(row.category)}) 18%, var(--card))`,
                          }}
                          aria-hidden="true"
                        >
                          {row.type === "income" ? (
                            <Icon name="up" size={15} strokeWidth={2.4} className="text-green" />
                          ) : (
                            <Swatch slot={categorySlot(row.category)} className="size-3!" />
                          )}
                        </span>
                        <EntryRowButton entry={row} label={label}>
                          <span className="block truncate text-[0.9375rem] font-semibold">{label}</span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                            {categoryLabel(row.category)}
                            <Pill className="h-[1.125rem]! text-[0.625rem]!">{methodLabel(row.method)}</Pill>
                          </span>
                        </EntryRowButton>
                        <Money poisha={row.amountPoisha} type={row.type} className="text-[0.9375rem]" />
                        {/* Phones edit by tapping the row (delete lives in the dialog);
                            with a mouse these appear on hover. */}
                        <div className="hidden shrink-0 items-center sm:flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                          <EditEntryButton entry={row} label={label} />
                          <DeleteForm action={deleteTransaction} fields={{ id: row.id }} label={`Delete ${label}`} confirmLabel="Delete" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t-[1.5px] border-dashed border-rule px-5 py-3">
            <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
              <Icon name="back" size={15} /> Newer
            </PageLink>
            <span className="font-mono text-xs text-ink-3">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, summary.count)} of {summary.count}
            </span>
            <PageLink href={pageHref(page + 1)} disabled={page >= pages}>
              Older <Icon name="arrow" size={15} />
            </PageLink>
          </nav>
        )}
      </Card>
    </div>
  );
}

/** A day's spending; on a day with only money in, that instead of "৳0 out". */
function DayTotal({ rows }) {
  const sum = (type) => rows.filter((r) => r.type === type).reduce((s, r) => s + r.amountPoisha, 0);
  const out = sum("expense");
  return out > 0 ? <span>{formatTaka(out)} out</span> : <span className="text-green">+{formatTaka(sum("income"))} in</span>;
}

function Total({ label, value, className }) {
  return (
    <div className="card-flat px-3 py-3 sm:px-4">
      <p className="eyebrow">{label}</p>
      <p className={`tnum mt-1 truncate text-base font-bold sm:text-xl ${className ?? ""}`}>{formatTaka(value)}</p>
    </div>
  );
}

function PageLink({ href, disabled, children }) {
  if (disabled) {
    return (
      <span className="btn btn-sm pointer-events-none opacity-40" aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className="btn btn-sm" scroll={false}>
      {children}
    </Link>
  );
}
