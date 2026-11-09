import { Spinner } from "@/components/ui/Spinner";

export default function StaffLoading() {
  return (
    <div className="flex justify-center py-16 text-accent">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
