import { cn } from "@/lib/cn";

export function Wordmark({ suffix, className }: { suffix?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span aria-hidden="true" className="h-[0.7em] w-[0.7em] rounded-full bg-accent" />
      Clara
      {suffix && <span className="font-normal text-ink-muted">· {suffix}</span>}
    </span>
  );
}
