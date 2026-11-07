import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type CardProps = ComponentProps<"div"> & {
  /** "glass" for the one main card on a screen; "solid" for anything repeated in a list. */
  surface?: "glass" | "solid";
};

export function Card({ surface = "glass", className, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-card p-6 sm:p-8",
        surface === "glass" ? "glass" : "border border-line bg-paper",
        className,
      )}
    />
  );
}
