"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

function isDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Light/dark toggle. Persists choice and updates <html class="dark">. */
export function ThemeToggle() {
  // Initial value matches the pre-paint script in layout.tsx (no effect needed).
  const [dark, setDark] = useState<boolean>(isDark);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("mt-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      suppressHydrationWarning
      className="grid size-9 place-items-center rounded-full text-body transition-colors hover:bg-canvas-soft"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
