import {
  categoryLabel,
  categorySlot,
  cx,
  firstWeekday,
  formatCompact,
  formatDayMonth,
  formatMonthShort,
  formatTaka,
  WEEKDAYS,
} from "@/lib/utils";

/**
 * Hand-drawn charts — SVG and plain HTML, rendered on the server. No charting
 * library, no canvas, no client JavaScript: they arrive as markup, animate in
 * with CSS, and every mark has a tooltip on hover *and* keyboard focus.
 *
 * Colour rules (validated with a CVD/contrast check against the card surface
 * in both themes):
 *  - a category's colour follows the category, never its rank (`--series-N`);
 *  - segments are drawn in a fixed category order so neighbours are always
 *    the validated adjacent pairs;
 *  - every chart also prints its values as text (legend or labels), so
 *    nothing depends on colour alone.
 */

/* ------------------------------------------------------------------ *
 * Donut — where this month's money went                               *
 * ------------------------------------------------------------------ */

export function Donut({ id, slices, totalPoisha, size = 176 }) {
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // A 2px surface gap between segments; skipped when there's only one.
  const gap = slices.length > 1 ? 2.5 : 0;

  // Each arc starts where the previous ones end: a running sum of lengths.
  const lengths = slices.map((slice) => (slice.share / 100) * c);
  const arcs = slices.map((slice, i) => ({
    ...slice,
    dash: Math.max(0, lengths[i] - gap),
    offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }));

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90" role="img" aria-label="Spending by category">
          <defs>
            {/* The whole ring is revealed by a mask stroke drawing itself. */}
            <mask id={`${id}-mask`}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="white"
                strokeWidth={stroke + 4}
                strokeDasharray={c}
                className="draw"
                style={{ "--len": c }}
              />
            </mask>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-2)" strokeWidth={stroke} />
          <g mask={`url(#${id}-mask)`}>
            {arcs.map((arc) => (
              <circle
                key={arc.category}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={`var(--series-${categorySlot(arc.category)})`}
                strokeWidth={stroke}
                strokeDasharray={`${arc.dash} ${c - arc.dash}`}
                strokeDashoffset={-arc.offset}
                className="transition-[stroke-width] duration-150 hover:[stroke-width:32px]"
              >
                <title>{`${categoryLabel(arc.category)}: ${formatTaka(arc.poisha)} (${arc.share.toFixed(0)}%)`}</title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="eyebrow">Spent</span>
          <span className="tnum text-xl font-bold">{formatCompact(totalPoisha)}</span>
        </div>
      </div>

      <ul className="space-y-1">
        {[...slices]
          .sort((a, b) => b.poisha - a.poisha)
          .map((slice, i) => (
            <li
              key={slice.category}
              className="rise flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-card-2"
              style={{ "--i": i + 2 }}
            >
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-[3px] border border-black/10"
                style={{ backgroundColor: `var(--series-${categorySlot(slice.category)})` }}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{categoryLabel(slice.category)}</span>
              <span className="tnum shrink-0 font-semibold">{formatTaka(slice.poisha)}</span>
              <span className="tnum w-10 shrink-0 text-right text-xs text-ink-3">{Math.round(slice.share)}%</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Trend — money in vs out, month by month                             *
 * ------------------------------------------------------------------ */

export function TrendBars({ points, height = 200 }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.incomePoisha, p.expensePoisha]));
  const ticks = niceTicks(max);
  const top = ticks.at(-1);

  return (
    <figure>
      <div className="mb-4 flex gap-4 text-xs font-semibold text-ink-2">
        <LegendKey color="var(--green)">Money in</LegendKey>
        <LegendKey color="var(--red)">Money out</LegendKey>
      </div>

      <div className="relative pl-11" style={{ height }}>
        {/* Gridlines, recessive. */}
        {ticks.map((tick) => (
          <div
            key={tick}
            className="absolute right-0 left-11 border-t border-dashed border-rule"
            style={{ bottom: `${(tick / top) * 100}%` }}
          >
            <span className="tnum absolute -top-2 -left-11 w-9 text-right text-[0.625rem] text-ink-3">
              {formatCompact(tick)}
            </span>
          </div>
        ))}

        <div className="relative flex h-full items-end gap-[3%] border-b-[1.5px] border-edge">
          {points.map((p, i) => {
            const net = p.incomePoisha - p.expensePoisha;
            return (
              <div
                key={p.month}
                tabIndex={0}
                data-tip={`${formatMonthShort(p.month)}\nIn   ${formatTaka(p.incomePoisha)}\nOut  ${formatTaka(p.expensePoisha)}\nNet  ${formatTaka(net)}`}
                className="group flex h-full flex-1 items-end justify-center gap-[3px] rounded-t-md outline-none hover:bg-card-2/70 focus-visible:bg-card-2"
              >
                <Bar value={p.incomePoisha} top={top} color="var(--green)" i={i * 2} />
                <Bar value={p.expensePoisha} top={top} color="var(--red)" i={i * 2 + 1} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-[3%] pl-11">
        {points.map((p) => (
          <span key={p.month} className="flex-1 text-center font-mono text-[0.6875rem] font-semibold text-ink-3">
            {formatMonthShort(p.month)}
          </span>
        ))}
      </div>
    </figure>
  );
}

function Bar({ value, top, color, i }) {
  return (
    <span
      className="grow-y block w-full max-w-7 rounded-t-[4px] group-hover:brightness-110"
      style={{
        height: `${(value / top) * 100}%`,
        minHeight: value > 0 ? 2 : 0,
        backgroundColor: color,
        "--i": i,
      }}
    />
  );
}

function LegendKey({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />
      {children}
    </span>
  );
}

/** 3–5 round gridline values covering `max`. */
function niceTicks(max) {
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  const ticks = [];
  for (let v = step; v < max + step; v += step) ticks.push(v);
  return ticks;
}

/* ------------------------------------------------------------------ *
 * Heatmap — this month, day by day                                    *
 * ------------------------------------------------------------------ */

/**
 * A calendar of spending. Sequential encoding — one hue, light to dark — with
 * buckets cut at quartiles of the days that had any spending at all, so one
 * ৳12,000 fee day doesn't wash every other day out to the palest step.
 */
export function SpendCalendar({ month, days, today }) {
  const spent = days.filter((d) => d > 0).sort((a, b) => a - b);
  const q = (p) => spent[Math.min(spent.length - 1, Math.floor(p * spent.length))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (v) => (v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);

  const blanks = firstWeekday(month);

  return (
    <figure>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center font-mono text-[0.625rem] font-semibold text-ink-3 uppercase">
            {d[0]}
            <span className="hidden sm:inline">{d.slice(1)}</span>
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`b${i}`} aria-hidden="true" />
        ))}
        {days.map((value, index) => {
          const date = `${month}-${String(index + 1).padStart(2, "0")}`;
          const future = date > today;
          const l = future ? -1 : level(value);
          return (
            <span
              key={date}
              tabIndex={future ? undefined : 0}
              data-tip={future ? undefined : `${formatDayMonth(date)}  ${value > 0 ? formatTaka(value) : "no spend"}`}
              className={cx(
                "pop-in relative grid aspect-square place-items-center rounded-md font-mono text-[0.625rem] font-semibold outline-none sm:text-[0.6875rem]",
                future ? "border-[1.5px] border-dashed border-rule text-ink-3/60" : "border-[1.5px] border-transparent hover:border-edge focus-visible:border-edge",
                date === today && "ring-2 ring-ink ring-offset-2 ring-offset-card",
                l >= 3 ? "text-white" : "text-ink-2",
              )}
              style={{ "--i": index, backgroundColor: l >= 0 ? HEAT[l] : undefined }}
            >
              {index + 1}
            </span>
          );
        })}
      </div>
      <figcaption className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[0.625rem] text-ink-3">
        less
        {HEAT.map((color, i) => (
          <span key={i} className="size-3 rounded-[3px] border border-black/5" style={{ backgroundColor: color }} />
        ))}
        more
      </figcaption>
    </figure>
  );
}

/** One hue (the expense red), light → dark, mixed into the card colour. */
const HEAT = [
  "var(--card-2)",
  "color-mix(in oklab, var(--red) 22%, var(--card))",
  "color-mix(in oklab, var(--red) 45%, var(--card))",
  "color-mix(in oklab, var(--red) 72%, var(--card))",
  "var(--red)",
];

/* ------------------------------------------------------------------ *
 * Simple bars — a single series, so one recessive ink colour          *
 * ------------------------------------------------------------------ */

export function HBars({ items }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{item.label}</span>
            <span className="tnum text-[0.8125rem] font-semibold">
              {formatTaka(item.value)}
              {item.note && <span className="ml-1.5 text-xs font-normal text-ink-3">{item.note}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-card-2">
            <div className="grow-x h-full rounded-full bg-ink" style={{ width: `${(item.value / max) * 100}%`, "--i": i }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WeekdayBars({ totals }) {
  const max = Math.max(1, ...totals);
  const peak = totals.indexOf(Math.max(...totals));
  // Saturday-first, the way the Bangladeshi week (and class routine) runs.
  const order = [6, 0, 1, 2, 3, 4, 5];

  return (
    <div className="flex h-40 items-end gap-2">
      {order.map((d, i) => (
        <div
          key={d}
          tabIndex={0}
          data-tip={`${WEEKDAYS[d]}  ${formatTaka(totals[d])}`}
          className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5 outline-none"
        >
          <span
            className={cx("grow-y block w-full max-w-9 rounded-t-[4px] group-hover:opacity-80", d === peak ? "bg-hl border-[1.5px] border-edge" : "bg-ink/80")}
            style={{ height: `${(totals[d] / max) * 100}%`, minHeight: totals[d] > 0 ? 3 : 0, "--i": i }}
          />
          <span className={cx("font-mono text-[0.6875rem] font-semibold", d === peak ? "text-ink" : "text-ink-3")}>
            {WEEKDAYS[d]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ring — a goal's progress                                            *
 * ------------------------------------------------------------------ */

export function Ring({ percent, size = 92, stroke = 10, done = false, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? "var(--green)" : "var(--ink)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className="draw"
          style={{ "--len": filled }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
