"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { TransactionFilters } from "@/components/TransactionFilters";
import { TransactionTable } from "@/components/TransactionTable";
import { useStore } from "@/lib/store";
import { applyFilter, parseFilter } from "@/lib/filters";
import { formatSGD } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <TransactionsView />
      </HydrationGate>
    </AppShell>
  );
}

function TransactionsView() {
  const t = useT();
  const sp = useSearchParams();
  const transactions = useStore((s) => s.transactions);
  const months = useStore((s) => s.months);

  const filter = useMemo(() => parseFilter(new URLSearchParams(sp.toString())), [sp]);
  const rows = useMemo(() => applyFilter(transactions, filter), [transactions, filter]);
  const total = rows.reduce((a, r) => a + r.amount, 0);

  if (transactions.length === 0) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">{t("review.emptyTitle")}</p>
          <p className="text-sm text-body">{t("review.emptyBody")}</p>
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
        <h1 className="font-display text-[2rem] leading-[1.15] tracking-tight">{t("nav.transactions")}</h1>
        <p className="mt-1 text-sm text-body">
          {t("tx.resultCount", { n: rows.length })} · {formatSGD(total)}
        </p>
      </div>

      <TransactionFilters filter={filter} months={months} />

      {rows.length === 0 ? (
        <Card>
          <CardBody className="grid place-items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-body">{t("tx.noMatch")}</p>
            <Link href="/transactions">
              <Button variant="secondary">{t("filter.clear")}</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <TransactionTable rows={rows} />
      )}
    </div>
  );
}
