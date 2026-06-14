"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Card, CardBody, CardTitle } from "@/components/Card";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { Badge } from "@/components/Badge";
import {
  PillarPie,
  BudgetBars,
  IncomeFlow,
  SubBars,
  TrendLine,
} from "@/components/DashboardCharts";
import { useStore } from "@/lib/store";
import { SPENDING_PILLARS } from "@/lib/taxonomy";
import {
  filterTx,
  totalSpent,
  spentByPillar,
  spentBySub,
  incomeInRange,
  budgetBreakdown,
  totalTransfers,
  totalInvested,
  monthlyTrend,
  type DateRange,
} from "@/lib/selectors";
import { formatSGD, formatPct, formatMonthLabel } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <DashboardView />
      </HydrationGate>
    </AppShell>
  );
}

function DashboardView() {
  const t = useT();
  const transactions = useStore((s) => s.transactions);
  const months = useStore((s) => s.months);
  const detectedIncome = useStore((s) => s.detectedIncome);
  const incomeOverrides = useStore((s) => s.incomeOverrides);

  const [rangeMode, setRangeMode] = useState<string>("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const range: DateRange = useMemo(() => {
    if (rangeMode === "all") return { mode: "all" };
    if (rangeMode === "custom") return { mode: "custom", start, end };
    return { mode: "month", month: rangeMode };
  }, [rangeMode, start, end]);

  const filtered = useMemo(() => filterTx(transactions, range), [transactions, range]);
  const spent = totalSpent(filtered);
  const byPillar = spentByPillar(filtered);
  const subRows = spentBySub(filtered);
  const income = incomeInRange(detectedIncome, incomeOverrides, months, range);
  const { rows: budgetRows, savings, savingsRate } = budgetBreakdown(filtered, income);
  const transfers = totalTransfers(filtered);
  const invested = totalInvested(filtered);
  const trend = monthlyTrend(transactions, months, detectedIncome, incomeOverrides);

  if (transactions.length === 0) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">{t("empty.nothing")}</p>
          <p className="text-sm text-body">{t("empty.importPrompt")}</p>
          <Link href="/">
            <Button>{t("btn.importFile")}</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  const pieData = SPENDING_PILLARS.map((p) => ({ pillar: p, amount: byPillar[p] }));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)}>
            <option value="all">{t("range.all")}</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
            <option value="custom">{t("range.custom")}</option>
          </Select>
          {rangeMode === "custom" && (
            <>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2 text-sm"
              />
              <span className="text-mute">→</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2 text-sm"
              />
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label={t("card.income")} value={income} accent="var(--color-positive)" />
        <SummaryCard label={t("card.spent")} value={spent} accent="var(--color-negative)" />
        <SummaryCard label={t("card.saved")} value={savings} accent="var(--color-ink-deep)" />
        <Card>
          <CardBody>
            <CardTitle>{t("card.savingsRate")}</CardTitle>
            <p
              className="tabular mt-2 text-3xl font-semibold"
              style={{ color: savingsRate >= 0.2 ? "var(--color-positive)" : "var(--color-warning-deep)" }}
            >
              {income > 0 ? formatPct(savingsRate, 0) : "—"}
            </p>
            <p className="mt-1 text-xs text-mute">{t("dash.savingsTargetNote")}</p>
          </CardBody>
        </Card>
      </div>

      {/* Where your income went (flow) */}
      <Card>
        <CardBody>
          <CardTitle>{t("dash.flowTitle")}</CardTitle>
          <div className="mt-2">
            <IncomeFlow
              income={income}
              needs={byPillar["Fixed Needs"]}
              wants={byPillar["Variable Wants"]}
              saved={savings}
            />
          </div>
          {transfers > 0 && (
            <p className="mt-1 text-xs text-mute">
              {invested > 0
                ? t("dash.flowExcludes", {
                    t: formatSGD(transfers),
                    i: formatSGD(invested),
                  })
                : t("dash.flowExcludesShort", { t: formatSGD(transfers) })}
            </p>
          )}
        </CardBody>
      </Card>

      {/* 50/30/20 budget table */}
      <Card>
        <CardBody>
          <CardTitle>{t("budget.title")}</CardTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-mute">
                  <th className="py-2">{t("th.bucket")}</th>
                  <th className="py-2 text-right">{t("th.amount")}</th>
                  <th className="py-2 text-right">{t("th.actual")}</th>
                  <th className="py-2 text-right">{t("th.target")}</th>
                  <th className="py-2 text-right">{t("th.status")}</th>
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((r) => (
                  <tr key={r.bucket} className="border-t border-hairline/60">
                    <td className="py-2 font-medium">{t(`bucket.${r.bucket}`)}</td>
                    <td className="py-2 text-right tabular">{formatSGD(r.amount)}</td>
                    <td className="py-2 text-right tabular">
                      {income > 0 ? formatPct(r.actual) : "—"}
                    </td>
                    <td className="py-2 text-right tabular text-mute">
                      {r.bucket === "Savings" ? "≥ " : "≤ "}
                      {formatPct(r.target, 0)}
                    </td>
                    <td className="py-2 text-right">
                      <Badge tone={r.onTrack ? "positive" : "negative"}>
                        {r.onTrack
                          ? t("status.onTrack")
                          : r.bucket === "Savings"
                          ? t("status.belowTarget")
                          : t("status.overBudget")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {income === 0 && (
            <p className="mt-2 text-xs text-warning-deep">{t("dash.noIncomeNote")}</p>
          )}
        </CardBody>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle>{t("chart.needsVsWants")}</CardTitle>
            <div className="mt-2">
              <PillarPie data={pieData} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardTitle>{t("chart.actualVsTarget")}</CardTitle>
            <div className="mt-2">
              <BudgetBars data={budgetRows} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardTitle>{t("chart.bySub")}</CardTitle>
            <div className="mt-2">
              <SubBars data={subRows} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardTitle>{t("chart.trend")}</CardTitle>
            <div className="mt-2">
              <TrendLine data={trend} />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardBody>
        <CardTitle>{label}</CardTitle>
        <p className="tabular mt-2 text-3xl font-semibold" style={{ color: accent }}>
          {formatSGD(value)}
        </p>
      </CardBody>
    </Card>
  );
}
