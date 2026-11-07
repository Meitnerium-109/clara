/** Joins class names, skipping empty ones: cn("a", isOn && "b") */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
