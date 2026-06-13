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
  TargetBars,
  SubBars,
  TrendLine,
} from "@/components/DashboardCharts";
import { useStore } from "@/lib/store";
import { PILLARS } from "@/lib/taxonomy";
import {
  filterTx,
  totalSpent,
  spentByPillar,
  spentBySub,
  incomeInRange,
  monthlyTrend,
  type DateRange,
} from "@/lib/selectors";
import { formatSGD, formatPct, formatMonthLabel } from "@/lib/utils";

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
  const transactions = useStore((s) => s.transactions);
  const months = useStore((s) => s.months);
  const detectedIncome = useStore((s) => s.detectedIncome);
  const incomeOverrides = useStore((s) => s.incomeOverrides);
  const targets = useStore((s) => s.targets);

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
  const trend = monthlyTrend(transactions, months, detectedIncome, incomeOverrides);

  if (transactions.length === 0) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">Nothing to show yet</p>
          <p className="text-sm text-body">Import a CSV to build your dashboard.</p>
          <Link href="/">
            <Button>Import a file</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  const pieData = PILLARS.map((p) => ({ pillar: p, amount: byPillar[p] }));
  const targetData = PILLARS.map((p) => ({
    pillar: p,
    actual: spent > 0 ? byPillar[p] / spent : 0,
    target: targets[p],
  }));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)}>
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
            <option value="custom">Custom range…</option>
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
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Income" value={income} accent="var(--color-positive)" />
        <SummaryCard label="Spent" value={spent} accent="var(--color-negative)" />
        <SummaryCard
          label="Remaining"
          value={income - spent}
          accent="var(--color-ink-deep)"
        />
      </div>

      {/* Pillar breakdown table */}
      <Card>
        <CardBody>
          <CardTitle>Pillar breakdown vs target</CardTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-mute">
                  <th className="py-2">Pillar</th>
                  <th className="py-2 text-right">Spent</th>
                  <th className="py-2 text-right">Actual %</th>
                  <th className="py-2 text-right">Target %</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {PILLARS.map((p) => {
                  const actual = spent > 0 ? byPillar[p] / spent : 0;
                  const target = targets[p];
                  const ok =
                    p === "Future Savings" ? actual >= target : actual <= target;
                  return (
                    <tr key={p} className="border-t border-hairline/60">
                      <td className="py-2 font-medium">{p}</td>
                      <td className="py-2 text-right tabular">{formatSGD(byPillar[p])}</td>
                      <td className="py-2 text-right tabular">{formatPct(actual)}</td>
                      <td className="py-2 text-right tabular text-mute">
                        {formatPct(target, 0)}
                      </td>
                      <td className="py-2 text-right">
                        <Badge tone={ok ? "positive" : "negative"}>
                          {ok
                            ? "On track"
                            : p === "Future Savings"
                            ? "Below target"
                            : "Over budget"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle>Spend by pillar</CardTitle>
            <div className="mt-2">
              <PillarPie data={pieData} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardTitle>Actual % vs target %</CardTitle>
            <div className="mt-2">
              <TargetBars data={targetData} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardTitle>Spend by sub-category</CardTitle>
            <div className="mt-2">
              <SubBars data={subRows} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardTitle>Monthly trend (all months)</CardTitle>
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
        <p
          className="tabular mt-2 text-3xl font-black"
          style={{ color: accent }}
        >
          {formatSGD(value)}
        </p>
      </CardBody>
    </Card>
  );
}
