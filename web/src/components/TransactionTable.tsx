"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { CategoryPicker } from "@/components/CategoryPicker";
import { useStore } from "@/lib/store";
import { CATEGORIES, PILLARS, isSpending, type Pillar } from "@/lib/taxonomy";
import { formatSGD, formatMonthLabel } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Provenance, Transaction } from "@/lib/types";

const PROV_TONE: Record<Provenance, "rule" | "learned" | "manual" | "default"> = {
  rule: "rule",
  learned: "learned",
  manual: "manual",
  default: "default",
};

export function TransactionTable({ rows }: { rows: Transaction[] }) {
  const tr = useT();
  const setCategory = useStore((s) => s.setCategory);
  const bulkSetCategory = useStore((s) => s.bulkSetCategory);

  const [remember, setRemember] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPillar, setBulkPillar] = useState<Pillar>("Variable Wants");
  const [bulkSub, setBulkSub] = useState<string>("Shopping");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function applyBulk() {
    if (selected.size === 0) return;
    bulkSetCategory(Array.from(selected), bulkPillar, bulkSub, remember);
    setSelected(new Set());
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 rounded-full bg-canvas-soft px-3 py-1.5 text-sm font-medium">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {tr("review.rememberMerchant")}
        </label>
      </div>

      {selected.size > 0 && (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">{tr("review.selectedN", { n: selected.size })}</span>
            <select
              className="h-9 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2 text-sm"
              value={bulkPillar}
              onChange={(e) => {
                const p = e.target.value as Pillar;
                setBulkPillar(p);
                setBulkSub(CATEGORIES[p][0]);
              }}
            >
              {PILLARS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2 text-sm"
              value={bulkSub}
              onChange={(e) => setBulkSub(e.target.value)}
            >
              {CATEGORIES[bulkPillar].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Button size="sm" onClick={applyBulk}>
              {tr("review.applyTo", { n: selected.size })}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {tr("review.clear")}
            </Button>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline bg-canvas-soft text-left text-xs uppercase tracking-wide text-mute">
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2">{tr("th.date")}</th>
                <th className="px-3 py-2">{tr("th.description")}</th>
                <th className="px-3 py-2 text-right">{tr("th.amount")}</th>
                <th className="px-3 py-2">{tr("th.source")}</th>
                <th className="px-3 py-2">{tr("th.category")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-hairline/60 align-middle hover:bg-primary-pale/30">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular text-mute">
                    {formatMonthLabel(t.month).split(" ")[0]} {t.date.slice(8, 10)}
                  </td>
                  <td className="max-w-xs px-3 py-2">
                    <span className="line-clamp-2 text-body">{t.description}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular font-semibold">
                    {formatSGD(t.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={PROV_TONE[t.provenance]}>{t.provenance}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CategoryPicker
                        compact
                        pillar={t.pillar}
                        sub={t.sub}
                        onChange={(p, s) => setCategory(t.id, p, s, remember)}
                      />
                      {!isSpending(t.pillar) && (
                        <span className="whitespace-nowrap rounded-full bg-canvas-soft px-2 py-0.5 text-[10px] font-semibold text-mute">
                          {tr("review.notSpending")}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
