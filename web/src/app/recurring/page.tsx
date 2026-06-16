"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { RecurringCard } from "@/components/RecurringCard";
import { useStore } from "@/lib/store";
import { detectRecurring, monthlyCommitment } from "@/lib/recurring";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <RecurringView />
      </HydrationGate>
    </AppShell>
  );
}

function RecurringView() {
  const t = useT();
  const transactions = useStore((s) => s.transactions);
  const groups = useMemo(() => detectRecurring(transactions), [transactions]);
  const monthly = monthlyCommitment(groups);
  const isEmpty = groups.subscriptions.length === 0 && groups.frequent.length === 0;

  if (isEmpty) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">{t("recurring.title")}</p>
          <p className="text-sm text-body">{t("recurring.empty")}</p>
          <Link href="/">
            <Button>{t("btn.importFile")}</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-[2rem] leading-[1.15] tracking-tight">{t("recurring.title")}</h1>
        <p className="mt-1 text-sm text-body">
          {t("recurring.monthlyCommitment", { amount: formatSGD(monthly) })} ·{" "}
          {t("recurring.subsCount", { n: groups.subscriptions.length })}
        </p>
      </div>

      {groups.subscriptions.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mute">
            {t("recurring.sectionSubs")}
          </h2>
          {groups.subscriptions.map((it) => (
            <RecurringCard key={it.key} item={it} />
          ))}
        </section>
      )}

      {groups.frequent.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mute">
            {t("recurring.sectionFrequent")}
          </h2>
          {groups.frequent.map((it) => (
            <RecurringCard key={it.key} item={it} />
          ))}
        </section>
      )}
    </div>
  );
}
