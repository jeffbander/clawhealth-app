export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { checkInteractions } from "@/lib/med-interactions";
import { logAudit, getAuditContext } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id, organizationId: orgId ?? "" },
    include: {
      medications: { where: { active: true } },
    },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const interactions = checkInteractions(patient.medications);

  const ctx = await getAuditContext(userId, orgId ?? undefined, id);
  await logAudit("READ", "med_interactions", id, ctx, {
    medCount: patient.medications.length,
    interactionCount: interactions.length,
  });

  return NextResponse.json({ interactions, medicationCount: patient.medications.length });
}
