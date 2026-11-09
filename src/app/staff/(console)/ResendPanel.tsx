"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { resendLinkAction } from "./staffActions";

/** Two steps on purpose: staff see which number the link goes to before sending. */
export function ResendPanel({ orderId, masked }: { orderId: string; masked: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [sending, startSend] = useTransition();

  if (step === "done") return <p role="status" className="font-medium text-accent">{message}</p>;

  if (step === "idle" || step === "error") {
    return (
      <div className="flex flex-col gap-2">
        {step === "error" && <p role="alert" className="text-danger-ink">{message}</p>}
        <div>
          <Button variant="secondary" onClick={() => setStep("confirm")}>
            Resend link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4">
      <p>
        Send a new link to <strong className="tabular-nums">{masked}</strong>? The current link stops working.
      </p>
      <p className="text-sm text-ink-muted">If this number looks wrong, don&apos;t resend: correct it in the LIS and re-import.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          loading={sending}
          onClick={() =>
            startSend(async () => {
              try {
                const result = await resendLinkAction(orderId);
                setMessage(result.ok ? `New link sent to ${result.masked}. The old link no longer works.` : "Only signed reports can be resent.");
                setStep(result.ok ? "done" : "error");
              } catch {
                setMessage("Couldn't resend. Please try again.");
                setStep("error");
              }
            })
          }
        >
          Yes, send new link
        </Button>
        <Button variant="ghost" onClick={() => setStep("idle")} disabled={sending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
