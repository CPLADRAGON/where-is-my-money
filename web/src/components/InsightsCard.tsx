"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/Card";
import { useStore } from "@/lib/store";
import { computeInsights, type MoverRow } from "@/lib/insights";
import { PILLAR_COLORS } from "@/lib/taxonomy";
import { formatSGD, formatMonthLabel } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function InsightsCard() {
  const t = useT();
  const router = useRouter();
  const transactions = useStore((s) => s.transactions);
  const months = useStore((s) => s.months);
  const insights = useMemo(
    () => computeInsights(transactions, months),
    [transactions, months]
  );
  if (!insights) return null;

  const { currentMonth, previousMonth, spentDelta, topMovers, biggestCategory } = insights;
  const prevLabel = formatMonthLabel(previousMonth);
  const curLabel = formatMonthLabel(currentMonth);

  let headline: string;
  let tone: "negative" | "positive" | "mute";
  if (Math.abs(spentDelta) < 0.005) {
    headline = t("insights.spentSame", { prev: prevLabel });
    tone = "mute";
  } else if (spentDelta > 0) {
    headline = t("insights.spentMore", { amount: formatSGD(spentDelta), prev: prevLabel });
    tone = "negative";
  } else {
    headline = t("insights.spentLess", { amount: formatSGD(-spentDelta), prev: prevLabel });
    tone = "positive";
  }
  const toneColor =
    tone === "negative"
      ? "var(--color-negative)"
      : tone === "positive"
      ? "var(--color-positive)"
      : "var(--color-mute)";

  function drill(sub: string) {
    router.push(`/transactions?month=${currentMonth}&sub=${encodeURIComponent(sub)}`);
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-primary-pale text-ink-deep">
            <Sparkles className="size-4" />
          </span>
          <CardTitle>{t("insights.title")}</CardTitle>
          <span className="ml-auto text-xs text-mute">
            {t("insights.subtitle", { cur: curLabel, prev: prevLabel })}
          </span>
        </div>

        <p className="mt-3 text-lg font-semibold" style={{ color: toneColor }}>
          {headline}
        </p>

        {topMovers.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-mute">{t("insights.movers")}</p>
            <ul className="mt-2 grid gap-1.5">
              {topMovers.map((m) => (
                <MoverItem key={m.sub} mover={m} onClick={() => drill(m.sub)} t={t} />
              ))}
            </ul>
          </div>
        )}

        {biggestCategory && (
          <p className="mt-4 text-sm text-body">
            {t("insights.biggest", {
              sub: biggestCategory.sub,
              amount: formatSGD(biggestCategory.amount),
            })}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function MoverItem({
  mover,
  onClick,
  t,
}: {
  mover: MoverRow;
  onClick: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const up = mover.delta > 0;
  const deltaColor = up ? "var(--color-negative)" : "var(--color-positive)";
  const note =
    mover.previous === 0 ? t("insights.newSpend") : mover.current === 0 ? t("insights.stopped") : null;
  return (
    <li>
      <button
        onClick={onClick}
        data-testid="insights-mover"
        className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left text-sm hover:bg-canvas-soft"
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: PILLAR_COLORS[mover.pillar] }}
        />
        <span className="truncate font-medium">{mover.sub}</span>
        {note && (
          <span className="rounded-full bg-canvas-soft px-1.5 py-0.5 text-[10px] uppercase text-mute">
            {note}
          </span>
        )}
        <span
          className="tabular ml-auto flex items-center gap-0.5 font-semibold"
          style={{ color: deltaColor }}
        >
          {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
          {formatSGD(Math.abs(mover.delta))}
        </span>
      </button>
    </li>
  );
}
