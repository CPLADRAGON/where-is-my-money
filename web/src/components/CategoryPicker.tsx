"use client";

import { CATEGORIES, PILLARS, subCategoriesFor, type Pillar } from "@/lib/taxonomy";
import { useT } from "@/lib/i18n";
import { Select } from "./Select";

/** Dependent Pillar → Sub-Category picker. */
export function CategoryPicker({
  pillar,
  sub,
  onChange,
  compact,
  uncategorized,
}: {
  pillar: Pillar;
  sub: string;
  onChange: (pillar: Pillar, sub: string) => void;
  compact?: boolean;
  /** When true, the sub-category shows a placeholder so the user must choose explicitly. */
  uncategorized?: boolean;
}) {
  const t = useT();
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
        value={uncategorized ? "" : sub}
        onChange={(e) => onChange(pillar, e.target.value)}
      >
        {uncategorized && (
          <option value="" disabled>
            {t("category.select")}
          </option>
        )}
        {subs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </div>
  );
}
