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
import {
  filterTx,
  totalSpent,
  spentBySub,
  incomeInRange,
  budgetBreakdown,
  type DateRange,
  type SubRow,
  type BudgetRow,
} from "@/lib/selectors";
import { exportCsv, download } from "@/lib/exporters/csv";
import { exportXlsx } from "@/lib/exporters/xlsx";
import { formatSGD, formatPct, formatMonthLabel } from "@/lib/utils";
import { useT } from "@/lib/i18n";

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
  { id: "totals", key: "metric.totals" },
  { id: "pillars", key: "metric.pillars" },
  { id: "top", key: "metric.top" },
  { id: "targets", key: "metric.targets" },
] as const;
type MetricId = (typeof METRICS)[number]["id"];

function ExportView() {
  const t = useT();
  const transactions = useStore((s) => s.transactions);
  const months = useStore((s) => s.months);
  const detectedIncome = useStore((s) => s.detectedIncome);
  const incomeOverrides = useStore((s) => s.incomeOverrides);
  const targets = useStore((s) => s.targets);

  const [rangeMode, setRangeMode] = useState("all");
  const [metrics, setMetrics] = useState<Set<MetricId>>(
    new Set(["totals", "pillars"])
  );
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const cardRef = useRef<HTMLDivElement>(null);

  const range: DateRange = useMemo(
    () => (rangeMode === "all" ? { mode: "all" } : { mode: "month", month: rangeMode }),
    [rangeMode]
  );

  if (transactions.length === 0) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">{t("export.emptyTitle")}</p>
          <Link href="/">
            <Button>{t("btn.importFile")}</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  const filtered = filterTx(transactions, range);
  const spent = totalSpent(filtered);
  const income = incomeInRange(detectedIncome, incomeOverrides, months, range);
  const { rows: budgetRows, savingsRate } = budgetBreakdown(filtered, income);
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
      <h1 className="font-display text-[2rem] leading-[1.15] tracking-tight">{t("export.title")}</h1>

      {/* File exports */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <CardTitle>{t("export.dataFiles")}</CardTitle>
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
            <CardTitle>{t("export.shareCard")}</CardTitle>
            <div className="grid gap-1">
              <label className="text-sm font-semibold">{t("export.range")}</label>
              <Select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)}>
                <option value="all">{t("range.all")}</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold">{t("export.include")}</label>
              {METRICS.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={metrics.has(m.id)}
                    onChange={() => toggleMetric(m.id)}
                  />
                  {t(m.key)}
                </label>
              ))}
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-semibold">{t("export.theme")}</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={theme === "light" ? "primary" : "secondary"}
                  onClick={() => setTheme("light")}
                >
                  {t("export.light")}
                </Button>
                <Button
                  size="sm"
                  variant={theme === "dark" ? "primary" : "secondary"}
                  onClick={() => setTheme("dark")}
                >
                  {t("export.dark")}
                </Button>
              </div>
            </div>
            <Button onClick={downloadCard}>
              <ImageIcon className="size-4" /> {t("export.downloadPng")}
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
            savingsRate={savingsRate}
            budgetRows={budgetRows}
            subRows={subRows}
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
    theme: "light" | "dark";
    rangeLabel: string;
    income: number;
    spent: number;
    savingsRate: number;
    budgetRows: BudgetRow[];
    subRows: SubRow[];
    metrics: Set<MetricId>;
  }
>(function ShareCard(
  { theme, rangeLabel, income, spent, savingsRate, budgetRows, subRows, metrics },
  ref
) {
  const dark = theme === "dark";
  const bg = dark ? "#1d1d1f" : "#ffffff";
  const fg = dark ? "#f5f5f7" : "#1d1d1f";
  const sub = dark ? "#2997ff" : "#0066cc";
  const panel = dark ? "rgba(255,255,255,0.06)" : "#f5f5f7";

  return (
    <div
      ref={ref}
      style={{
        width: 540,
        background: bg,
        color: fg,
        padding: 32,
        borderRadius: 24,
        fontFamily: "var(--font-hanken), system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 20, fontWeight: 400, opacity: 0.9, fontFamily: "var(--font-instrument), Georgia, serif" }}>
          Money Tracker
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: sub }}>{rangeLabel}</span>
      </div>

      {metrics.has("totals") && (
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Metric label="Income" value={income} fg={fg} panel={panel} />
          <Metric label="Spent" value={spent} fg={fg} panel={panel} />
          <Metric
            label="Saved"
            value={income - spent}
            fg={fg}
            panel={panel}
            note={income > 0 ? formatPct(savingsRate, 0) : undefined}
          />
        </div>
      )}

      {metrics.has("pillars") && (
        <div style={{ marginTop: 16, background: panel, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>
            WHERE YOUR INCOME WENT
          </div>
          {budgetRows.map((r) => {
            const pct = Math.max(0, r.actual);
            return (
              <div key={r.bucket} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                  <span>{r.bucket}</span>
                  <span>
                    {formatSGD(r.amount, { decimals: false })} ·{" "}
                    {income > 0 ? formatPct(pct, 0) : "—"}
                  </span>
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
            VS 50 / 30 / 20 TARGET
          </div>
          {budgetRows.map((r) => (
            <div key={r.bucket} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              <span>{r.bucket}</span>
              <span>
                {income > 0 ? formatPct(Math.max(0, r.actual), 0) : "—"} /{" "}
                {formatPct(r.target, 0)} {r.onTrack ? "✓" : "✗"}
              </span>
            </div>
          ))}
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
  note,
}: {
  label: string;
  value: number;
  fg: string;
  panel: string;
  note?: string;
}) {
  return (
    <div style={{ background: panel, borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: fg, fontVariantNumeric: "tabular-nums" }}>
        {formatSGD(value, { decimals: false })}
      </div>
      {note && <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{note} saved</div>}
    </div>
  );
}
