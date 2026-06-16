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
            <nav className="flex items-center gap-1">
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-mute sm:px-6">
        <span suppressHydrationWarning>
          {txCount > 0
            ? t("footer.loaded", { n: txCount })
            : t("footer.private")}
        </span>
      </footer>
    </div>
  );
}
