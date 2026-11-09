import Link from "next/link";
import type { OrderListItem } from "@/server/staffData";
import { CriticalBadge, DeliveryBadge, staffTime } from "./ui";

export function OrdersTable({ orders }: { orders: OrderListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper">
      <table className="w-full min-w-[46rem] border-collapse text-left text-[0.9375rem]">
        <caption className="sr-only">Orders</caption>
        <thead className="border-b border-line bg-neutral-bg text-sm text-ink-muted">
          <tr>
            {["Order", "Patient", "Mobile", "Report", "Delivery", "Signed"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-line last:border-b-0 hover:bg-accent-soft/40">
              <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                <Link href={`/staff/orders/${o.id}`} className="text-accent underline-offset-4 hover:underline">
                  {o.lisOrderId}
                </Link>
              </td>
              <td className="px-3 py-2.5">{o.patientName}</td>
              <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{o.mobile}</td>
              <td className="px-3 py-2.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  {o.status === "READY" ? "Ready" : "Processing"}
                  {o.critical && <CriticalBadge />}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <DeliveryBadge stage={o.delivery} />
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{staffTime(o.signedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
