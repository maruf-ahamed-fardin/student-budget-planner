import { cookies } from "next/headers";
import Link from "next/link";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

import { BottomNav, NavLinks, ThemeToggle } from "@/client";
import { Icon } from "@/ui";

import "./globals.css";

/**
 * Inter has no Bengali coverage, so the Taka sign (৳) falls through to the
 * system Bengali faces listed in `--font-sans` (globals.css). Bundling a whole
 * Bengali webfont for one glyph is not worth the download.
 */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata = {
  title: { default: "BudgetBD — Student Budget Planner", template: "%s · BudgetBD" },
  description:
    "Track allowance, mess bills and rickshaw fares, set category budgets and plan a semester — built for Bangladeshi university students.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1226",
};

export default async function RootLayout({ children }) {
  // Read on the server, so the very first painted frame is the right theme.
  const store = await cookies();
  const theme = store.get("sbp-theme")?.value === "dark" ? "dark" : "light";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={inter.variable}
      suppressHydrationWarning
    >
      <body>
        {/* Navy in both themes, so the brand surface stays constant. */}
        <header className="sticky top-0 z-50 bg-navy-900">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid size-7 place-items-center rounded bg-gold-500 text-navy-950">
                <Icon name="wallet" size={16} strokeWidth={2} />
              </span>
              <span className="text-white">
                Budget<span className="text-gold-400">BD</span>
              </span>
            </Link>

            <NavLinks />
            <ThemeToggle theme={theme} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>

        <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
          <p className="border-t border-line pt-4 text-center text-xs text-ink-muted">
            BudgetBD · Web Programming group project · Uttara University
          </p>
        </footer>

        <BottomNav />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
