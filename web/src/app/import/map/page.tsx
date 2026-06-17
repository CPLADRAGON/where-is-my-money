"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HydrationGate } from "@/components/HydrationGate";
import { Card, CardBody, CardTitle } from "@/components/Card";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { useImportStore } from "@/lib/importStore";
import { useStore } from "@/lib/store";
import { previewCsv } from "@/lib/banks/generic";
import { parseMapped } from "@/lib/banks";
import type { ColumnMapping, DateFormat } from "@/lib/banks/types";
import { splitLines } from "@/lib/banks/helpers";
import { formatSGD } from "@/lib/utils";

const DATE_FORMATS: DateFormat[] = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
];

export default function Page() {
  return (
    <AppShell>
      <HydrationGate>
        <MapView />
      </HydrationGate>
    </AppShell>
  );
}

function MapView() {
  const router = useRouter();
  const pendingCsv = useImportStore((s) => s.pendingCsv);
  const fileName = useImportStore((s) => s.pendingFileName);
  const clearPending = useImportStore((s) => s.clearPending);
  const importData = useStore((s) => s.importData);
  const mergeData = useStore((s) => s.mergeData);
  const hasData = useStore((s) => s.transactions.length > 0);
  const addPreset = useStore((s) => s.addPreset);

  const [headerRow, setHeaderRow] = useState(0);
  const [dateField, setDateField] = useState("");
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [descFields, setDescFields] = useState<string[]>([]);
  const [amountMode, setAmountMode] = useState<"single" | "split">("single");
  const [amountField, setAmountField] = useState("");
  const [sign, setSign] = useState<"negative-is-spend" | "positive-is-spend">(
    "negative-is-spend"
  );
  const [debitField, setDebitField] = useState("");
  const [creditField, setCreditField] = useState("");
  const [categoryField, setCategoryField] = useState("");
  const [presetName, setPresetName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!pendingCsv) return { fields: [] as string[], rows: [] as Record<string, string>[] };
    try {
      return previewCsv(pendingCsv, headerRow, 5);
    } catch {
      return { fields: [], rows: [] };
    }
  }, [pendingCsv, headerRow]);

  // Auto-guess sensible defaults from the parsed header (no effect/setState).
  const guessed = useMemo(() => {
    const f = preview.fields;
    const find = (re: RegExp) => f.find((x) => re.test(x)) ?? "";
    return {
      date: find(/date/i) || f[0] || "",
      desc: find(/desc|narrat|details|reference|particular/i) || f[1] || f[0] || "",
      amount: find(/amount|value/i),
      debit: find(/debit|withdraw/i),
      credit: find(/credit|deposit/i),
    };
  }, [preview.fields]);

  // Effective values: explicit user choice wins, else the auto-guess.
  const effDate = dateField || guessed.date;
  const effDesc = descFields[0] || guessed.desc;
  const effAmount = amountField || guessed.amount;
  const effDebit = debitField || guessed.debit;
  const effCredit = creditField || guessed.credit;

  const mapping: ColumnMapping = {
    headerRowIndex: headerRow,
    dateField: effDate,
    dateFormat,
    descriptionFields: [effDesc].filter(Boolean),
    amountMode,
    amountField: amountMode === "single" ? effAmount : undefined,
    signConvention: amountMode === "single" ? sign : undefined,
    debitField: amountMode === "split" ? effDebit : undefined,
    creditField: amountMode === "split" ? effCredit : undefined,
    categoryField: categoryField || undefined,
  };

  const mappingKey = JSON.stringify(mapping);
  const previewRows = useMemo(() => {
    if (!pendingCsv) return [];
    try {
      const res = parseMapped(pendingCsv, mapping, presetName || "Custom");
      return res.transactions.slice(0, 5);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCsv, mappingKey, presetName]);

  if (!pendingCsv) {
    return (
      <Card>
        <CardBody className="grid place-items-center gap-3 py-16 text-center">
          <p className="text-lg font-bold">No file to map</p>
          <p className="text-sm text-body">
            Upload a CSV first, then map its columns here if it isn&apos;t auto-detected.
          </p>
          <Link href="/">
            <Button>Go to import</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  const totalLines = splitLines(pendingCsv).length;

  function doImport(savePreset: boolean) {
    setError(null);
    if (!effDate || !effDesc) {
      setError("Please choose at least a date and a description column.");
      return;
    }
    if (amountMode === "single" && !effAmount) {
      setError("Please choose the amount column.");
      return;
    }
    if (amountMode === "split" && !effDebit && !effCredit) {
      setError("Please choose a debit and/or credit column.");
      return;
    }
    try {
      const label = presetName ? presetName : fileName || "Custom mapping";
      const res = parseMapped(pendingCsv!, mapping, label);
      if (res.transactions.length === 0) {
        setError("That mapping produced no spend rows — check the columns and date format.");
        return;
      }
      if (savePreset && presetName) {
        addPreset({ ...mapping, name: presetName });
      }
      if (hasData) mergeData(res);
      else importData(res);
      clearPending();
      router.push("/review");
    } catch {
      setError("Could not parse with this mapping. Adjust the fields and try again.");
    }
  }

  const fieldOptions = (
    <>
      <option value="">—</option>
      {preview.fields.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </>
  );

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Map your CSV columns</h1>
        <p className="mt-1 text-sm text-body">
          We didn&apos;t recognize <strong>{fileName}</strong> automatically. Tell us
          which columns to use — you can save it as a reusable preset.
        </p>
      </div>

      <Card>
        <CardBody className="grid gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-semibold">Header row</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={Math.max(0, totalLines - 1)}
                value={headerRow}
                onChange={(e) => setHeaderRow(Math.max(0, Number(e.target.value)))}
                className="h-10 w-24 rounded-[var(--radius-md)] border border-hairline bg-canvas px-2 text-sm"
              />
              <span className="text-xs text-mute">
                Row index where column names start (0 = first line). Adjust if your
                file has preamble rows.
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date column">
              <Select value={effDate} onChange={(e) => setDateField(e.target.value)}>
                {fieldOptions}
              </Select>
            </Field>
            <Field label="Date format">
              <Select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormat)}
              >
                {DATE_FORMATS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </Select>
            </Field>
            <Field label="Description column">
              <Select
                value={effDesc}
                onChange={(e) => setDescFields([e.target.value])}
              >
                {fieldOptions}
              </Select>
            </Field>
            <Field label="Existing category (optional)">
              <Select
                value={categoryField}
                onChange={(e) => setCategoryField(e.target.value)}
              >
                {fieldOptions}
              </Select>
            </Field>
          </div>

          <Field label="Amount style">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={amountMode === "single" ? "primary" : "secondary"}
                onClick={() => setAmountMode("single")}
              >
                Single signed column
              </Button>
              <Button
                size="sm"
                variant={amountMode === "split" ? "primary" : "secondary"}
                onClick={() => setAmountMode("split")}
              >
                Separate debit / credit
              </Button>
            </div>
          </Field>

          {amountMode === "single" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount column">
                <Select
                  value={effAmount}
                  onChange={(e) => setAmountField(e.target.value)}
                >
                  {fieldOptions}
                </Select>
              </Field>
              <Field label="Sign convention">
                <Select
                  value={sign}
                  onChange={(e) =>
                    setSign(e.target.value as typeof sign)
                  }
                >
                  <option value="negative-is-spend">Negative = spending</option>
                  <option value="positive-is-spend">Positive = spending</option>
                </Select>
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Debit (spend) column">
                <Select
                  value={effDebit}
                  onChange={(e) => setDebitField(e.target.value)}
                >
                  {fieldOptions}
                </Select>
              </Field>
              <Field label="Credit (income) column">
                <Select
                  value={effCredit}
                  onChange={(e) => setCreditField(e.target.value)}
                >
                  {fieldOptions}
                </Select>
              </Field>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Live preview */}
      <Card>
        <CardBody>
          <CardTitle>Preview (first 5 rows)</CardTitle>
          {previewRows.length === 0 ? (
            <p className="mt-3 text-sm text-mute">
              No rows parsed yet — check your selections above.
            </p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-mute">
                  <th className="py-1">Date</th>
                  <th className="py-1">Description</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((t) => (
                  <tr key={t.id} className="border-t border-hairline/60">
                    <td className="py-1 tabular">{t.date}</td>
                    <td className="py-1">{t.description.slice(0, 60)}</td>
                    <td className="py-1 text-right tabular">{formatSGD(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-negative/40 bg-negative/10 px-4 py-3 text-sm font-medium text-negative-deep">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <input
            placeholder="Preset name (e.g. DBS savings)"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="h-10 flex-1 min-w-[200px] rounded-[var(--radius-md)] border border-hairline bg-canvas px-3 text-sm"
          />
          <Button variant="tertiary" onClick={() => doImport(true)} disabled={!presetName}>
            Save preset &amp; import
          </Button>
          <Button onClick={() => doImport(false)}>Import without saving</Button>
        </CardBody>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <label className="text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}
