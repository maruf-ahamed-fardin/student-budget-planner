import { cookies } from "next/headers";
import Link from "next/link";

import { Logo } from "@/components/icons";
import { ThemeToggle } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";

export default async function SiteLayout({ children }) {
  const user = await getCurrentUser();
  const theme = (await cookies()).get("sbp-theme")?.value === "dark" ? "dark" : "light";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[1.5px] border-edge bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-xl font-extrabold tracking-tight">
              Budget<span className="bn text-red">BD</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle theme={theme} />
            {user ? (
              <Link href="/dashboard" className="btn btn-ink btn-sm">
                Open my ledger
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Log in
                </Link>
                <Link href="/signup" className="btn btn-ink btn-sm">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t-[1.5px] border-edge bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            <span className="bn font-semibold text-ink">হিসাব রাখো, টেনশন কমাও।</span> Built in Dhaka for students who count
            every taka.
          </p>
          <p className="font-mono text-xs">Next.js 16 · React 19 · SQLite · no trackers</p>
        </div>
      </footer>
    </div>
  );
}
