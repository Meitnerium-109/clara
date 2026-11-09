"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { markCalledAction, revealNumberAction } from "./staffActions";

/** Show the full number (logged) and mark the call done with an optional note. */
export function CallbackActions({ taskId, masked }: { taskId: string; masked: string }) {
  const [mobile, setMobile] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealing, startReveal] = useTransition();
  const [saving, startSave] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {mobile ? (
          <a href={`tel:${mobile}`} className="text-lg font-semibold text-accent tabular-nums underline underline-offset-4">
            {mobile}
          </a>
        ) : (
          <>
            <span className="tabular-nums">{masked}</span>
            <Button
              variant="secondary"
              loading={revealing}
              onClick={() =>
                startReveal(async () => {
                  const result = await revealNumberAction(taskId).catch(() => ({ mobile: null }));
                  if (result.mobile) setMobile(result.mobile);
                  else setError("Couldn't load the number.");
                })
              }
            >
              Show number to call
            </Button>
          </>
        )}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startSave(async () => {
            const result = await markCalledAction(taskId, note).catch(() => ({ ok: false }));
            if (!result.ok) setError("Couldn't save. It may already be marked as called; refresh the page.");
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Note (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Spoke to patient, advised to see Dr. Suresh today"
            className="rounded-xl border border-line bg-paper p-2.5 text-[0.9375rem] font-normal"
          />
        </label>
        {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
        <div>
          <Button type="submit" loading={saving}>
            Mark as called
          </Button>
        </div>
      </form>
    </div>
  );
}
