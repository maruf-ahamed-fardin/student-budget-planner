import Link from "next/link";

import { DemoButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Notice } from "@/components/ui";

const TICKER = [
  "Mess bill", "Rickshaw to campus", "bKash cash-out", "Lecture sheet photocopy", "Fuchka with friends",
  "Tuition fee instalment", "GP 30-day pack", "Biriyani Friday", "Nagad send money", "Tong er cha",
  "Bus to Farmgate", "Lab report print",
];

const FEATURES = [
  ["receipt", "A ledger that reads like a diary", "Entries grouped by day, filter by category, month or bKash/Nagad/cash. Search finds that one biriyani in March."],
  ["target", "Limits that warn before they bite", "Set a monthly cap per category. Amber at 80%, red past 100% — and a dotted line showing where an even pace would be today."],
  ["bolt", "Safe-to-spend, per day", "What's left in your limits divided by the days left in the month. One number to check before buying that second coffee."],
  ["flag", "Goals with a deadline", "Laptop, Sajek trip, Eid shopping. It tells you how much a month it takes to get there on time."],
  ["chart", "Insights in plain English", "\"At this pace you run dry around the 24th.\" \"Thursdays cost you the most.\" Charts too, but the sentences do the work."],
  ["calendar", "The whole semester on one sheet", "Month × category, generated from your ledger. Nothing typed twice. Download it all as CSV whenever you like."],
];

export default async function LandingPage({ searchParams }) {
  const { deleted } = await searchParams;

  return (
    <>
      {deleted && (
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <Notice tone="green" icon="check">
            Your account and all its data have been deleted. Thanks for trying BudgetBD.
          </Notice>
        </div>
      )}

      {/* ---------------- Hero ---------------- */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 overflow-x-clip px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20 lg:pb-24">
        <div>
          <p className="rise eyebrow flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-green" />
            For university students in Bangladesh
          </p>
          <h1 className="rise mt-4 text-[clamp(2.75rem,8vw,5.25rem)] leading-[0.95] font-extrabold tracking-[-0.04em]" style={{ "--i": 1 }}>
            Know where every <span className="hl">taka</span> went.
          </h1>
          <p className="rise bn mt-4 text-xl font-semibold text-ink-2 sm:text-2xl" style={{ "--i": 2 }}>
            প্রতিটি টাকার হিসাব — এক খাতায়।
          </p>
          <p className="rise mt-5 max-w-xl text-lg text-ink-2" style={{ "--i": 3 }}>
            Allowance on the 1st, mess bill on the 3rd, rickshaw every day, and somehow nothing left by the 20th.
            BudgetBD is the khata that shows you why — and how much you can still spend today.
          </p>

          <div className="rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ "--i": 4 }}>
            <DemoButton className="sm:w-auto">Try the demo — no signup</DemoButton>
            <Link href="/signup" className="btn h-12 px-5 text-[0.9375rem]">
              Create a free account
            </Link>
          </div>
          <p className="rise hand mt-4 flex items-center gap-2 text-xl text-ink-2" style={{ "--i": 5 }}>
            <svg width="38" height="24" viewBox="0 0 38 24" fill="none" className="-scale-y-100 rotate-12" aria-hidden="true">
              <path d="M2 4c8 14 20 17 32 12M34 16l-6-6M34 16l-8 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            your own private sandbox, filled with six months of sample data
          </p>
        </div>

        <HeroReceipt />
      </section>

      {/* ---------------- Ticker ---------------- */}
      <div className="overflow-hidden border-y-[1.5px] border-edge bg-ink py-3 text-paper dark:bg-hl dark:text-[#1a1915]" aria-hidden="true">
        <div className="marquee flex w-max gap-8 font-mono text-sm font-semibold tracking-wide whitespace-nowrap uppercase">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="flex items-center gap-8">
              {item}
              <span className="bn text-hl dark:text-red">৳</span>
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- Features ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="eyebrow">What&apos;s in the khata</p>
          <h2 className="mt-2 text-4xl font-extrabold sm:text-5xl">Built around how students actually spend.</h2>
          <p className="mt-3 text-lg text-ink-2">
            Not &quot;Groceries&quot; and &quot;Utilities&quot;. Mess bill, rickshaw, recharge, photocopy, hangout — and
            whether it went out by cash, bKash or Nagad.
          </p>
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([icon, title, body], i) => (
            <li
              key={title}
              className={`card lift p-6 ${i % 3 === 1 ? "lg:translate-y-6" : ""}`}
              style={{ rotate: `${[-0.6, 0.4, -0.3, 0.5, -0.5, 0.3][i]}deg` }}
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl border-[1.5px] border-edge bg-hl text-[#1a1915]">
                  <Icon name={icon} size={20} strokeWidth={2.1} />
                </span>
                <span className="font-mono text-sm font-bold text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold">{title}</h3>
              <p className="mt-2 text-ink-2">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Steps ---------------- */}
      <section className="border-y-[1.5px] border-edge bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            ["Log it", "Press N (or the big + on your phone), type ৳40, tap Rickshaw. Five seconds."],
            ["Cap it", "Give the leaky categories a monthly limit. The app does the maths every time you log."],
            ["Read it", "Open Insights at the end of the week. It tells you what changed, in sentences."],
          ].map(([title, body], i) => (
            <div key={title} className="relative">
              <span className="hand absolute -top-6 -left-1 text-6xl text-hl [-webkit-text-stroke:1.5px_var(--ink)]">{i + 1}</span>
              <h3 className="relative pt-8 text-2xl font-extrabold">{title}</h3>
              <p className="mt-2 text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Under the hood ---------------- */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Under the hood</p>
          <h2 className="mt-2 text-4xl font-extrabold">Small app. Serious plumbing.</h2>
          <p className="mt-4 text-lg text-ink-2">
            Money is stored as integer <em>poisha</em>, never floats. Every page is rendered on the server with the real
            numbers in the HTML. Charts are hand-drawn SVG with zero charting libraries. And your data sits behind the
            same defences a bank&apos;s web app would start with.
          </p>
          <ul className="mt-6 space-y-2.5">
            {[
              "scrypt password hashing, hashed DB sessions, httpOnly cookies",
              "Per-request CSP nonce — injected scripts simply don't run",
              "Rate-limited login and signup, constant-time password checks",
              "Every query scoped to its owner; every form validated on the server",
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <Icon name="check" size={18} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="card overflow-hidden bg-[#141310]! font-mono text-[0.6875rem] text-[#e9e3d4] sm:text-[0.8125rem]">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
            <span className="size-3 rounded-full bg-[#ff6f6b]" />
            <span className="size-3 rounded-full bg-[#e5bf2e]" />
            <span className="size-3 rounded-full bg-[#43d095]" />
            <span className="ml-3 text-xs text-white/40">~/budgetbd</span>
          </div>
          <pre className="overflow-x-auto p-5 leading-relaxed">
            <span className="text-[#43d095]">$</span> cat stack.txt{"\n"}
            <span className="text-white/50">framework </span> Next.js 16 · App Router · RSC{"\n"}
            <span className="text-white/50">mutations </span> Server Actions (no REST layer){"\n"}
            <span className="text-white/50">database  </span> SQLite via node:sqlite{"\n"}
            <span className="text-white/50">money     </span> INTEGER poisha, CHECK &gt; 0{"\n"}
            <span className="text-white/50">auth      </span> scrypt · sha256(session) · __Host-{"\n"}
            <span className="text-white/50">charts    </span> hand-written SVG, 0 deps{"\n"}
            <span className="text-white/50">tests     </span> node --test · CI on push{"\n"}
            {"\n"}
            <span className="text-[#43d095]">$</span> npm test{"\n"}
            <span className="text-[#43d095]">✔</span> money parsing never drifts a poisha{"\n"}
            <span className="text-[#43d095]">✔</span> csv export neutralises =formulas{"\n"}
            <span className="text-[#43d095]">✔</span> login redirect can&apos;t leave the site{"\n"}
            <span className="text-[#43d095]">$</span> <span className="blink">▌</span>
          </pre>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="border-t-[1.5px] border-edge bg-hl text-[#1a1915]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-4xl font-extrabold sm:text-5xl">The 20th doesn&apos;t have to be broke day.</h2>
            <p className="bn mt-2 text-xl font-semibold">মাসের শেষেও পকেটে টাকা থাকুক।</p>
          </div>
          <Link href="/signup" className="btn btn-ink h-13 px-6 text-base">
            Start my ledger
            <Icon name="arrow" size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}

/** The hero art: a receipt printing out, a rubber stamp, a spinning seal. */
function HeroReceipt() {
  const lines = [
    ["01 OCT", "Allowance · bKash", "+6,000", true],
    ["03 OCT", "Mess bill", "−2,250"],
    ["05 OCT", "Rickshaw ×4", "−240"],
    ["07 OCT", "Lecture sheets", "−80"],
    ["09 OCT", "Fuchka w/ friends", "−150"],
    ["12 OCT", "GP internet pack", "−299"],
  ];

  return (
    <div className="relative mx-auto w-full max-w-sm lg:mr-0">
      {/* Spinning seal behind the receipt. */}
      <svg viewBox="0 0 120 120" className="spin-slow absolute -top-10 -right-1 z-0 size-28 text-ink sm:-right-5 sm:size-32" aria-hidden="true">
        <defs>
          <path id="seal" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="var(--hl)" stroke="currentColor" strokeWidth="1.5" />
        <text className="font-mono" fontSize="10.5" fontWeight="700" letterSpacing="2.4" fill="currentColor">
          <textPath href="#seal">MADE IN DHAKA • FOR STUDENTS • ৳ •</textPath>
        </text>
        <text x="60" y="70" textAnchor="middle" fontSize="30" fontWeight="700" fill="currentColor" className="bn">
          ৳
        </text>
      </svg>

      <div className="receipt-edge relative z-10 rotate-[1.5deg] card px-6 pt-6 pb-8">
        <div className="print">
          <p className="text-center font-mono text-sm font-bold tracking-[0.25em]">BUDGETBD KHATA</p>
          <p className="text-center font-mono text-[0.6875rem] text-ink-3">Room 4B · Mess &quot;Shanti Nibas&quot;</p>
          <hr className="perf my-4" />
          <ul className="space-y-2 font-mono text-[0.8125rem]">
            {lines.map(([date, what, amount, income]) => (
              <li key={date + what} className="flex gap-3">
                <span className="text-ink-3">{date}</span>
                <span className="flex-1 truncate">{what}</span>
                <span className={income ? "font-bold text-green" : "font-semibold"}>{amount}</span>
              </li>
            ))}
          </ul>
          <hr className="perf my-4" />
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-sm font-bold">LEFT TODAY</span>
            <span className="text-2xl font-bold">৳2,981</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between font-mono text-xs text-ink-3">
            <span>SAFE / DAY (19 days)</span>
            <span className="font-bold text-ink">৳156</span>
          </div>
        </div>

        <div className="stamp absolute -bottom-5 -left-3 z-20 rounded-md bg-card/80 border-[3px] border-green px-3 py-1 font-mono text-sm font-bold tracking-widest text-green uppercase opacity-90 mix-blend-multiply dark:mix-blend-screen">
          Under budget ✓
        </div>
      </div>
    </div>
  );
}
