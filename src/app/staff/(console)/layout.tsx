import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/Button";
import { requireStaff } from "@/server/staffSession";
import { signOut } from "./actions";

// Shared shell for every signed-in staff screen. Pages check the session
// themselves too: Next.js can reuse a layout without re-running it.
export default async function StaffConsoleLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-10 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Wordmark suffix="Staff" className="text-lg" />
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
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
