import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { isDemoMode } from "@/server/config";
import { demoMessages, demoNumbers } from "@/server/demoPhone";
import { markDelivered } from "@/server/outbox";
import { AutoRefresh } from "./AutoRefresh";

export const metadata: Metadata = { title: "Demo phone · Clara", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TIME = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function DemoPhonePage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  if (!isDemoMode()) notFound();
  const { n } = await searchParams;
  const numbers = await demoNumbers();
  const selected = numbers.find((x) => x.key === n) ?? null;
  const messages = selected ? await demoMessages(selected.mobile) : [];
  // The "phone" has now received these: staff see them as delivered.
  await markDelivered(messages.map((m) => m.id));

  return (
    <div className="patient-scale mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Wordmark className="text-xl" />
        <span className="rounded-full border-2 border-dashed border-warn-line bg-warn-bg px-3 py-1 text-base font-bold text-warn-ink">
          DEMO TOOL
        </span>
      </div>

      <Card className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Demo phone</h1>
        <p className="text-ink-muted">
          Clara doesn&apos;t send real WhatsApp or SMS messages in this demo. This screen shows what a patient&apos;s phone
          would receive, so you can open report links and read codes. It only exists when DEMO_MODE is on.
        </p>
      </Card>

      <nav aria-label="Choose a phone number" className="flex flex-col gap-2">
        <h2 className="font-semibold">Whose phone?</h2>
        <ul className="flex flex-col gap-2">
          {numbers.map((num) => (
            <li key={num.key}>
              <Link
                href={`/demo/phone?n=${num.key}`}
                aria-current={num.key === selected?.key ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col justify-center rounded-2xl border px-4 py-2",
                  num.key === selected?.key ? "border-accent bg-accent text-white" : "border-line bg-paper hover:border-accent",
                )}
              >
                <span className="font-semibold tabular-nums">{num.masked}</span>
                <span className={cn("text-base", num.key === selected?.key ? "text-white/90" : "text-ink-muted")}>
                  {num.names.join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-label="Messages" className="overflow-hidden rounded-[2rem] border-4 border-ink/80 bg-[#e8f3ef]">
        <div className="bg-ink px-5 py-3 text-white">
          <p className="font-semibold">{selected ? `Messages · ${selected.masked}` : "Messages"}</p>
          {selected && <p className="text-sm text-white/80">Updates automatically</p>}
        </div>
        <div className="flex min-h-64 flex-col gap-3 p-4">
          {!selected ? (
            <EmptyState title="Choose a number" message="Pick a phone above to see the messages it received." />
          ) : messages.length === 0 ? (
            <EmptyState title="No messages yet" message="Report links appear here when an order is signed. Codes appear when someone asks for one." />
          ) : (
            messages.map((m) => (
              <article key={m.id} className="max-w-[92%] rounded-2xl rounded-tl-sm bg-paper p-3 shadow-sm">
                <p className="mb-1 text-sm font-semibold text-accent">
                  {m.channel === "WHATSAPP" ? "WhatsApp" : "SMS"} · {m.kind === "OTP" ? "Code" : "Report link"}
                </p>
                {m.body ? (
                  <p className="text-base break-words whitespace-pre-line">{linkify(m.body)}</p>
                ) : (
                  <p className="text-base text-ink-muted italic">Text not stored (DEMO_MODE was off when this was sent).</p>
                )}
                <p className="mt-1 text-right text-xs text-ink-muted">{TIME.format(m.createdAt)}</p>
              </article>
            ))
          )}
        </div>
      </section>
      {selected && <AutoRefresh />}
    </div>
  );
}

function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
