export const dynamic = "force-dynamic";
/**
 * /api/care-plans/[id]
 * PUT: update (creates new version)
 * DELETE: deactivate
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI, decryptPHI } from "@/lib/encryption";
import { z } from "zod";

const UpdateSchema = z.object({
  content: z.string().min(1),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Verify ownership
  const existing = await prisma.carePlan.findFirst({
    where: { id, patient: { organizationId: orgId ?? "" } },
    include: { patient: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.carePlan.update({
    where: { id },
    data: {
      encContent: encryptPHI(parsed.data.content),
      version: { increment: 1 },
    },
  });

  const ctx = await getAuditContext(userId, orgId ?? undefined, existing.patientId);
  await logAudit("UPDATE", "care_plan", id, ctx, { version: updated.version });

  let patientName = "Patient";
  try { patientName = decryptPHI(existing.patient.encFirstName) + " " + decryptPHI(existing.patient.encLastName); } catch {}

  return NextResponse.json({
    id: updated.id,
    patientId: updated.patientId,
    patientName,
    version: updated.version,
    active: updated.active,
    content: parsed.data.content,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.carePlan.findFirst({
    where: { id, patient: { organizationId: orgId ?? "" } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.carePlan.update({ where: { id }, data: { active: false } });

  const ctx = await getAuditContext(userId, orgId ?? undefined, existing.patientId);
  await logAudit("DELETE", "care_plan", id, ctx);

  return NextResponse.json({ success: true });
}
