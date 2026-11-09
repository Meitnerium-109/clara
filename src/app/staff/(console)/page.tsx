import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireStaff } from "@/server/staffSession";

export const metadata: Metadata = { title: "Staff · Clara" };

export default async function StaffHomePage() {
  const staff = await requireStaff();

  return (
    <Card className="max-w-xl">
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="mt-2 text-ink-muted">
        Signed in as <span className="font-semibold text-ink">{staff.name}</span> ({staff.email})
      </p>
      <ButtonLink href="/staff/import" className="mt-6">
        Import LIS results
      </ButtonLink>
    </Card>
  );
}
