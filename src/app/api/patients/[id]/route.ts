export const dynamic = "force-dynamic";
/**
 * /api/patients/[id]
 * GET: single patient with all relations
 * PUT: update patient
 * DELETE: soft delete (deactivate agent)
 * HIPAA: full encryption + audit
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI, encryptJSON, decryptPHI, decryptJSON } from "@/lib/encryption";
import { z } from "zod";

const UpdatePatientSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  primaryDx: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  agentEnabled: z.boolean().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
}).strict();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patient = await prisma.patient.findFirst({
    where: { id, organizationId: orgId ?? "" },
    include: {
      medications: { where: { active: true } },
      vitals: { orderBy: { recordedAt: "desc" }, take: 20 },
      alerts: { where: { resolved: false }, orderBy: { createdAt: "desc" } },
      carePlans: { where: { active: true }, take: 1 },
      conversations: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ctx = await getAuditContext(userId, orgId ?? undefined, id);
  await logAudit("READ", "patient", id, ctx, { fields: "full_detail" });

  // Decrypt PHI in memory for response
  let firstName = "", lastName = "", conditions: string[] = [];
  try {
    firstName = decryptPHI(patient.encFirstName);
    lastName = decryptPHI(patient.encLastName);
    conditions = decryptJSON<string[]>(patient.encConditions);
  } catch {}

  const vitals = patient.vitals.map((v) => {
    let value = "";
    try { value = decryptPHI(v.encValue); } catch {}
    return { id: v.id, type: v.type, value, unit: v.unit, recordedAt: v.recordedAt, source: v.source };
  });

  const alerts = patient.alerts.map((a) => {
    let message = "";
    try { message = decryptPHI(a.encMessage); } catch {}
    return { id: a.id, severity: a.severity, category: a.category, message, createdAt: a.createdAt };
  });

  const conversations = patient.conversations.map((c) => {
    let content = "";
    try { content = decryptPHI(c.encContent); } catch {}
    return { id: c.id, role: c.role, content, createdAt: c.createdAt };
  });

  let carePlanContent = "";
  if (patient.carePlans[0]) {
    try { carePlanContent = decryptPHI(patient.carePlans[0].encContent); } catch {}
  }

  return NextResponse.json({
    id: patient.id,
    firstName,
    lastName,
    riskLevel: patient.riskLevel,
    primaryDx: patient.primaryDx,
    conditions,
    agentEnabled: patient.agentEnabled,
    lastInteraction: patient.lastInteraction,
    medications: patient.medications,
    vitals,
    alerts,
    conversations,
    carePlan: carePlanContent,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify patient belongs to org
  const existing = await prisma.patient.findFirst({ where: { id, organizationId: orgId ?? "" } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdatePatientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  // Only encrypt and update provided PHI fields
  if (data.firstName) updateData.encFirstName = encryptPHI(data.firstName);
  if (data.lastName) updateData.encLastName = encryptPHI(data.lastName);
  if (data.phone) updateData.encPhone = encryptPHI(data.phone);
  if (data.address) updateData.encAddress = encryptPHI(data.address);
  if (data.conditions) updateData.encConditions = encryptJSON(data.conditions);
  if (data.riskLevel !== undefined) updateData.riskLevel = data.riskLevel;
  if (data.primaryDx !== undefined) updateData.primaryDx = data.primaryDx;
  if (data.agentEnabled !== undefined) updateData.agentEnabled = data.agentEnabled;

  const updated = await prisma.patient.update({
    where: { id },
    data: updateData,
    select: { id: true, riskLevel: true, agentEnabled: true, updatedAt: true },
  });

  const ctx = await getAuditContext(userId, orgId ?? undefined, id);
  await logAudit("UPDATE", "patient", id, ctx, {
    fieldsUpdated: Object.keys(data).join(","),
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.patient.findFirst({ where: { id, organizationId: orgId ?? "" } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft delete: disable agent, don't remove records (HIPAA retention)
  await prisma.patient.update({
    where: { id },
    data: { agentEnabled: false },
  });

  const ctx = await getAuditContext(userId, orgId ?? undefined, id);
  await logAudit("DELETE", "patient", id, ctx, { type: "soft_delete" });

  return NextResponse.json({ success: true, id });
}
