"use client";

import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { RecurringItem } from "@/lib/recurring";

export function RecurringCard({ item }: { item: RecurringItem }) {
  const t = useT();
  const amount = item.stable
    ? formatSGD(item.avg)
    : `${formatSGD(item.min, { decimals: false })}–${formatSGD(item.max, { decimals: false })}`;

  return (
    <Link href={`/transactions?q=${encodeURIComponent(item.key)}`} className="block">
      <Card className="transition-colors hover:border-primary">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{item.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mute">
              <Badge tone="neutral">{item.sub}</Badge>
              <span>{t(`recurring.cadence.${item.cadence}`)}</span>
              <span>· {t("recurring.chargesOverMonths", { count: item.count, months: item.monthsActive })}</span>
              {item.nextExpected && <span>· {t("recurring.nextExpected", { date: item.nextExpected })}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="tabular text-lg font-semibold">{amount}</p>
            <p className="text-xs text-mute">{t("recurring.total", { amount: formatSGD(item.total) })}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
