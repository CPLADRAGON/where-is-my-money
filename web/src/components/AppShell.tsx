"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, LayoutDashboard, ListChecks, Settings, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Import", icon: Upload },
  { href: "/review", label: "Review", icon: ListChecks },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/export", label: "Export", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
            <span className="text-base font-semibold tracking-tight">Money Tracker</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              const badge = href === "/review" && needsReview > 0 ? needsReview : null;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-ink text-white"
                      : "text-body hover:bg-canvas-soft"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                  {badge != null && (
                    <span className="ml-0.5 grid min-w-5 place-items-center rounded-full bg-negative px-1 text-xs font-bold text-white">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-mute sm:px-6">
        {txCount > 0
          ? `${txCount} transactions loaded · stored only in your browser`
          : "Your data never leaves your browser."}
      </footer>
    </div>
  );
}
