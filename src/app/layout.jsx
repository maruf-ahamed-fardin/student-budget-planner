import { Bricolage_Grotesque, Caveat, Hind_Siliguri, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";

import "./globals.css";

/**
 * Four faces, each with one job:
 *   Bricolage Grotesque — headings and UI, a grotesk with some character
 *   JetBrains Mono      — every figure, so columns of Taka line up
 *   Caveat              — margin notes, the hand-written voice
 *   Hind Siliguri       — Bangla text and the ৳ sign, which the others lack
 * All self-hosted by next/font at build time: no request to Google at runtime,
 * which is also what lets the CSP say `font-src 'self'`.
 */
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", weight: ["400", "500", "600", "700"] });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap", weight: ["500", "600", "700"] });
const hind = Hind_Siliguri({ subsets: ["bengali"], variable: "--font-hind", display: "swap", weight: ["400", "600", "700"] });

export const metadata = {
  title: { default: "BudgetBD — the student money ledger", template: "%s · BudgetBD" },
  description:
    "Track allowance, mess bills, rickshaw fares and bKash spends. Set budgets, save for goals and see a whole semester at a glance — built for Bangladeshi university students.",
  applicationName: "BudgetBD",
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#11100e" },
  ],
};

export default async function RootLayout({ children }) {
  // Read on the server, so the very first painted frame is the right theme.
  const store = await cookies();
  const theme = store.get("sbp-theme")?.value === "dark" ? "dark" : "light";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${bricolage.variable} ${mono.variable} ${caveat.variable} ${hind.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-hl focus:px-4 focus:py-2 focus:font-semibold focus:text-[#1a1915]"
        >
          Skip to content
        </a>
        {children}
        <Toaster
          position="top-center"
          theme={theme}
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border-[1.5px] !border-edge !bg-card !text-ink !shadow-[3px_3px_0_var(--shadow)] !font-[family-name:var(--font-display)]",
              description: "!text-ink-3",
            },
          }}
        />
      </body>
    </html>
  );
}
