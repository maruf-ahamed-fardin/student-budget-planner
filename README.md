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

The whole app is one Node process and one SQLite file, so it needs a host with a **persistent
disk**: a VPS, Railway, Render or Fly.io with a volume. Serverless platforms with an ephemeral
filesystem (e.g. Vercel, Netlify) would lose every account between requests. Run **one
instance**: SQLite is a single file, so it can't be shared by several containers.

### Docker (recommended)

```bash
docker build -t budgetbd .
docker run -d --name budgetbd -p 3000:3000 -v budgetbd-data:/data --restart unless-stopped budgetbd
```

The image is multi-stage. It installs from the lockfile with install scripts disabled, builds
Next's `standalone` output, and runs as the unprivileged `node` user with only the traced
files. The database lives on the `/data` volume, and a `HEALTHCHECK` polls `/api/health`.
CI builds this image on every push and checks that it boots, serves pages with the CSP and
restarts cleanly.

### Render / Railway / Fly.io

Point the platform at the `Dockerfile`. Attach a volume mounted at `/data` and set the health
check path to `/api/health`. The platform's proxy terminates HTTPS, which the app needs: the
session cookie is `Secure` in production, so plain HTTP logins won't stick (`localhost` excepted).

### Plain Node (VPS)

```bash
npm ci --ignore-scripts && npm run build
DATABASE_PATH=/var/lib/budgetbd/budget.db PORT=3000 npm start
```

Put nginx or Caddy in front for HTTPS, and run the process under systemd or pm2 so it restarts.

### Configuration

All optional; see [`.env.example`](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_PATH` | `./data/budget.db` (`/data/budget.db` in Docker) | Where the SQLite file lives |
| `TRUSTED_PROXY_HOPS` | `1` | Proxies in front of the app; used to find the real client IP for rate limiting. Use `2` for Cloudflare → nginx. |
| `SERVER_ACTIONS_ALLOWED_ORIGINS` | — | **Build-time.** Extra hosts allowed to submit forms, only if a proxy rewrites `Host`. |
| `PORT` / `HOSTNAME` | `3000` / `0.0.0.0` | Where the server listens |

### Backups

The database runs in WAL mode, so copy it with SQLite's backup command rather than `cp` while the
app is running:

```bash
docker exec budgetbd node -e "new (require('node:sqlite').DatabaseSync)('/data/budget.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker cp budgetbd:/data/backup.db ./budgetbd-$(date +%F).db
```

---

Started as a Web Programming group project at Uttara University.
