"use client";

import { useStore } from "@/lib/store";

/** Renders children only after the IndexedDB-backed store has hydrated. */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useStore((s) => s._hydrated);

  if (!hydrated) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-mute">
        <div className="animate-pulse text-sm">Loading your data…</div>
      </div>
    );
  }
  return <>{children}</>;
}
