import type { ReactNode } from "react";
import { InboxIcon } from "./icons";

type EmptyStateProps = {
  title: string;
  message?: string;
  /** Optional next step, e.g. a Button. */
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <InboxIcon className="h-6 w-6" />
      </span>
      <h2 className="text-[1.15em] font-semibold">{title}</h2>
      {message && <p className="max-w-sm text-ink-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
