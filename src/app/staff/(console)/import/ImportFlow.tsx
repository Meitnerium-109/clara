"use client";

import { useRef, useState, useTransition } from "react";
import type { CommitSummary } from "@/server/import";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { AlertIcon, CheckIcon, InboxIcon } from "@/components/ui/icons";
import { CSV_COLUMNS } from "@/lib/import/columns";
import { commitImportAction, previewImportAction, type PreviewData } from "./actions";
import { PreviewTable } from "./PreviewTable";

type Step =
  | { name: "choose"; error?: string }
  | { name: "checking"; file: File }
  | { name: "preview"; file: File; data: PreviewData; error?: string; stale?: boolean }
  | { name: "done"; file: File; summary: CommitSummary };

const NETWORK_ERROR = "We couldn't reach Clara. Check the internet connection and try again.";

export function ImportFlow() {
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [committing, startCommit] = useTransition();
  const [onlyProblems, setOnlyProblems] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function check(file: File) {
    setStep({ name: "checking", file });
    setOnlyProblems(false);
    const form = new FormData();
    form.set("file", file);
    previewImportAction(form)
      .then((result) => setStep(result.ok ? { name: "preview", file, data: result.data } : { name: "choose", error: result.error }))
      .catch(() => setStep({ name: "choose", error: NETWORK_ERROR }));
  }

  function confirm() {
    if (step.name !== "preview") return;
    const { file, data } = step;
    const form = new FormData();
    form.set("file", file);
    form.set("fingerprint", data.fingerprint);
    startCommit(async () => {
      try {
        const result = await commitImportAction(form);
        setStep(
          result.ok
            ? { name: "done", file, summary: result.summary }
            : { name: "preview", file, data, error: result.error, stale: result.stale },
        );
      } catch {
        setStep({ name: "preview", file, data, error: NETWORK_ERROR });
      }
    });
  }

  const chooseFile = () => inputRef.current?.click();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="CSV file from the LIS"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ""; // so choosing the same file again still triggers a check
          if (file) check(file);
        }}
      />

      {step.name === "choose" && (
        <Card className="max-w-2xl">
          {step.error ? (
            <ErrorState
              title="This file can't be imported"
              message={step.error}
              action={<Button onClick={chooseFile}>Choose another file</Button>}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <InboxIcon className="h-6 w-6" />
              </span>
              <h2 className="text-lg font-semibold">No file chosen yet</h2>
              <p className="max-w-md text-ink-muted">
                Export results from the LIS as CSV and choose the file. Nothing is saved until you check the preview
                and confirm.
              </p>
              <Button onClick={chooseFile} className="mt-2">
                Choose CSV file
              </Button>
            </div>
          )}
          <p className="mt-5 text-sm text-ink-muted">
            Expected columns: <code className="text-ink">{CSV_COLUMNS.join(", ")}</code>
          </p>
        </Card>
      )}

      {step.name === "checking" && (
        <Card className="max-w-2xl">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Spinner label={null} className="h-8 w-8 text-accent" />
            <p role="status" className="font-medium">
              Checking {step.file.name}…
            </p>
            <p className="text-sm text-ink-muted">Comparing every row with the reports already in Clara.</p>
          </div>
        </Card>
      )}

      {step.name === "preview" && (
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">Check before importing</h2>
              <p className="text-sm text-ink-muted">{step.file.name}</p>
            </div>

            <dl className="flex flex-wrap gap-2 text-[0.9375rem]">
              <Count label="New" value={step.data.counts.NEW} />
              <Count label="Updated" value={step.data.counts.UPDATED} />
              <Count label="Unchanged" value={step.data.counts.UNCHANGED} />
              <Count label="Rejected" value={step.data.counts.REJECTED} danger={step.data.counts.REJECTED > 0} />
            </dl>

            <p>
              {step.data.ordersToSave === 0 ? (
                "Nothing new to import: every valid row is already in Clara."
              ) : (
                <>
                  Confirming saves <strong>{plural(step.data.ordersToSave, "order")}</strong> and sends{" "}
                  <strong>{plural(step.data.linksToSend, "report link")}</strong> to patients.
                  {step.data.criticalOrders > 0 && (
                    <> {plural(step.data.criticalOrders, "critical order")} will also get a callback task.</>
                  )}
                </>
              )}
            </p>

            {step.data.counts.REJECTED > 0 && (
              <div role="note" className="flex gap-2 rounded-xl border border-danger-line bg-danger-bg p-3 text-danger-ink">
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  <strong>{plural(step.data.counts.REJECTED, "row")} can&apos;t be imported.</strong> They are marked
                  below with the reason. Fix them in the LIS and import again; the other rows are not affected.
                </p>
              </div>
            )}

            {step.error && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-danger-line bg-danger-bg p-3 text-danger-ink">
                <p className="flex-1">{step.error}</p>
                {step.stale && (
                  <Button variant="secondary" onClick={() => check(step.file)}>
                    Check again
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={confirm} loading={committing} disabled={step.data.ordersToSave === 0 || step.stale}>
                {committing ? "Importing…" : "Confirm import"}
              </Button>
              <Button variant="secondary" onClick={chooseFile} disabled={committing}>
                Choose another file
              </Button>
            </div>
          </Card>

          {step.data.counts.REJECTED > 0 && (
            <label className="flex items-center gap-2 text-[0.9375rem]">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--color-accent)]"
                checked={onlyProblems}
                onChange={(e) => setOnlyProblems(e.target.checked)}
              />
              Show only rejected rows
            </label>
          )}
          <PreviewTable rows={onlyProblems ? step.data.rows.filter((r) => r.outcome === "REJECTED") : step.data.rows} />
        </div>
      )}

      {step.name === "done" && (
        <Card className="max-w-2xl">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <CheckIcon className="h-6 w-6" />
            </span>
            <h2 className="text-xl font-semibold">Import complete</h2>
            <ul className="text-ink-muted">
              <li>{plural(step.summary.ordersSaved, "order")} saved</li>
              <li>{plural(step.summary.linksQueued, "report link")} queued to patients</li>
              <li>{plural(step.summary.callbacksCreated, "callback task")} created</li>
              {step.summary.rejectedRows > 0 && (
                <li className="text-danger-ink">{plural(step.summary.rejectedRows, "row")} rejected: fix in the LIS</li>
              )}
              {step.summary.skipped > 0 && (
                <li>{plural(step.summary.skipped, "order")} skipped: signed by another import meanwhile</li>
              )}
            </ul>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <Button onClick={chooseFile}>Import another file</Button>
              <ButtonLink href="/staff" variant="secondary">
                Back to staff home
              </ButtonLink>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

function Count({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div
      className={
        danger
          ? "flex items-baseline gap-1.5 rounded-full border border-danger-line bg-danger-bg px-3 py-1 text-danger-ink"
          : "flex items-baseline gap-1.5 rounded-full border border-line bg-paper px-3 py-1"
      }
    >
      <dt>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
