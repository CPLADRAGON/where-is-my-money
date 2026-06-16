"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/Card";
import { useStore } from "@/lib/store";
import { detectRecurring, monthlyCommitment } from "@/lib/recurring";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function RecurringSummaryCard() {
  const t = useT();
  const transactions = useStore((s) => s.transactions);
  const groups = useMemo(() => detectRecurring(transactions), [transactions]);
  if (groups.subscriptions.length === 0) return null;
  const monthly = monthlyCommitment(groups);

  return (
    <Link href="/recurring" className="block">
      <Card className="transition-colors hover:border-primary">
        <CardBody className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary-pale text-ink-deep">
              <Repeat className="size-5" />
            </span>
            <div>
              <CardTitle>{t("dash.recurringCard")}</CardTitle>
              <p className="text-sm text-body">
                {t("recurring.subsCount", { n: groups.subscriptions.length })}
              </p>
            </div>
          </div>
          <p className="tabular text-xl font-semibold">
            {t("recurring.monthlyCommitment", { amount: formatSGD(monthly) })}
          </p>
        </CardBody>
      </Card>
    </Link>
  );
}
