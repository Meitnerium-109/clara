import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
};

export function TextField({ label, error, className, ...rest }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "min-h-11 rounded-xl border bg-paper px-3.5 text-ink placeholder:text-ink-muted",
          error ? "border-danger-ink" : "border-line",
          className,
        )}
      />
      {error && (
        <p id={errorId} className="text-[0.9em] text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
