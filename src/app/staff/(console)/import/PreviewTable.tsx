import type { PreviewRow, RowOutcome } from "@/lib/import/preview";
import { cn } from "@/lib/cn";
import { StatusPill } from "@/components/ui/StatusPill";
import { AlertIcon } from "@/components/ui/icons";

const OUTCOME: Record<RowOutcome, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-accent-soft text-accent border-transparent" },
  UPDATED: { label: "Updated", className: "bg-paper text-accent border-accent" },
  UNCHANGED: { label: "Unchanged", className: "bg-paper text-ink-muted border-line" },
  REJECTED: { label: "Rejected", className: "bg-danger-bg text-danger-ink border-danger-line" },
};

export function OutcomeBadge({ outcome }: { outcome: RowOutcome }) {
  const { label, className } = OUTCOME[outcome];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold", className)}>
      {outcome === "REJECTED" && <AlertIcon className="h-4 w-4" />}
      {label}
    </span>
  );
}

export function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  return (
    // Tables scroll sideways on small screens instead of squashing columns.
    <div className="overflow-x-auto rounded-card border border-line bg-paper">
      <table className="w-full min-w-[56rem] border-collapse text-left text-[0.9375rem]">
        <caption className="sr-only">Rows in the uploaded file and what the import will do with each</caption>
        <thead className="border-b border-line bg-neutral-bg text-sm text-ink-muted">
          <tr>
            {["Row", "Order", "Patient", "Mobile", "Test", "Result", "Range", "Flag", "Import"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rejected = row.outcome === "REJECTED";
            return (
              <tr
                key={row.line}
                className={cn(
                  "border-b border-line align-top last:border-b-0",
                  rejected && "bg-danger-bg/60 shadow-[inset_4px_0_0_var(--color-danger-ink)]",
                )}
              >
                <td className="px-3 py-2.5 text-ink-muted tabular-nums">{row.line}</td>
                <td className="px-3 py-2.5 font-medium whitespace-nowrap">{row.orderId || "—"}</td>
                <td className="px-3 py-2.5">{row.patientName || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{row.mobileDisplay || "—"}</td>
                <td className="px-3 py-2.5">{row.parameter || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                  {row.valueText || "—"} {row.unit && <span className="text-ink-muted">{row.unit}</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-ink-muted">{row.refText || "—"}</td>
                <td className="px-3 py-2.5">{row.flag ? <StatusPill flag={row.flag} className="text-sm" /> : "—"}</td>
                <td className="max-w-xs px-3 py-2.5">
                  <OutcomeBadge outcome={row.outcome} />
                  {row.note && (
                    <p className={cn("mt-1 text-sm", rejected ? "font-medium text-danger-ink" : "text-ink-muted")}>
                      {row.note}
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
