# BudgetBD — the student money ledger

**প্রতিটি টাকার হিসাব — এক খাতায়।** A budget planner built for Bangladeshi university students:
allowance over bKash on the 1st, the mess bill on the 3rd, rickshaw every day, photocopies before
exams — and a clear answer to *"how much can I still spend today?"*

> **Try it:** run it locally (below) and click **Try the demo**. Every visitor gets a private sandbox
> with six months of realistic data, deleted automatically after 24 hours.

## Features

| | |
|---|---|
| **Dashboard** | Wallet balance, money parked in goals, *safe-to-spend per day*, month-over-month change, a spending heat-calendar, budget health, and a receipt of recent entries. |
| **Ledger** | Grouped by day, filter by type / category / payment method / month, full-text search, pagination. Add or edit from anywhere (press <kbd>N</kbd>), tap a row on a phone to edit. |
| **Budget** | A monthly cap per category with amber/red states, an "even pace" marker for today, and last month for comparison. |
| **Goals** | Savings goals with deadlines, deposits and withdrawals, and the monthly amount needed to land on time. |
| **Insights** | Plain-English findings ("At this pace you run dry around the 24th", "Thursdays cost you the most"), a category donut, a six-month trend, weekday pattern, payment-method split, biggest expenses. |
| **Semester** | Month × category matrix for a whole term, generated from the ledger. |
| **Settings** | Profile, password change, sign out other devices, CSV export, delete account. |
| **Local by design** | Categories like Mess Bill, Rickshaw, Recharge & Data, Photocopy & Books; payment via Cash, bKash, Nagad, Rocket, Card or Bank; dates in Asia/Dhaka. |

Light and dark themes, fully responsive (phone tab bar with a thumb-reach **+**, tablet icon rail,
desktop sidebar), keyboard accessible, and every animation respects `prefers-reduced-motion`.

## Running it

Requires **Node 22.13+** (for the built-in `node:sqlite`).

```bash
npm install
npm run seed     # optional: a local account with sample data (credentials are printed)
npm run dev      # http://localhost:3000
```

| Script | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Unit tests (`node --test`, no extra dependencies) |
| `npm run lint` | ESLint |
| `npm run seed` | Create or reset `student@budgetbd.local` with six months of data |

Set `DATABASE_PATH` to put the SQLite file somewhere other than `./data/budget.db`.

## How it's built

**Next.js 16 App Router, React 19, Tailwind CSS 4, SQLite — and nothing else of note.** No ORM, no
auth library, no charting library, no state manager.

- **Server-first.** Every page is a Server Component that queries SQLite and ships finished HTML.
  Client JavaScript is limited to forms, navigation and the add/edit dialog.
- **Mutations are Server Actions** (`src/app/actions/`). Each resolves the user, validates every
  field on the server, and writes with `user_id = ?` in the `WHERE` clause.
- **Money is integer poisha** (1 ৳ = 100 poisha), never floating point, with `CHECK` constraints in
  the schema as a last line of defence.
- **Dates are `YYYY-MM-DD` strings fixed to Dhaka time**, so a 1 a.m. rickshaw fare never lands in
  the wrong month because the server runs in UTC.
- **Charts are hand-written SVG/HTML** rendered on the server. They have hover and keyboard
  tooltips, and the colour palette is validated for colour-vision deficiency and contrast in both
  themes. Colour follows the category, never its rank.
- **Versioned migrations** via `PRAGMA user_version` (`src/lib/schema.js`). The old single-user
  tables are renamed to `legacy_*`, never dropped.

### Security

| Threat | Defence |
|---|---|
| Stolen database | Passwords hashed with **scrypt** (N=2¹⁵), per-user salt. Sessions stored only as **SHA-256 of the token**. |
| Session theft via XSS | Session cookie is `httpOnly`, `SameSite=Lax`, `Secure`, `__Host-` prefixed in production. |
| XSS | **Per-request CSP nonce** with `strict-dynamic` (`src/proxy.js`); React escapes output; tooltips use `attr()` text. |
| CSRF | SameSite cookies plus Next.js Server Actions' Origin check. |
| Brute force | Sliding-window **rate limits** in SQLite: per IP and per email for login, per IP for signup and demo. |
| User enumeration | One error message for wrong email or password, and a dummy scrypt run so both take equal time. |
| IDOR | Every query and write is scoped to the session's `user_id`. |
| Open redirect | `?next=` accepts same-origin paths only (`safeNextPath`, tested). |
| CSV / formula injection | Export prefixes `= + - @` cells with `'` (tested). |
| Clickjacking, sniffing | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`. |

## Project layout

```
src/
  proxy.js                CSP nonce + early auth redirect (Next 16's middleware)
  app/
    layout.jsx            fonts, theme cookie, toasts
    (site)/               landing, login, signup
    (app)/                signed-in shell + dashboard, transactions, budget, goals,
                          insights, semester, settings
    actions/              server actions: auth, ledger, account
    api/export/route.js   CSV download
  components/             ui (server), charts (server SVG), forms / dialog / shell (client)
  lib/
    db.js schema.js       connection, migrations
    auth.js password.js   sessions, rate limits, scrypt
    queries.js            every read, all scoped by user
    insights.js           the plain-English findings (pure)
    utils.js csv.js       money, dates, categories, CSV (pure)
    sample-data.js        the demo semester
tests/                    node --test suites for the pure modules
```

## Deploying

The app keeps state in one SQLite file, so it needs a host with a **persistent disk**: a VPS,
Railway, Render or Fly.io with a volume, pointing `DATABASE_PATH` at the volume. Serverless
platforms with ephemeral filesystems (e.g. Vercel) would lose data between invocations.

Behind a reverse proxy, make sure it sets `X-Forwarded-For` and `X-Forwarded-Proto`; the rate
limiter and the CSP's `upgrade-insecure-requests` read them.

---

Started as a Web Programming group project at Uttara University.
