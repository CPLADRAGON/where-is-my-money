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
import { PILLAR_COLORS, type Pillar } from "@/lib/taxonomy";
import { formatSGD, formatPct, formatMonthLabel } from "@/lib/utils";
import type { SubRow, MonthlyPoint } from "@/lib/selectors";

const SUB_COLOR = "#2A9D8F";
const INCOME_COLOR = "#163300";
const SPENT_COLOR = "#E76F51";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v: unknown) => formatSGD(num(v));
const moneyShort = (v: unknown) => formatSGD(num(v), { decimals: false });
const pct = (v: unknown) => formatPct(num(v));
const pct0 = (v: unknown) => formatPct(num(v), 0);

export function PillarPie({
  data,
}: {
  data: { pillar: Pillar; amount: number }[];
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

export function TargetBars({
  data,
}: {
  data: { pillar: Pillar; actual: number; target: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8e0" />
        <XAxis dataKey="pillar" tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={(v) => `${Math.round(num(v) * 100)}%`}
          domain={[0, 1]}
          tick={{ fontSize: 11 }}
        />
        <Tooltip formatter={pct} />
        <Legend />
        <Bar dataKey="actual" name="Actual %" fill={SUB_COLOR} radius={[6, 6, 0, 0]}>
          <LabelList dataKey="actual" position="top" formatter={pct0} style={{ fontSize: 11 }} />
        </Bar>
        <Bar dataKey="target" name="Target %" fill="#E9C46A" radius={[6, 6, 0, 0]} />
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
        <Line
          type="monotone"
          dataKey="income"
          name="Income"
          stroke={INCOME_COLOR}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="spent"
          name="Spent"
          stroke={SPENT_COLOR}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="grid h-[200px] place-items-center text-sm text-mute">
      No data for this range.
    </div>
  );
}
