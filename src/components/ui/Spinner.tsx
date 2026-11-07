import { cn } from "@/lib/cn";

type SpinnerProps = {
  /** Read out by screen readers. Pass null when nearby text already says it (e.g. inside a button). */
  label?: string | null;
  className?: string;
};

export function Spinner({ label = "Loading", className }: SpinnerProps) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cn("h-5 w-5 animate-spin motion-reduce:animate-none", className)}
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
