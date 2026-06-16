"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, LayoutDashboard, ListChecks, Settings, Download, Upload, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { useT } from "@/lib/i18n";

const NAV = [
  { href: "/", key: "nav.import", icon: Upload },
  { href: "/transactions", key: "nav.transactions", icon: ListChecks },
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/recurring", key: "nav.recurring", icon: Repeat },
  { href: "/export", key: "nav.export", icon: Download },
  { href: "/settings", key: "nav.settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const txCount = useStore((s) => s.transactions.length);
  const needsReview = useStore(
    (s) => s.transactions.filter((t) => t.provenance === "default").length
  );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-hairline bg-page/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-primary text-on-primary">
              <Wallet className="size-5" />
            </span>
            <span className="text-base font-semibold tracking-tight" suppressHydrationWarning>
              {t("brand")}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map(({ href, key, icon: Icon }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);
                const badge = href === "/transactions" && needsReview > 0 ? needsReview : null;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-primary text-on-primary"
                        : "text-body hover:bg-canvas-soft"
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline" suppressHydrationWarning>
                      {t(key)}
                    </span>
                    {badge != null && (
                      <span className="ml-0.5 grid min-w-5 place-items-center rounded-full bg-negative px-1 text-xs font-bold text-white">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-24 pt-4 text-center text-xs text-mute sm:px-6 sm:pb-10">
        <span suppressHydrationWarning>
          {txCount > 0
            ? t("footer.loaded", { n: txCount })
            : t("footer.private")}
        </span>
      </footer>

      {/* Mobile bottom tab bar — replaces the overflowing top nav on small screens */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-page/90 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-6xl items-stretch justify-around">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const badge = href === "/transactions" && needsReview > 0 ? needsReview : null;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-mute hover:text-body"
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {badge != null && (
                    <span className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full bg-negative px-1 text-[9px] font-bold text-white">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate" suppressHydrationWarning>
                  {t(key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
