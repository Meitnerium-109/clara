import { Spinner } from "@/components/ui/Spinner";

export default function PatientLoading() {
  return (
    <div className="flex justify-center py-20 text-accent">
      <Spinner className="h-10 w-10" />
    </div>
  );
}
