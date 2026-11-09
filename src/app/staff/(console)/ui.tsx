import { STAGE_LABELS, type DeliveryStage } from "@/lib/deliveryStatus";
import { cn } from "@/lib/cn";
import { AlertIcon, CheckIcon, ClockIcon } from "@/components/ui/icons";

// Staff-only display helpers. Status colours stay reserved for result flags;
// delivery uses the accent and neutral tones, with an icon and a word.
const STAGE_STYLE: Record<DeliveryStage, string> = {
  NOT_SIGNED: "border-line bg-neutral-bg text-ink-muted",
  NO_MESSAGE: "border-danger-line bg-danger-bg text-danger-ink",
  QUEUED: "border-line bg-paper text-ink",
  SENT: "border-line bg-paper text-ink",
  DELIVERED: "border-accent bg-paper text-accent",
  FAILED: "border-danger-line bg-danger-bg text-danger-ink",
  OPENED: "border-transparent bg-accent-soft text-accent",
};

export function DeliveryBadge({ stage }: { stage: DeliveryStage }) {
  const Icon = stage === "OPENED" || stage === "DELIVERED" ? CheckIcon : stage === "NO_MESSAGE" || stage === "FAILED" ? AlertIcon : ClockIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap", STAGE_STYLE[stage])}>
      <Icon className="h-4 w-4" />
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function CriticalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-danger-line bg-danger-bg px-2.5 py-0.5 text-sm font-semibold text-danger-ink">
      <AlertIcon className="h-4 w-4" />
      Critical
    </span>
  );
}

const TIME = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function staffTime(date: Date | null | undefined): string {
  return date ? TIME.format(date) : "—";
}
