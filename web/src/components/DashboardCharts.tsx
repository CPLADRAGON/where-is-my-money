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

const SUB_COLOR = "#0066cc";
const INCOME_COLOR = "#1d1d1f";
const SPENT_COLOR = "#ff3b30";
const SAVED_COLOR = "#34c759";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v: unknown) => formatSGD(num(v));
const moneyShort = (v: unknown) => formatSGD(num(v), { decimals: false });
const pct = (v: unknown) => formatPct(num(v));
const pct0 = (v: unknown) => formatPct(num(v), 0);

/** Spend-by-pillar doughnut (Needs vs Wants). */
export function PillarPie({
  data,
}: {
  data: { pillar: SpendingPillar; amount: number }[];
}) {
  const slices = data.filter((d) => d.amount > 0);
  if (slices.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="amount"
          nameKey="pillar"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          label={(p: { percent?: number }) => formatPct(p.percent ?? 0, 0)}
          labelLine={false}
        >
          {slices.map((d) => (
            <Cell key={d.pillar} fill={PILLAR_COLORS[d.pillar]} />
          ))}
        </Pie>
        <Tooltip formatter={money} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
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
      <BarChart data={rows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8e0" />
        <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v) => `${Math.round(num(v) * 100)}%`}
          domain={[0, 1]}
          tick={{ fontSize: 11 }}
        />
        <Tooltip formatter={pct} />
        <Legend />
        <Bar dataKey="actual" name="Actual % of income" radius={[6, 6, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.bucket} fill={BUCKET_COLORS[r.bucket as BudgetBucket]} />
          ))}
          <LabelList dataKey="actual" position="top" formatter={pct0} style={{ fontSize: 11 }} />
        </Bar>
        <Bar dataKey="target" name="Target %" fill="#d2d2d7" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal "where your income went" flow (stacked single bar). */
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
  const row = [
    {
      name: "Income",
      Needs: needs,
      Wants: wants,
      Saved: Math.max(0, saved),
      Overspent: saved < 0 ? -saved : 0,
    },
  ];
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={row} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <XAxis type="number" hide domain={[0, Math.max(income, needs + wants)]} />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip formatter={money} />
        <Legend />
        <Bar dataKey="Needs" stackId="a" fill={BUCKET_COLORS.Needs} radius={[6, 0, 0, 6]}>
          <LabelList dataKey="Needs" position="center" formatter={moneyShort} style={{ fontSize: 11, fill: "#fff" }} />
        </Bar>
        <Bar dataKey="Wants" stackId="a" fill={BUCKET_COLORS.Wants}>
          <LabelList dataKey="Wants" position="center" formatter={moneyShort} style={{ fontSize: 11 }} />
        </Bar>
        <Bar dataKey="Saved" stackId="a" fill={SAVED_COLOR}>
          <LabelList dataKey="Saved" position="center" formatter={moneyShort} style={{ fontSize: 11, fill: "#fff" }} />
        </Bar>
        <Bar dataKey="Overspent" stackId="a" fill={SPENT_COLOR} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SubBars({ data }: { data: SubRow[] }) {
  if (data.length === 0) return <Empty />;
  const height = Math.max(220, data.length * 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="sub" width={130} tick={{ fontSize: 11 }} />
        <Tooltip formatter={money} />
        <Bar dataKey="amount" fill={SUB_COLOR} radius={[0, 6, 6, 0]}>
          <LabelList dataKey="amount" position="right" formatter={moneyShort} style={{ fontSize: 11 }} />
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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8e0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={money} />
        <Legend />
        <Line type="monotone" dataKey="income" name="Income" stroke={INCOME_COLOR} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="spent" name="Spent" stroke={SPENT_COLOR} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="saved" name="Saved" stroke={SAVED_COLOR} strokeWidth={2} dot={{ r: 3 }} />
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
