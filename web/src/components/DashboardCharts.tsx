"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  PILLAR_COLORS,
  BUCKET_COLORS,
  type SpendingPillar,
  type BudgetBucket,
} from "@/lib/taxonomy";
import { formatSGD, formatPct, formatMonthLabel } from "@/lib/utils";
import type { SubRow, MonthlyPoint, BudgetRow } from "@/lib/selectors";

const SUB_COLOR = "#5b54e0";
const INCOME_COLOR = "#7c75ee"; // lavender-indigo — visible on both light and dark
const SPENT_COLOR = "#e0483d"; // editorial red
const SAVED_COLOR = "#1f9d57"; // emerald
const TARGET_COLOR = "#c9c3b6"; // warm neutral reference bar

// Theme-aware chart chrome (CSS vars resolve in inline styles → adapt to dark).
const AXIS = "#8a8a93";
const GRID = "rgba(138,138,150,0.16)";
const tip = {
  contentStyle: {
    background: "var(--color-canvas)",
    border: "1px solid var(--color-hairline)",
    borderRadius: 12,
    boxShadow: "var(--shadow-card)",
    fontSize: 12,
    padding: "8px 10px",
  },
  itemStyle: { color: "var(--color-body)", padding: "1px 0" },
  labelStyle: { color: "var(--color-mute)", fontWeight: 600, marginBottom: 2 },
} as const;
const legendProps = {
  iconType: "circle" as const,
  iconSize: 8,
  wrapperStyle: { fontSize: 12, color: "var(--color-mute)", paddingTop: 4 },
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v: unknown) => formatSGD(num(v));
const moneyShort = (v: unknown) => formatSGD(num(v), { decimals: false });
const pct = (v: unknown) => formatPct(num(v));
const pct0 = (v: unknown) => formatPct(num(v), 0);

/** Spend-by-pillar doughnut (Needs vs Wants) with a centered total. */
export function PillarPie({
  data,
  onSliceClick,
}: {
  data: { pillar: SpendingPillar; amount: number }[];
  onSliceClick?: (pillar: SpendingPillar) => void;
}) {
  const slices = data.filter((d) => d.amount > 0);
  if (slices.length === 0) return <Empty />;
  const total = slices.reduce((a, d) => a + d.amount, 0);

  const renderLabel = (p: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
  }) => {
    const percent = num(p.percent);
    if (percent < 0.08) return null;
    const RAD = Math.PI / 180;
    const inner = num(p.innerRadius);
    const outer = num(p.outerRadius);
    const r = inner + (outer - inner) * 0.5;
    const x = num(p.cx) + r * Math.cos(-num(p.midAngle) * RAD);
    const y = num(p.cy) + r * Math.sin(-num(p.midAngle) * RAD);
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={700}
      >
        {Math.round(percent * 100)}%
      </text>
    );
  };

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="amount"
            nameKey="pillar"
            innerRadius={66}
            outerRadius={96}
            paddingAngle={3}
            cornerRadius={5}
            stroke="none"
            label={renderLabel}
            labelLine={false}
            onClick={(_, index) => onSliceClick?.(slices[index].pillar)}
            cursor={onSliceClick ? "pointer" : undefined}
          >
            {slices.map((d) => (
              <Cell key={d.pillar} fill={PILLAR_COLORS[d.pillar]} />
            ))}
          </Pie>
          <Tooltip formatter={money} {...tip} />
          <Legend {...legendProps} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[104px] grid place-items-center">
        <span className="text-[0.65rem] uppercase tracking-[0.12em] text-mute">Spent</span>
        <span className="tabular font-display text-xl text-ink">{moneyShort(total)}</span>
      </div>
    </div>
  );
}

/** 50/30/20 actual-vs-target bars, as a share of income. */
export function BudgetBars({ data }: { data: BudgetRow[] }) {
  const rows = data.map((r) => ({
    bucket: r.bucket,
    actual: Math.max(0, r.actual),
    target: r.target,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barGap={6}>
        <CartesianGrid strokeDasharray="2 6" vertical={false} stroke={GRID} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: AXIS }} dy={4} />
        <YAxis
          tickFormatter={(v) => `${Math.round(num(v) * 100)}%`}
          domain={[0, 1]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: AXIS }}
          width={36}
        />
        <Tooltip formatter={pct} cursor={{ fill: "rgba(138,138,150,0.08)" }} {...tip} />
        <Legend {...legendProps} />
        <Bar dataKey="actual" name="Actual % of income" radius={[6, 6, 0, 0]} maxBarSize={46}>
          {rows.map((r) => (
            <Cell key={r.bucket} fill={BUCKET_COLORS[r.bucket as BudgetBucket]} />
          ))}
          <LabelList dataKey="actual" position="top" formatter={pct0} style={{ fontSize: 11, fontWeight: 600, fill: "var(--color-body)" }} />
        </Bar>
        <Bar dataKey="target" name="Target %" fill={TARGET_COLOR} radius={[6, 6, 0, 0]} maxBarSize={46} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * "Where your income went" — a clean custom segmented bar + legend.
 * Built without Recharts so segment labels never overlap: a label is only
 * printed inside a segment wide enough to hold it; the legend below always
 * shows every segment's amount and share of income.
 */
export function IncomeFlow({
  income,
  needs,
  wants,
  saved,
}: {
  income: number;
  needs: number;
  wants: number;
  saved: number;
}) {
  if (income <= 0) return <Empty label="Add income to see the flow." />;

  const savedPos = Math.max(0, saved);
  const overspent = saved < 0 ? -saved : 0;
  const segments = [
    { key: "Needs", value: needs, color: BUCKET_COLORS.Needs },
    { key: "Wants", value: wants, color: BUCKET_COLORS.Wants },
    overspent > 0
      ? { key: "Overspent", value: overspent, color: SPENT_COLOR }
      : { key: "Saved", value: savedPos, color: SAVED_COLOR },
  ].filter((s) => s.value > 0);

  const denom = Math.max(income, needs + wants + overspent);

  return (
    <div className="grid gap-3">
      <div className="flex h-11 w-full overflow-hidden rounded-[var(--radius-md)]" role="img" aria-label="Income allocation">
        {segments.map((s) => {
          const w = (s.value / denom) * 100;
          return (
            <div
              key={s.key}
              className="flex items-center justify-center"
              style={{ width: `${w}%`, background: s.color }}
              title={`${s.key}: ${formatSGD(s.value)}`}
            >
              {w >= 12 && (
                <span className="tabular truncate px-1 text-xs font-semibold text-white">
                  {moneyShort(s.value)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-body">{s.key}</span>
            <span className="tabular font-semibold text-ink">{moneyShort(s.value)}</span>
            <span className="tabular text-xs text-mute">{formatPct(s.value / income, 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubBars({
  data,
  onBarClick,
}: {
  data: SubRow[];
  onBarClick?: (sub: string) => void;
}) {
  if (data.length === 0) return <Empty />;
  const height = Math.max(220, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
        barCategoryGap={10}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="sub"
          width={140}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: AXIS }}
        />
        <Tooltip formatter={money} cursor={{ fill: "rgba(138,138,150,0.08)" }} {...tip} />
        <Bar
          dataKey="amount"
          fill={SUB_COLOR}
          radius={[0, 6, 6, 0]}
          maxBarSize={22}
          onClick={(d: { payload?: SubRow }) => d.payload && onBarClick?.(d.payload.sub)}
          cursor={onBarClick ? "pointer" : undefined}
        >
          {data.map((r) => (
            <Cell key={r.sub} fill={PILLAR_COLORS[r.pillar]} />
          ))}
          <LabelList dataKey="amount" position="right" formatter={moneyShort} style={{ fontSize: 11, fontWeight: 600, fill: "var(--color-body)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) return <Empty />;
  const rows = data.map((d) => ({ ...d, label: formatMonthLabel(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 6" vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: AXIS }} dy={4} />
        <YAxis tickFormatter={moneyShort} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: AXIS }} width={56} />
        <Tooltip formatter={money} {...tip} />
        <Legend {...legendProps} />
        <Line type="monotone" dataKey="income" name="Income" stroke={INCOME_COLOR} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: INCOME_COLOR }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="spent" name="Spent" stroke={SPENT_COLOR} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: SPENT_COLOR }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="saved" name="Saved" stroke={SAVED_COLOR} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: SAVED_COLOR }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty({ label }: { label?: string }) {
  return (
    <div className="grid h-[200px] place-items-center text-sm text-mute">
      {label ?? "No data for this range."}
    </div>
  );
}
