"use client";

import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { CATEGORIES, PILLARS, type Pillar } from "@/lib/taxonomy";
import { serializeFilter, type SortKey, type TxFilter } from "@/lib/filters";
import { formatMonthLabel } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const SORTS: SortKey[] = ["date_desc", "date_asc", "amount_desc", "amount_asc"];

export function TransactionFilters({
  filter,
  months,
}: {
  filter: TxFilter;
  months: string[];
}) {
  const router = useRouter();
  const t = useT();

  function update(patch: Partial<TxFilter>) {
    const next: TxFilter = { ...filter, ...patch };
    if (patch.pillar !== undefined && next.sub && !CATEGORIES[next.pillar as Pillar]?.includes(next.sub)) {
      delete next.sub;
    }
    const qs = serializeFilter(next);
    router.replace(qs ? `/transactions?${qs}` : "/transactions", { scroll: false });
  }

  const subs = filter.pillar ? CATEGORIES[filter.pillar] : [];
  const hasFilters =
    filter.pillar || filter.sub || filter.month || filter.from || filter.to || filter.type || filter.review || filter.q;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={t("filter.pillar")}
        value={filter.pillar ?? ""}
        onChange={(e) => update({ pillar: (e.target.value || undefined) as Pillar | undefined, sub: undefined })}
      >
        <option value="">{t("filter.allPillars")}</option>
        {PILLARS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("filter.sub")}
        value={filter.sub ?? ""}
        disabled={!filter.pillar}
        onChange={(e) => update({ sub: e.target.value || undefined })}
      >
        <option value="">{t("filter.allSubs")}</option>
        {subs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("filter.month")}
        value={filter.month ?? "all"}
        onChange={(e) => update({ month: e.target.value === "all" ? undefined : e.target.value, from: undefined, to: undefined })}
      >
        <option value="all">{t("range.all")}</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonthLabel(m)}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("filter.type")}
        value={filter.type ?? ""}
        onChange={(e) => update({ type: (e.target.value || undefined) as TxFilter["type"] })}
      >
        <option value="">{t("filter.allTypes")}</option>
        <option value="spending">{t("filter.spending")}</option>
        <option value="transfer">{t("filter.transfer")}</option>
      </Select>

      <Button
        size="sm"
        variant={filter.review ? "primary" : "secondary"}
        onClick={() => update({ review: filter.review ? undefined : true })}
      >
        {t("filter.needsReview")}
      </Button>

      <label className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2">
        <Search className="size-4 text-mute" />
        <input
          aria-label={t("filter.search")}
          value={filter.q ?? ""}
          onChange={(e) => update({ q: e.target.value || undefined })}
          placeholder={t("filter.search")}
          className="h-9 bg-transparent text-sm outline-none"
        />
      </label>

      <Select
        aria-label={t("filter.sort")}
        value={filter.sort}
        onChange={(e) => update({ sort: e.target.value as SortKey })}
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </Select>

      {hasFilters && (
        <Button size="sm" variant="ghost" onClick={() => router.replace("/transactions", { scroll: false })}>
          <X className="size-4" /> {t("filter.clear")}
        </Button>
      )}
    </div>
  );
}
