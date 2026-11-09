import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { linkStatus } from "@/lib/tokens";
import { logStaffView } from "@/server/staffActions";
import { orderDetail } from "@/server/staffData";
import { requireStaff } from "@/server/staffSession";
import { CallbackActions } from "../../CallbackItem";
import { ResendPanel } from "../../ResendPanel";
import { CriticalBadge, DeliveryBadge, staffTime } from "../../ui";

export const metadata: Metadata = { title: "Order · Clara staff" };

const ACTION_LABELS: Record<string, string> = {
  LINK_OPENED: "Opened report link",
  OTP_SENT: "Code sent",
  OTP_VERIFIED: "Code verified",
  OTP_FAILED: "Wrong or expired code",
  REPORT_VIEWED: "Viewed report",
  PDF_DOWNLOADED: "Downloaded PDF",
  SUMMARY_FLAGGED: "Flagged an explanation",
  LINK_RESENT: "Resent link",
  CALLBACK_DONE: "Marked callback done",
  STAFF_VIEWED_ORDER: "Viewed order (staff)",
};

export default async function StaffOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const staff = await requireStaff();
  const { orderId } = await params;
  const order = await orderDetail(orderId);
  if (!order) notFound();
  await logStaffView(order.id, staff.id);

  const now = new Date();
  return (
    <div className="flex flex-col gap-5">
      <Link href="/staff" className="text-accent underline-offset-4 hover:underline">
        ← Orders
      </Link>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{order.lisOrderId}</h1>
          <span className="text-ink-muted">{order.status === "READY" ? "Ready" : "Processing"}</span>
          {order.critical && <CriticalBadge />}
          <DeliveryBadge stage={order.delivery} />
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-[0.9375rem] sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-muted">Patient</dt>
          <dd>{order.patientName}</dd>
          <dt className="text-ink-muted">Mobile</dt>
          <dd className="tabular-nums">{order.mobile}</dd>
          <dt className="text-ink-muted">Doctor</dt>
          <dd>{order.referringDoctor}</dd>
          <dt className="text-ink-muted">Signed</dt>
          <dd>{staffTime(order.signedAt)}</dd>
        </dl>
        {order.status === "READY" && <ResendPanel orderId={order.id} masked={order.mobile} />}
      </Card>

      {order.callbackTask && (
        <Card surface="solid" className={order.callbackTask.status === "OPEN" ? "border-danger-line" : undefined}>
          <h2 className="mb-2 text-lg font-semibold">Callback</h2>
          <p className="mb-3">{order.callbackTask.reason}</p>
          {order.callbackTask.status === "OPEN" ? (
            <CallbackActions taskId={order.callbackTask.id} masked={order.mobile} />
          ) : (
            <p className="text-ink-muted">
              Called by {order.callbackTask.doneBy?.name ?? "staff"} · {staffTime(order.callbackTask.doneAt)}
              {order.callbackTask.note && <> · “{order.callbackTask.note}”</>}
            </p>
          )}
        </Card>
      )}

      <Section title="Results">
        {order.results.length === 0 ? (
          <EmptyState title="No results" />
        ) : (
          <SimpleTable
            head={["Test", "Result", "Range", "Flag"]}
            rows={order.results.map((r) => [
              r.parameter,
              `${r.valueText} ${r.unit}`.trim(),
              `${r.refText} ${r.unit}`.trim() || "—",
              <StatusPill key="f" flag={r.flag} className="text-sm" />,
            ])}
          />
        )}
      </Section>

      <Section title="Report links">
        {order.links.length === 0 ? (
          <EmptyState title="No links yet" message="A link is created when the report is signed." />
        ) : (
          <SimpleTable
            head={["Created", "Why", "By", "Expires", "State"]}
            rows={order.links.map((l) => [
              staffTime(l.createdAt),
              l.reason === "SIGNOFF" ? "Sign-off" : "Resend",
              l.createdBy?.name ?? "Automatic",
              staffTime(l.expiresAt),
              { VALID: "Active", EXPIRED: "Expired", REVOKED: "Replaced" }[linkStatus(l, now)],
            ])}
          />
        )}
      </Section>

      <Section title="Messages">
        {order.messages.length === 0 ? (
          <EmptyState title="No messages yet" />
        ) : (
          <SimpleTable
            head={["Time", "Type", "Channel", "Status"]}
            rows={order.messages.map((m) => [
              staffTime(m.createdAt),
              m.kind === "OTP" ? "Code" : "Report link",
              m.channel === "SMS" ? "SMS" : "WhatsApp",
              m.status.charAt(0) + m.status.slice(1).toLowerCase(),
            ])}
          />
        )}
      </Section>

      <Section title="Access log">
        {order.accessLogs.length === 0 ? (
          <EmptyState title="No access yet" />
        ) : (
          <SimpleTable
            head={["Time", "Who", "What"]}
            rows={order.accessLogs.map((l) => [
              staffTime(l.at),
              l.actorType === "STAFF" ? (l.staffUser?.name ?? "Staff") : l.actorType === "PATIENT" ? "Patient" : "System",
              ACTION_LABELS[l.action] ?? l.action,
            ])}
          />
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[0.9375rem]">
        <thead className="border-b border-line bg-neutral-bg text-sm text-ink-muted">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-line last:border-b-0">
              {cells.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
