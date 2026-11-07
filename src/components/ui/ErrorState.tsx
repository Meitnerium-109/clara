import type { ReactNode } from "react";
import { AlertIcon } from "./icons";

type ErrorStateProps = {
  title?: string;
  message?: string;
  /** Optional way out, e.g. a "Try again" Button. */
  action?: ReactNode;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again in a moment.",
  action,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-ink">
        <AlertIcon className="h-6 w-6" />
      </span>
      <h2 className="text-[1.15em] font-semibold">{title}</h2>
      <p className="max-w-sm text-ink-muted">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
