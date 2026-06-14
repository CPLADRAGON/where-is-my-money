"use client";

import { Languages } from "lucide-react";
import { setLang, useLang } from "@/lib/i18n";

/** EN / 中 language toggle. */
export function LangToggle() {
  const lang = useLang();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "zh" : "en")}
      aria-label="Switch language"
      suppressHydrationWarning
      className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-semibold text-body transition-colors hover:bg-canvas-soft"
    >
      <Languages className="size-4" />
      <span suppressHydrationWarning>{lang === "en" ? "中" : "EN"}</span>
    </button>
  );
}
