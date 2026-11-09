import type { ResultFlag } from "@/lib/flags";
import { cn } from "@/lib/cn";
import { AlertIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, QuestionIcon } from "./icons";

// Colour is never the only signal: every flag has its own icon and word.
const STYLES: Record<ResultFlag, { label: string; Icon: typeof CheckIcon; className: string }> = {
  NORMAL: { label: "Normal", Icon: CheckIcon, className: "bg-neutral-bg text-ink border-line" },
  LOW: { label: "Low", Icon: ArrowDownIcon, className: "bg-warn-bg text-warn-ink border-warn-line" },
  HIGH: { label: "High", Icon: ArrowUpIcon, className: "bg-warn-bg text-warn-ink border-warn-line" },
  CRITICAL_LOW: { label: "Critical", Icon: AlertIcon, className: "bg-danger-bg text-danger-ink border-danger-line" },
  CRITICAL_HIGH: { label: "Critical", Icon: AlertIcon, className: "bg-danger-bg text-danger-ink border-danger-line" },
  // UNKNOWN must never look like Normal: it means "we could not compare this".
  UNKNOWN: { label: "Ask doctor", Icon: QuestionIcon, className: "bg-neutral-bg text-ink-muted border-line" },
};

type StatusPillProps = {
  flag: ResultFlag;
  /** Translated word for patient screens; defaults to English. */
  label?: string;
  className?: string;
};

export function StatusPill({ flag, label, className }: StatusPillProps) {
  const { label: englishLabel, Icon, className: colours } = STYLES[flag];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.9em] font-semibold",
        colours,
        className,
      )}
    >
      <Icon className="h-[1.1em] w-[1.1em]" />
      {label ?? englishLabel}
    </span>
  );
}
