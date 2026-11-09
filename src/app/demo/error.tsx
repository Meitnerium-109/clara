"use client";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

export default function DemoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <ErrorState message="The demo phone couldn't load messages." action={<Button onClick={reset}>Try again</Button>} />
    </div>
  );
}
