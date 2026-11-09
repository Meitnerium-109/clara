import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function OrderNotFound() {
  return (
    <Card className="max-w-xl">
      <EmptyState title="Order not found" action={<ButtonLink href="/staff">Back to orders</ButtonLink>} />
    </Card>
  );
}
