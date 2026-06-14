"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
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
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const importData = useStore((s) => s.importData);
  const setPending = useImportStore((s) => s.setPending);
  const [summary, setSummary] = useState<
    | { stats: ReturnType<typeof parseDetected>["stats"]; bank: string; months: number }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (summary) {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [summary]);

  function handleCsv(text: string, fileName: string) {
    setError(null);
    setSummary(null);
    setParsing(true);
    // Defer so the spinner can paint before the (sync) parse runs.
    setTimeout(() => {
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
        setError(t("error.read"));
      } finally {
        setParsing(false);
      }
    }, 50);
  }

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("import.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-body">{t("import.subtitle")}</p>
      </section>

      <Dropzone onFile={handleCsv} />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => handleCsv(DEMO_CSV, "demo.csv")}>
          <Sparkles className="size-4" /> {t("import.tryDemo")}
        </Button>
        <span className="inline-flex items-center gap-1.5 text-sm text-mute">
          <ShieldCheck className="size-4 text-positive" /> {t("import.private")}
        </span>
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-negative/40 bg-negative/10 px-4 py-3 text-sm font-medium text-negative-deep">
          {error}
        </div>
      )}

      {parsing && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-hairline bg-canvas px-4 py-3 text-sm font-medium text-body">
          <Loader2 className="size-4 animate-spin text-primary" />
          {t("import.parsing")}
        </div>
      )}

      {summary && (
        <Card ref={summaryRef} className="fade-in-up overflow-hidden">
          <div className="flex items-center gap-2 bg-positive/10 px-5 py-3 text-sm font-semibold text-positive-deep">
            <CheckCircle2 className="size-5" />{" "}
            {t("import.importedN", { n: summary.stats.total, bank: summary.bank })}
          </div>
          <CardBody className="grid gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t("stat.transactions")} value={String(summary.stats.total)} />
              <Stat label={t("stat.months")} value={String(summary.months)} />
              <Stat
                label={t("stat.autocat")}
                value={String(summary.stats.autoCategorized)}
              />
              <Stat label={t("stat.needReview")} value={String(summary.stats.defaulted)} tone="warn" />
            </div>
            <div className="text-sm text-body">
              {t("import.detectedIncome")}{" "}
              <strong className="tabular">{formatSGD(summary.stats.income)}</strong>
              {summary.stats.transfers > 0 && (
                <> · {t("import.transfersExcluded", { n: summary.stats.transfers })}</>
              )}
            </div>

            <Stepper needsReview={summary.stats.defaulted} />

            <div className="flex flex-wrap gap-3">
              <Button className="cta-pulse" onClick={() => router.push("/review")}>
                {summary.stats.defaulted > 0
                  ? t("import.reviewN", { n: summary.stats.defaulted })
                  : t("import.reviewAll")}
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="tertiary" onClick={() => router.push("/dashboard")}>
                {t("import.skipDashboard")}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <BankGuides />
    </div>
  );
}

function Stepper({ needsReview }: { needsReview: number }) {
  const t = useT();
  const steps = [
    { label: t("step.imported"), done: true },
    {
      label: needsReview > 0 ? `${t("step.review")} (${needsReview})` : t("step.review"),
      done: false,
      current: true,
    },
    { label: t("step.dashboard"), done: false },
  ];
  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <span
            className={
              s.done
                ? "inline-flex items-center gap-1.5 font-semibold text-positive-deep"
                : s.current
                ? "inline-flex items-center gap-1.5 font-semibold text-primary"
                : "inline-flex items-center gap-1.5 text-mute"
            }
          >
            <span
              className={
                "grid size-5 place-items-center rounded-full text-xs font-bold " +
                (s.done
                  ? "bg-positive text-white"
                  : s.current
                  ? "bg-primary text-on-primary"
                  : "bg-canvas-soft text-mute")
              }
            >
              {s.done ? "✓" : i + 1}
            </span>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-hairline">→</span>}
        </div>
      ))}
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
  const t = useT();
  const [open, setOpen] = useState<string | null>("OCBC");
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-bold">{t("import.guidesTitle")}</h2>
      <p className="text-sm text-body">{t("import.guidesIntro")}</p>
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
        {t("import.unknownFormat")}{" "}
        <Link href="/import/map" className="font-semibold text-ink-deep underline">
          {t("import.mapManually")}
        </Link>
        .
      </p>
    </section>
  );
}
