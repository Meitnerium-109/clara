import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/Button";
import { consoleCounts } from "@/server/staffData";
import { requireStaff } from "@/server/staffSession";
import { signOut } from "./actions";

// Shared shell for every signed-in staff screen. Pages check the session
// themselves too: Next.js can reuse a layout without re-running it.
export default async function StaffConsoleLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const counts = await consoleCounts().catch(() => null); // the shell still renders if counts fail

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-10 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Wordmark suffix="Staff" className="text-lg" />
            <nav aria-label="Staff" className="flex flex-wrap gap-1 text-[0.9375rem]">
              <NavLink href="/staff">Orders</NavLink>
              <NavLink href="/staff/callbacks" count={counts?.openCallbacks} urgent>
                Callbacks
              </NavLink>
              <NavLink href="/staff/flags" count={counts?.flagged}>
                Flagged
              </NavLink>
              <NavLink href="/staff/import">Import</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[0.9375rem] text-ink-muted sm:inline">{staff.name}</span>
            <form action={signOut}>
              <Button type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, count, urgent = false, children }: { href: string; count?: number; urgent?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-accent hover:bg-accent-soft">
      {children}
      {count ? (
        <span className={urgent ? "rounded-full bg-danger-ink px-1.5 text-xs font-bold text-white" : "rounded-full bg-accent-soft px-1.5 text-xs font-bold text-accent"}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}
