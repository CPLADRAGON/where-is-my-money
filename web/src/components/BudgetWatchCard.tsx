"use client";

import { useMemo } from "react";
import { Card, CardBody, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useStore } from "@/lib/store";
import { computeBudgets, overBudgetCount } from "@/lib/budgets";
import { PILLAR_COLORS } from "@/lib/taxonomy";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Transaction } from "@/lib/types";

export function BudgetWatchCard({
  tx,
  onRowClick,
}: {
  tx: Transaction[];
  onRowClick?: (sub: string) => void;
}) {
  const t = useT();
  const budgets = useStore((s) => s.budgets);
  const rows = useMemo(() => computeBudgets(tx, budgets), [tx, budgets]);
  if (rows.length === 0) return null;
  const over = overBudgetCount(rows);

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2">
          <CardTitle>{t("budgets.title")}</CardTitle>
          {over > 0 && <Badge tone="negative">{t("budgets.overCount", { n: over })}</Badge>}
        </div>
        <ul className="mt-3 grid gap-3">
          {rows.map((r) => {
            const widthPct = Math.min(100, Math.round(r.pct * 100));
            const color = r.over ? "var(--color-negative)" : PILLAR_COLORS[r.pillar];
            return (
              <li key={r.sub}>
                <button
                  onClick={() => onRowClick?.(r.sub)}
                  data-testid="budget-row"
                  className="block w-full rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-canvas-soft"
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{r.sub}</span>
                    <span className="tabular text-xs text-mute">
                      {t("budgets.spentOfCap", {
                        spent: formatSGD(r.spent),
                        cap: formatSGD(r.cap),
                      })}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-canvas-soft">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: color }}
                    />
                  </div>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: r.over ? "var(--color-negative)" : "var(--color-mute)" }}
                  >
                    {r.over
                      ? t("budgets.over", { amount: formatSGD(r.spent - r.cap) })
                      : t("budgets.left", { amount: formatSGD(r.cap - r.spent) })}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
