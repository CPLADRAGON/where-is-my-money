"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Card, CardBody, CardTitle } from "@/components/Card";
import { Button } from "@/components/Button";
import { CategoryPicker } from "@/components/CategoryPicker";
import { useStore } from "@/lib/store";
import { BUDGET_BUCKETS, type Pillar } from "@/lib/taxonomy";
import { formatMonthLabel, formatPct } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <SettingsView />
      </HydrationGate>
    </AppShell>
  );
}

function SettingsView() {
  const t = useT();
  const learned = useStore((s) => s.learned);
  const setLearnedViaForget = useStore((s) => s.forgetMerchant);
  const presets = useStore((s) => s.presets);
  const removePreset = useStore((s) => s.removePreset);
  const months = useStore((s) => s.months);
  const detectedIncome = useStore((s) => s.detectedIncome);
  const incomeOverrides = useStore((s) => s.incomeOverrides);
  const setIncome = useStore((s) => s.setIncome);
  const targets = useStore((s) => s.targets);
  const setTarget = useStore((s) => s.setTarget);
  const clearAll = useStore((s) => s.clearAll);

  const learnedEntries = Object.entries(learned);

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      {/* Targets */}
      <Card>
        <CardBody>
          <CardTitle>{t("settings.targets")}</CardTitle>
          <p className="mt-1 text-sm text-body">{t("settings.targetsNote")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {BUDGET_BUCKETS.map((b) => (
              <div key={b} className="grid gap-1">
                <label className="text-sm font-medium">{t(`bucket.${b}`)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(targets[b] * 100)}
                    onChange={(e) =>
                      setTarget(b, Number(e.target.value) / 100)
                    }
                    className="h-10 w-24 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2 text-sm tabular"
                  />
                  <span className="text-sm text-mute">% ({formatPct(targets[b], 0)})</span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Income */}
      <Card>
        <CardBody>
          <CardTitle>{t("settings.income")}</CardTitle>
          <p className="mt-1 text-sm text-body">{t("settings.incomeNote")}</p>
          {months.length === 0 ? (
            <p className="mt-3 text-sm text-mute">{t("settings.noData")}</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {months.map((m) => (
                <div key={m} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-canvas-soft px-3 py-2">
                  <span className="text-sm font-medium">{formatMonthLabel(m)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-mute">S$</span>
                    <input
                      type="number"
                      value={incomeOverrides[m] ?? detectedIncome[m] ?? 0}
                      onChange={(e) => setIncome(m, Number(e.target.value))}
                      className="h-9 w-28 rounded-[var(--radius-sm)] border border-hairline bg-canvas px-2 text-sm tabular text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Learned merchants */}
      <Card>
        <CardBody>
          <CardTitle>{t("settings.remembered", { n: learnedEntries.length })}</CardTitle>
          <p className="mt-1 text-sm text-body">{t("settings.rememberedNote")}</p>
          {learnedEntries.length === 0 ? (
            <p className="mt-3 text-sm text-mute">{t("settings.noMerchants")}</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {learnedEntries.map(([key, cat]) => (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-hairline px-3 py-2"
                >
                  <span className="font-mono text-sm text-ink">{key}</span>
                  <div className="flex items-center gap-2">
                    <MerchantCategory merchantKey={key} pillar={cat.pillar} sub={cat.sub} />
                    <button
                      onClick={() => setLearnedViaForget(key)}
                      className="grid size-8 place-items-center rounded-full text-negative hover:bg-negative/10"
                      aria-label="Remove rule"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Saved presets */}
      <Card>
        <CardBody>
          <CardTitle>{t("settings.presets", { n: presets.length })}</CardTitle>
          {presets.length === 0 ? (
            <p className="mt-3 text-sm text-mute">{t("settings.noPresets")}</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {presets.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-hairline px-3 py-2"
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <button
                    onClick={() => removePreset(p.name)}
                    className="grid size-8 place-items-center rounded-full text-negative hover:bg-negative/10"
                    aria-label="Remove preset"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card className="border-negative/30">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-negative-deep">
            <AlertTriangle className="size-4" />
            {t("settings.dangerNote")}
          </div>
          <ClearButton onClear={clearAll} />
        </CardBody>
      </Card>
    </div>
  );
}

function MerchantCategory({
  merchantKey,
  pillar,
  sub,
}: {
  merchantKey: string;
  pillar: Pillar;
  sub: string;
}) {
  // Re-uses bulk learning: set a learned rule by applying to its merchantKey.
  const transactions = useStore((s) => s.transactions);
  const setCategory = useStore((s) => s.setCategory);
  const bulkSetCategory = useStore((s) => s.bulkSetCategory);

  function apply(p: Pillar, s: string) {
    const ids = transactions.filter((t) => t.merchantKey === merchantKey).map((t) => t.id);
    if (ids.length > 0) bulkSetCategory(ids, p, s, true);
    else {
      // No current transactions for this key; still update the learned rule by
      // applying to a synthetic noop is not possible, so re-learn via setCategory
      // is skipped. Keep UX simple: do nothing if no rows.
      void setCategory;
    }
  }

  return (
    <CategoryPicker compact pillar={pillar} sub={sub} onChange={apply} />
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <Button variant="tertiary" onClick={() => setConfirm(true)}>
        {t("settings.clearAll")}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{t("settings.confirm")}</span>
      <Button
        size="sm"
        onClick={onClear}
        className="bg-negative text-white hover:bg-negative-deep"
      >
        {t("settings.yesDelete")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        {t("settings.cancel")}
      </Button>
    </div>
  );
}
