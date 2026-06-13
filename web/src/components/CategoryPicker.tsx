"use client";

import { CATEGORIES, PILLARS, subCategoriesFor, type Pillar } from "@/lib/taxonomy";
import { Select } from "./Select";

/** Dependent Pillar → Sub-Category picker. */
export function CategoryPicker({
  pillar,
  sub,
  onChange,
  compact,
}: {
  pillar: Pillar;
  sub: string;
  onChange: (pillar: Pillar, sub: string) => void;
  compact?: boolean;
}) {
  const subs = subCategoriesFor(pillar);
  const cls = compact ? "h-9 text-sm" : "";
  return (
    <div className="flex flex-wrap gap-2">
      <Select
        aria-label="Main pillar"
        className={cls}
        value={pillar}
        onChange={(e) => {
          const p = e.target.value as Pillar;
          onChange(p, CATEGORIES[p][0]);
        }}
      >
        {PILLARS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Sub-category"
        className={cls}
        value={sub}
        onChange={(e) => onChange(pillar, e.target.value)}
      >
        {subs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </div>
  );
}
