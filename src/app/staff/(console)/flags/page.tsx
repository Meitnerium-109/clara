import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { flaggedSummaries } from "@/server/staffData";
import { requireStaff } from "@/server/staffSession";
import { staffTime } from "../ui";

export const metadata: Metadata = { title: "Flagged explanations · Clara staff" };

const SOURCE: Record<string, string> = { TEMPLATE: "Locked template", AI: "AI", FALLBACK: "Fallback text", NONE: "None" };
const LANGUAGE: Record<string, string> = { EN: "English", TE: "Telugu", HI: "Hindi" };

export default async function FlaggedPage() {
  await requireStaff();
  const flagged = await flaggedSummaries();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Flagged explanations</h1>
        <p className="mt-1 text-ink-muted">Patients pressed “This explanation seems wrong”. Check each one against the report.</p>
      </div>
      {flagged.length === 0 ? (
        <Card surface="solid">
          <EmptyState title="Nothing flagged" message="When a patient flags an explanation, it appears here." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {flagged.map((s) => (
            <li key={s.id} className="rounded-card border border-line bg-paper p-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[0.9375rem]">
                <span className="font-semibold">
                  {s.result.parameter} {s.result.valueText} {s.result.unit} ·{" "}
                  <Link href={`/staff/orders/${s.result.order.id}`} className="font-normal text-accent underline-offset-4 hover:underline">
                    {s.result.order.lisOrderId}
                  </Link>
                </span>
                <span className="text-sm text-ink-muted">
                  {LANGUAGE[s.language]} · {SOURCE[s.source]} · flagged {staffTime(s.flaggedAt)}
                </span>
              </div>
              <blockquote lang={s.language.toLowerCase()} className="border-l-4 border-line pl-3">
                {s.text}
              </blockquote>
              <p className="mt-2 text-[0.9375rem]">
                <span className="text-ink-muted">Patient&apos;s note:</span> {s.flagNote ?? <em className="text-ink-muted">none</em>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
