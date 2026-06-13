"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { FileDown, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Card, CardBody, CardTitle } from "@/components/Card";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { useStore } from "@/lib/store";
import { PILLARS, type Pillar } from "@/lib/taxonomy";
import {
  filterTx,
  totalSpent,
  spentByPillar,
  spentBySub,
  incomeInRange,
  type DateRange,
  type SubRow,
} from "@/lib/selectors";
import { exportCsv, download } from "@/lib/exporters/csv";
import { exportXlsx } from "@/lib/exporters/xlsx";
import { formatSGD, formatPct, formatMonthLabel } from "@/lib/utils";

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <ExportView />
      </HydrationGate>
    </AppShell>
  );
}

const METRICS = [
  { id: "totals", label: "Income / Spent / Remaining" },
  { id: "pillars", label: "Pillar split" },
  { id: "top", label: "Top categories" },
  { id: "targets", label: "Targets vs actual" },
] as const;
type MetricId = (typeof METRICS)[number]["id"];

function ExportView() {
  const transactions = useStore((s) => s.transactions);
  const months = useStore((s) => s.months);
  const detectedIncome = useStore((s) => s.detectedIncome);
  const incomeOverrides = useStore((s) => s.incomeOverrides);
  const targets = useStore((s) => s.targets);

  const [rangeMode, setRangeMode] = useState("all");
  const [metrics, setMetrics] = useState<Set<MetricId>>(
    new Set(["totals", "pillars"])
  );
  const [theme, setTheme] = useState<"lime" | "ink">("lime");
  const cardRef = useRef<HTMLDivElement>(null);

  const range: DateRange = useMemo(
    () => (rangeMode === "all" ? { mode: "all" } : { mode: "month", month: rangeMode }),
    [rangeMode]
  );

  if (transactions.length === 0) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">Nothing to export yet</p>
          <Link href="/">
            <Button>Import a file</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  const filtered = filterTx(transactions, range);
  const spent = totalSpent(filtered);
  const income = incomeInRange(detectedIncome, incomeOverrides, months, range);
  const byPillar = spentByPillar(filtered);
  const subRows = spentBySub(filtered).slice(0, 5);
  const rangeLabel = rangeMode === "all" ? "All months" : formatMonthLabel(rangeMode);

  function toggleMetric(id: MetricId) {
    setMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadCard() {
    if (!cardRef.current) return;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
    });
    const blob = await (await fetch(dataUrl)).blob();
    download(`money-card-${rangeMode}.png`, blob);
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-black tracking-tight">Export</h1>

      {/* File exports */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <CardTitle>Data files</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => exportCsv(transactions)}>
              <FileDown className="size-4" /> CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                exportXlsx(
                  transactions,
                  { ...detectedIncome, ...incomeOverrides },
                  months,
                  targets
                )
              }
            >
              <FileSpreadsheet className="size-4" /> Excel (.xlsx)
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Share card builder */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardBody className="grid gap-4">
            <CardTitle>Share card</CardTitle>
            <div className="grid gap-1">
              <label className="text-sm font-semibold">Range</label>
              <Select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)}>
                <option value="all">All months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold">Include</label>
              {METRICS.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={metrics.has(m.id)}
                    onChange={() => toggleMetric(m.id)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-semibold">Theme</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={theme === "lime" ? "primary" : "secondary"}
                  onClick={() => setTheme("lime")}
                >
                  Lime
                </Button>
                <Button
                  size="sm"
                  variant={theme === "ink" ? "primary" : "secondary"}
                  onClick={() => setTheme("ink")}
                >
                  Ink
                </Button>
              </div>
            </div>
            <Button onClick={downloadCard}>
              <ImageIcon className="size-4" /> Download PNG
            </Button>
          </CardBody>
        </Card>

        {/* Preview */}
        <div className="grid place-items-start overflow-x-auto">
          <ShareCard
            ref={cardRef}
            theme={theme}
            rangeLabel={rangeLabel}
            income={income}
            spent={spent}
            byPillar={byPillar}
            subRows={subRows}
            targets={targets}
            metrics={metrics}
          />
        </div>
      </div>
    </div>
  );
}

const ShareCard = React.forwardRef<
  HTMLDivElement,
  {
    theme: "lime" | "ink";
    rangeLabel: string;
    income: number;
    spent: number;
    byPillar: Record<Pillar, number>;
    subRows: SubRow[];
    targets: Record<Pillar, number>;
    metrics: Set<MetricId>;
  }
>(function ShareCard(
  { theme, rangeLabel, income, spent, byPillar, subRows, targets, metrics },
  ref
) {
  const dark = theme === "ink";
  const bg = dark ? "#163300" : "#9fe870";
  const fg = dark ? "#ffffff" : "#0e0f0c";
  const sub = dark ? "#cdffad" : "#163300";
  const panel = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)";

  return (
    <div
      ref={ref}
      style={{
        width: 540,
        background: bg,
        color: fg,
        padding: 32,
        borderRadius: 24,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.8 }}>
          Money Tracker
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: sub }}>{rangeLabel}</span>
      </div>

      {metrics.has("totals") && (
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Metric label="Income" value={income} fg={fg} panel={panel} />
          <Metric label="Spent" value={spent} fg={fg} panel={panel} />
          <Metric label="Left" value={income - spent} fg={fg} panel={panel} />
        </div>
      )}

      {metrics.has("pillars") && (
        <div style={{ marginTop: 16, background: panel, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>
            WHERE IT WENT
          </div>
          {PILLARS.map((p) => {
            const pct = spent > 0 ? byPillar[p] / spent : 0;
            return (
              <div key={p} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                  <span>{p}</span>
                  <span>{formatSGD(byPillar[p], { decimals: false })} · {formatPct(pct, 0)}</span>
                </div>
                <div style={{ height: 8, background: "rgba(0,0,0,0.12)", borderRadius: 99, marginTop: 4 }}>
                  <div
                    style={{
                      width: `${Math.min(100, pct * 100)}%`,
                      height: 8,
                      background: fg,
                      borderRadius: 99,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {metrics.has("targets") && (
        <div style={{ marginTop: 16, background: panel, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>
            VS TARGET
          </div>
          {PILLARS.map((p) => {
            const actual = spent > 0 ? byPillar[p] / spent : 0;
            const ok = p === "Future Savings" ? actual >= targets[p] : actual <= targets[p];
            return (
              <div key={p} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span>{p}</span>
                <span>
                  {formatPct(actual, 0)} / {formatPct(targets[p], 0)} {ok ? "✓" : "✗"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {metrics.has("top") && subRows.length > 0 && (
        <div style={{ marginTop: 16, background: panel, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>
            TOP CATEGORIES
          </div>
          {subRows.map((s) => (
            <div key={s.sub} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              <span>{s.sub}</span>
              <span>{formatSGD(s.amount, { decimals: false })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

function Metric({
  label,
  value,
  fg,
  panel,
}: {
  label: string;
  value: number;
  fg: string;
  panel: string;
}) {
  return (
    <div style={{ background: panel, borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: fg, fontVariantNumeric: "tabular-nums" }}>
        {formatSGD(value, { decimals: false })}
      </div>
    </div>
  );
}
