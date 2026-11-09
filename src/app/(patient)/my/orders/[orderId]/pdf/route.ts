import { NextResponse, type NextRequest } from "next/server";
import { buildReportPdf } from "@/lib/reportPdf";
import { logAccess } from "@/server/accessLog";
import { hasConsented } from "@/server/consent";
import { reportForMobile } from "@/server/patientData";
import { getPatientMobile } from "@/server/patientSession";

// Built on request from the stored results and only ever sent to the signed-in
// patient whose mobile owns the order. There is no public file URL to leak.
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const mobile = await getPatientMobile();
  if (!mobile) return NextResponse.redirect(new URL("/login", request.url));
  const { orderId } = await params;
  if (!(await hasConsented(mobile))) {
    return NextResponse.redirect(new URL(`/consent?next=${encodeURIComponent(`/my/orders/${orderId}`)}`, request.url));
  }

  const report = await reportForMobile(mobile, orderId);
  if (!report?.ready) return new NextResponse("Not found", { status: 404 });

  await logAccess({ actorType: "PATIENT", action: "PDF_DOWNLOADED", orderId: report.id, patientId: report.patient.id });

  const pdf = await buildReportPdf({
    labName: "Company A Labs",
    patientName: report.patient.name,
    lisOrderId: report.lisOrderId,
    referringDoctor: report.referringDoctor,
    signedAt: report.signedAt,
    critical: report.critical,
    results: report.results,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="clara-report-${report.lisOrderId}.pdf"`,
      "Cache-Control": "private, no-store", // never kept by shared caches or the browser's back button
    },
  });
}
