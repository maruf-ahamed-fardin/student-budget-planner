"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

import { categoryLabel, formatMonthShort, formatTaka, toTaka } from "@/utils";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/**
 * Chart.js drawing surfaces. The server has already grouped the numbers — these
 * components only render them, and only ever receive what they need to draw.
 *
 * Colours are passed in explicitly per theme rather than read from CSS custom
 * properties, because a <canvas> cannot inherit them. `theme` comes from the
 * same cookie the layout uses, so the palette is correct on the very first
 * paint instead of flipping after hydration.
 */

/**
 * Categorical slots, assigned in fixed order and never cycled. Both columns are
 * the same eight hues stepped for their own surface, validated as a set for
 * colour-vision separation and contrast in light and dark.
 */
const CATEGORICAL = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"],
};

/** Ink and surface tones for axes, grid and mark gaps. */
const CHROME = {
  light: { surface: "#ffffff", grid: "#e3e7ee", text: "#6b7688", bar: "#334166" },
  dark: { surface: "#121a2e", grid: "#24304a", text: "#93a0b8", bar: "#8fa3cc" },
};

const money = (poisha) => formatTaka(poisha);

/* ------------------------------------------------------------------ *
 * Spending by category                                                *
 * ------------------------------------------------------------------ */

/**
 * `slices` is already sorted largest first, so slot order follows the data's
 * own ranking and stays stable while the month filter changes.
 *
 * The legend beside the chart carries the category name, amount and share, so
 * identity never rests on colour alone — which is also the relief the light
 * palette needs for its lower-contrast slots.
 */
export function CategoryDoughnut({ slices, theme }) {
  const palette = CATEGORICAL[theme];
  const chrome = CHROME[theme];

  const data = {
    labels: slices.map((slice) => categoryLabel(slice.category)),
    datasets: [
      {
        data: slices.map((slice) => toTaka(slice.poisha)),
        backgroundColor: slices.map((_, index) => palette[index % palette.length]),
        // A 2px gap in the surface colour separates neighbouring arcs.
        borderColor: chrome.surface,
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "58%",
    plugins: {
      // Chart.js's own legend is replaced by the richer list below the chart.
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const slice = slices[context.dataIndex];
            return ` ${money(slice.poisha)} · ${slice.share.toFixed(1)}%`;
          },
        },
      },
    },
  };

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)] sm:items-center">
      <div className="relative mx-auto h-44 w-44">
        <Doughnut data={data} options={options} />
      </div>

      <ul className="space-y-1.5">
        {slices.map((slice, index) => (
          <li key={slice.category} className="flex items-center gap-2 text-[0.8125rem]">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: palette[index % palette.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-ink">
              {categoryLabel(slice.category)}
            </span>
            <span className="tnum shrink-0 font-medium text-ink">
              {money(slice.poisha)}
            </span>
            <span className="tnum w-10 shrink-0 text-right text-xs text-ink-muted">
              {slice.share.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Monthly spending trend                                              *
 * ------------------------------------------------------------------ */

/**
 * One series, as the mockup drew it. With a single series the colour carries no
 * identity, so it is a recessive brand tone rather than a categorical slot —
 * reusing slot 1 here would imply a link to the top category in the doughnut.
 */
export function MonthlyBar({ points, theme }) {
  const chrome = CHROME[theme];

  const data = {
    labels: points.map((point) => formatMonthShort(point.month)),
    datasets: [
      {
        label: "Spending",
        data: points.map((point) => toTaka(point.expensePoisha)),
        backgroundColor: chrome.bar,
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 44,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${money(points[context.dataIndex].expensePoisha)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: chrome.grid },
        ticks: { color: chrome.text, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: chrome.grid },
        ticks: {
          color: chrome.text,
          font: { size: 11 },
          maxTicksLimit: 5,
          callback: (value) => formatTaka(value * 100),
        },
      },
    },
  };

  return (
    <div className="h-56">
      <Bar data={data} options={options} />
    </div>
  );
}
