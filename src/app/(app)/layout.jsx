import { cookies } from "next/headers";
import Link from "next/link";

import { LogoutButton } from "@/components/forms";
import { Icon, Logo } from "@/components/icons";
import { MenuLink, MobileMenu, SideNav, TabBar, ThemeToggle } from "@/components/shell";
import { AddEntryButton, EntryDialogProvider } from "@/components/tx-dialog";
import { requireUser } from "@/lib/auth";
import { initials, NAV_ITEMS, today } from "@/lib/utils";

/**
 * The signed-in shell. `requireUser()` here is the gate for every page inside
 * (app)/ — each page calls it again for its own data, which React `cache`
 * collapses into a single lookup per request.
 */
export default async function AppLayout({ children }) {
  const user = await requireUser();
  const theme = (await cookies()).get("sbp-theme")?.value === "dark" ? "dark" : "light";

  return (
    <EntryDialogProvider today={today()}>
      <div className="md:grid md:grid-cols-[84px_minmax(0,1fr)] lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* ---- Rail / sidebar (tablet + desktop) ---- */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r-[1.5px] border-edge bg-card px-3 py-5 md:flex lg:px-4">
          <Link href="/dashboard" className="mb-7 flex items-center justify-center gap-2.5 lg:justify-start lg:px-1">
            <Logo />
            <span className="hidden text-xl font-extrabold tracking-tight lg:inline">
              Budget<span className="bn text-red">BD</span>
            </span>
          </Link>

          <AddEntryButton className="btn btn-ink mb-6 h-11 w-full px-0 lg:justify-between lg:px-4">
            <span className="flex items-center gap-2">
              <Icon name="plus" size={18} strokeWidth={2.5} />
              <span className="hidden lg:inline">New entry</span>
            </span>
            <kbd className="hidden rounded border border-paper/30 px-1.5 font-mono text-[0.6875rem] opacity-70 lg:inline">N</kbd>
          </AddEntryButton>

          <SideNav />

          <div className="mt-auto space-y-2">
            {user.isDemo ? (
              <Link
                href="/signup"
                className="hidden rounded-xl border-[1.5px] border-dashed border-ink-3 p-3 text-[0.8125rem] lg:block"
              >
                <span className="hand block text-xl leading-none">psst — this is a sandbox</span>
                <span className="mt-1 block text-ink-3">Wiped in 24h. Make it yours →</span>
              </Link>
            ) : null}
            <div className="flex flex-col items-center gap-2 border-t-[1.5px] border-dashed border-rule pt-3 lg:flex-row">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-edge bg-green font-mono text-xs font-bold text-white">
                {initials(user.name)}
              </span>
              <div className="hidden min-w-0 flex-1 lg:block">
                <p className="truncate text-sm font-bold">{user.name}</p>
                <p className="truncate text-xs text-ink-3">{user.university || "Student"}</p>
              </div>
              <ThemeToggle theme={theme} />
            </div>
            <LogoutButton className="justify-center lg:justify-start" labelClassName="hidden lg:inline" />
          </div>
        </aside>

        <div className="min-w-0">
          {/* ---- Top bar (phone) ---- */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-[1.5px] border-edge bg-card/95 px-4 backdrop-blur md:hidden">
            <Link href="/dashboard" className="flex h-11 items-center gap-2">
              <Logo size={30} />
              <span className="text-lg font-extrabold tracking-tight">
                Budget<span className="bn text-red">BD</span>
              </span>
            </Link>
            <div className="flex items-center gap-1.5">
              <ThemeToggle theme={theme} />
              <MobileMenu>
                <p className="px-3 pt-1 pb-2 text-xs text-ink-3">
                  Signed in as <span className="font-semibold text-ink">{user.name}</span>
                </p>
                {NAV_ITEMS.slice(4).map((item) => (
                  <MenuLink key={item.href} href={item.href} icon={item.icon}>
                    {item.label}
                  </MenuLink>
                ))}
                <MenuLink href="/settings" icon="settings">
                  Settings
                </MenuLink>
                <hr className="perf my-1.5" />
                <LogoutButton />
              </MobileMenu>
            </div>
          </header>

          {user.isDemo ? (
            <div className="flex items-center justify-center gap-2 border-b-[1.5px] border-edge bg-hl px-4 py-1.5 text-center text-[0.8125rem] font-semibold text-[#1a1915]">
              <Icon name="clock" size={14} />
              <span>
                Demo sandbox — yours alone, wiped after 24 hours.{" "}
                <Link href="/signup" className="underline underline-offset-2">
                  Keep your own ledger
                </Link>
              </span>
            </div>
          ) : null}

          <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 md:pb-12 lg:px-10 lg:pt-9">
            {children}
          </main>
        </div>
      </div>

      <TabBar />
    </EntryDialogProvider>
  );
}
