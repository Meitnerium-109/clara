"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";

export default function StaffError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="max-w-xl">
      <ErrorState message="This page couldn't load. Check the connection and try again." action={<Button onClick={reset}>Try again</Button>} />
    </Card>
  );
}
