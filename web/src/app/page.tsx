"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Sparkles, ShieldCheck, ChevronDown, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/Button";
import { Card, CardBody } from "@/components/Card";
import { useStore } from "@/lib/store";
import { useImportStore } from "@/lib/importStore";
import { parseDetected } from "@/lib/banks";
import { BANK_GUIDES, DEMO_CSV } from "@/lib/demo";
import { formatSGD } from "@/lib/utils";

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <ImportView />
      </HydrationGate>
    </AppShell>
  );
}

function ImportView() {
  const router = useRouter();
  const importData = useStore((s) => s.importData);
  const setPending = useImportStore((s) => s.setPending);
  const [summary, setSummary] = useState<
    | { stats: ReturnType<typeof parseDetected>["stats"]; bank: string; months: number }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  function handleCsv(text: string, fileName: string) {
    setError(null);
    try {
      const result = parseDetected(text);
      if (result.transactions.length === 0) {
        setPending(text, fileName);
        router.push("/import/map");
        return;
      }
      importData(result);
      setSummary({
        stats: result.stats,
        bank: result.bankLabel,
        months: result.months.length,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "UNKNOWN_BANK") {
        setPending(text, fileName);
        router.push("/import/map");
        return;
      }
      setError("Could not read that file. Please check it's a CSV export.");
    }
  }

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Turn your bank CSV into a clean money dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-body">
          Import a statement, categorize spending into Needs / Wants / Savings, and
          see where your money goes. Everything runs locally — your data never
          leaves this browser.
        </p>
      </section>

      <Dropzone onFile={handleCsv} />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => handleCsv(DEMO_CSV, "demo.csv")}>
          <Sparkles className="size-4" /> Try demo data
        </Button>
        <span className="inline-flex items-center gap-1.5 text-sm text-mute">
          <ShieldCheck className="size-4 text-positive" /> 100% private &amp; offline
        </span>
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-negative/40 bg-negative/10 px-4 py-3 text-sm font-medium text-negative-deep">
          {error}
        </div>
      )}

      {summary && (
        <Card>
          <CardBody className="grid gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-positive-deep">
              <FileSpreadsheet className="size-4" /> Imported from {summary.bank}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Transactions" value={String(summary.stats.total)} />
              <Stat label="Months" value={String(summary.months)} />
              <Stat
                label="Auto-categorized"
                value={String(summary.stats.autoCategorized)}
              />
              <Stat label="Need review" value={String(summary.stats.defaulted)} tone="warn" />
            </div>
            <div className="text-sm text-body">
              Detected income:{" "}
              <strong className="tabular">{formatSGD(summary.stats.income)}</strong>
              {summary.stats.transfers > 0 && (
                <>
                  {" · "}
                  {summary.stats.transfers} transfer
                  {summary.stats.transfers === 1 ? "" : "s"} excluded from spending
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => router.push("/review")}>
                Review{" "}
                {summary.stats.defaulted > 0
                  ? `${summary.stats.defaulted} uncategorized`
                  : "transactions"}
              </Button>
              <Button variant="tertiary" onClick={() => router.push("/dashboard")}>
                Go to dashboard
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <BankGuides />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-canvas-soft px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">
        {label}
      </p>
      <p
        className={`tabular mt-1 text-2xl font-bold ${
          tone === "warn" ? "text-warning-deep" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function BankGuides() {
  const [open, setOpen] = useState<string | null>("OCBC");
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-bold">Accepted formats &amp; how to get your CSV</h2>
      <p className="text-sm text-body">
        OCBC is auto-detected. Any other bank works too — you&apos;ll map the
        columns once and we&apos;ll remember it.
      </p>
      <div className="grid gap-2">
        {BANK_GUIDES.map((g) => {
          const isOpen = open === g.bank;
          return (
            <Card key={g.bank}>
              <button
                className="flex w-full items-center justify-between px-5 py-3 text-left"
                onClick={() => setOpen(isOpen ? null : g.bank)}
              >
                <span className="font-semibold">{g.bank}</span>
                <ChevronDown
                  className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <ol className="list-decimal space-y-1 px-9 pb-4 text-sm text-body">
                  {g.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-sm text-mute">
        Unknown format?{" "}
        <Link href="/import/map" className="font-semibold text-ink-deep underline">
          Map columns manually
        </Link>
        .
      </p>
    </section>
  );
}
