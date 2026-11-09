import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { patientStrings } from "@/lib/i18n/patient";
import { getLang } from "@/server/lang";

// Shown both for "doesn't exist" and "not yours": we never confirm that
// someone else's report exists.
export default async function ReportNotFound() {
  const t = patientStrings(await getLang());
  return (
    <Card>
      <EmptyState
        title={t.notFoundTitle}
        message={t.notFoundBody}
        action={
          <ButtonLink href="/my" size="lg">
            {t.allReports}
          </ButtonLink>
        }
      />
    </Card>
  );
}
