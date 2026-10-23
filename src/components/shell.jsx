"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useOptimistic, useRef, useTransition } from "react";

import { setTheme } from "@/app/actions/account";
import { Icon } from "@/components/icons";
import { AddEntryButton } from "@/components/tx-dialog";
import { cx, isActivePath, NAV_ITEMS } from "@/lib/utils";

/**
 * Navigation. Three layouts from one list:
 *   phone   (< md)  top bar + bottom tab bar with a raised "+" in the middle
 *   tablet  (md–lg) a narrow icon rail
 *   desktop (lg+)   the full sidebar with labels
 */

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {[...NAV_ITEMS, { href: "/settings", label: "Settings", icon: "settings" }].map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={cx(
              "group relative flex h-11 items-center gap-3 rounded-[10px] border-[1.5px] px-3 text-[0.9375rem] font-semibold transition-colors",
              "justify-center lg:justify-start",
              active
                ? "border-edge bg-hl text-[#1a1915] shadow-[2px_2px_0_var(--shadow)]"
                : "border-transparent text-ink-2 hover:border-rule hover:bg-card hover:text-ink",
            )}
          >
            <Icon
              name={item.icon}
              size={19}
              strokeWidth={active ? 2.3 : 1.9}
              className="shrink-0 transition-transform group-hover:-rotate-6"
            />
            <span className="hidden lg:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone tab bar: four destinations and a big thumb-sized "+" between them. */
export function TabBar() {
  const pathname = usePathname();
  const [home, ledger, budget, goals] = NAV_ITEMS;

  const tab = (item) => {
    const active = isActivePath(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex flex-col items-center justify-center gap-0.5 py-2 text-[0.6875rem] font-semibold transition-colors",
          active ? "text-ink" : "text-ink-3",
        )}
      >
        <span
          className={cx(
            "grid h-7 w-12 place-items-center rounded-full transition-all",
            active && "bg-hl text-[#1a1915]",
          )}
        >
          <Icon name={item.icon} size={19} strokeWidth={active ? 2.3 : 1.9} />
        </span>
        {item.short}
      </Link>
    );
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-edge bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <nav aria-label="Primary" className="grid grid-cols-5 items-end">
        {tab(home)}
        {tab(ledger)}
        <div className="flex justify-center">
          <AddEntryButton
            label="Add entry"
            className="btn btn-hl -mt-6 size-14 rounded-2xl p-0 shadow-[3px_3px_0_var(--shadow)]"
          >
            <Icon name="plus" size={26} strokeWidth={2.6} />
            <span className="sr-only">Add entry</span>
          </AddEntryButton>
        </div>
        {tab(budget)}
        {tab(goals)}
      </nav>
    </div>
  );
}

/**
 * The overflow menu on phones (Insights, Semester, Settings, sign out). A
 * <details> element: it opens and closes with no JavaScript at all; the
 * effect only closes it after navigating and on outside clicks.
 */
export function MobileMenu({ children }) {
  const pathname = usePathname();
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function onClick(event) {
      if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false;
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <details ref={ref} className="group relative">
      <summary
        className="icon-btn cursor-pointer list-none border-[1.5px] border-rule [&::-webkit-details-marker]:hidden"
        aria-label="Menu"
      >
        <Icon name="more" size={18} />
      </summary>
      <div className="card absolute top-11 right-0 z-50 w-56 p-2 rise">{children}</div>
    </details>
  );
}

export function MenuLink({ href, icon, children }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);
  return (
    <Link
      href={href}
      className={cx(
        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
        active ? "bg-hl text-[#1a1915]" : "text-ink-2 hover:bg-card-2",
      )}
    >
      <Icon name={icon} size={17} />
      {children}
    </Link>
  );
}

/**
 * The server owns the theme (cookie → data-theme on <html> during SSR). The
 * toggle flips the attribute immediately so the change feels instant, then
 * persists it through a server action.
 */
export function ThemeToggle({ theme, className, withLabel = false }) {
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(theme);
  const next = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        startTransition(async () => {
          setCurrent(next);
          await setTheme(next);
        });
      }}
      className={cx(withLabel ? "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink-2 hover:bg-card-2" : "icon-btn", className)}
    >
      <Icon name={current === "dark" ? "sun" : "moon"} size={18} className="wobble" />
      {withLabel && (current === "dark" ? "Light mode" : "Dark mode")}
    </button>
  );
}
