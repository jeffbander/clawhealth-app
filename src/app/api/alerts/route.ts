export const dynamic = "force-dynamic";
/**
 * /api/alerts
 * GET: unresolved alerts for the physician's org patients
 * HIPAA: auth + audit, decrypt message for display
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await prisma.alert.findMany({
    where: {
      resolved: false,
      patient: { organizationId: orgId ?? "" },
    },
    include: {
      patient: {
        select: { encFirstName: true, id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const ctx = await getAuditContext(userId, orgId ?? undefined);
  await logAudit("READ", "alert", "list", ctx, { count: alerts.length });

  const result = alerts.map((a) => {
    let message = "";
    let firstName = "Patient";
    try { message = decryptPHI(a.encMessage); } catch {}
    try { firstName = decryptPHI(a.patient.encFirstName); } catch {}

    return {
      id: a.id,
      patientId: a.patientId,
      firstName,
      severity: a.severity,
      category: a.category,
      message,
      triggerSource: a.triggerSource,
      createdAt: a.createdAt,
    };
  });

  return NextResponse.json(result);
}
