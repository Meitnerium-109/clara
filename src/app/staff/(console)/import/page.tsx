import type { Metadata } from "next";
import { requireStaff } from "@/server/staffSession";
import { ImportFlow } from "./ImportFlow";

export const metadata: Metadata = { title: "Import · Clara" };

export default async function ImportPage() {
  await requireStaff();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Import LIS results</h1>
        <p className="mt-1 text-ink-muted">
          Signed reports are sent to patients automatically when you confirm. Re-importing a file never sends twice.
        </p>
      </div>
      <ImportFlow />
    </div>
  );
}
