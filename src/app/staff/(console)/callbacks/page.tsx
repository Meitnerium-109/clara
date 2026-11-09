import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { callbackTasks } from "@/server/staffData";
import { requireStaff } from "@/server/staffSession";
import { CallbackActions } from "../CallbackItem";
import { staffTime } from "../ui";

export const metadata: Metadata = { title: "Callbacks · Clara staff" };

export default async function CallbacksPage() {
  await requireStaff();
  const { open, done } = await callbackTasks();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Callbacks for critical results</h1>
        <p className="mt-1 text-ink-muted">Patients with critical results get no explanation on screen. Please call them, longest waiting first.</p>
      </div>

      {open.length === 0 ? (
        <Card surface="solid">
          <EmptyState title="No callbacks waiting" message="Critical results create a task here automatically." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {open.map((task) => (
            <li key={task.id} className="rounded-card border border-danger-line bg-paper p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  {task.order.patient.name}{" "}
                  <Link href={`/staff/orders/${task.order.id}`} className="text-base font-normal text-accent underline-offset-4 hover:underline">
                    {task.order.lisOrderId}
                  </Link>
                </h2>
                <span className="text-sm text-ink-muted">Waiting since {staffTime(task.createdAt)}</span>
              </div>
              <p className="mb-4 font-medium text-danger-ink">{task.reason}</p>
              <CallbackActions taskId={task.id} masked={task.mobile} />
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Recently called</h2>
        {done.length === 0 ? (
          <p className="text-ink-muted">None yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-paper">
            {done.map((task) => (
              <li key={task.id} className="flex flex-col gap-0.5 px-4 py-3 text-[0.9375rem]">
                <span>
                  <strong>{task.order.patient.name}</strong> · {task.order.lisOrderId} · {task.reason}
                </span>
                <span className="text-ink-muted">
                  Called by {task.doneBy?.name ?? "staff"} · {staffTime(task.doneAt)}
                  {task.note && <> · “{task.note}”</>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
