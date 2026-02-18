/**
 * /api/alerts/[id]
 * PATCH: resolve an alert
 * HIPAA: auth + audit
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI } from "@/lib/encryption";
import { z } from "zod";

const ResolveSchema = z.object({
  resolved: z.literal(true),
  resolution: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = ResolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Verify alert belongs to org
  const alert = await prisma.alert.findFirst({
    where: { id, patient: { organizationId: orgId ?? "" } },
    select: { id: true, patientId: true },
  });

  if (!alert) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      resolved: true,
      resolvedBy: userId,
      resolvedAt: new Date(),
      encResolution: parsed.data.resolution
        ? encryptPHI(parsed.data.resolution)
        : undefined,
    },
    select: { id: true, resolved: true, resolvedAt: true, resolvedBy: true },
  });

  const ctx = await getAuditContext(userId, orgId ?? undefined, alert.patientId);
  await logAudit("UPDATE", "alert", id, ctx, { action: "resolve" });

  return NextResponse.json(updated);
}
