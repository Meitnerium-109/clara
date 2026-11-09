import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { consoleCounts, searchOrders } from "@/server/staffData";
import { requireStaff } from "@/server/staffSession";
import { SearchPanel } from "./SearchPanel";

export const metadata: Metadata = { title: "Orders · Clara staff" };

export default async function StaffHomePage() {
  await requireStaff();
  const [counts, recent] = await Promise.all([consoleCounts(), searchOrders("")]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile href="/staff/callbacks" label="Callbacks waiting" value={counts.openCallbacks} urgent={counts.openCallbacks > 0} />
        <Tile href="/staff/flags" label="Flagged explanations" value={counts.flagged} />
        <Tile href="/staff/import" label="Import LIS results" value={null} />
      </div>
      <div>
        <h1 className="mb-3 text-2xl font-semibold">Orders</h1>
        <SearchPanel initial={recent} />
      </div>
    </div>
  );
}

function Tile({ href, label, value, urgent = false }: { href: string; label: string; value: number | null; urgent?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-1 rounded-card border p-4 hover:border-accent",
        urgent ? "border-danger-line bg-danger-bg text-danger-ink" : "border-line bg-paper",
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value ?? "→"}</span>
    </Link>
  );
}
