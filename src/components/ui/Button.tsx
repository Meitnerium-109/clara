import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost";
// md: staff screens (44px tall). lg: patient screens (56px tall, full width).
type Size = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "border border-line bg-paper text-accent hover:bg-accent-soft",
  ghost: "text-accent hover:bg-accent-soft",
};

const SIZES: Record<Size, string> = {
  md: "min-h-11 px-4 text-[0.9375rem]",
  lg: "min-h-14 w-full px-6 text-xl",
};

type StyleProps = { variant?: Variant; size?: Size };

function buttonClasses({ variant = "primary", size = "md" }: StyleProps, className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ComponentProps<"button"> & StyleProps & { loading?: boolean };

export function Button({ variant, size, loading = false, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size }, className)}
    >
      {loading && <Spinner label={null} />}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** A link that looks like a button, for actions that are really navigation. */
export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <Link {...rest} className={buttonClasses({ variant, size }, className)} />;
}
