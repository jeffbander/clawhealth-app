export const dynamic = "force-dynamic";
/**
 * /api/care-plans
 * GET: list care plans for current org
 * POST: create care plan
 * HIPAA: content encrypted, audit logged
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI, decryptPHI } from "@/lib/encryption";
import { z } from "zod";

const CreateSchema = z.object({
  patientId: z.string().min(1),
  content: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getAuditContext(userId, orgId ?? undefined);

  const plans = await prisma.carePlan.findMany({
    where: {
      active: true,
      patient: { organizationId: orgId ?? "" },
    },
    include: { patient: true },
    orderBy: { updatedAt: "desc" },
  });

  await logAudit("READ", "care_plan", "list", ctx, { count: plans.length });

  const result = plans.map((plan) => {
    let patientName = "Patient";
    let content = "";
    try { patientName = decryptPHI(plan.patient.encFirstName) + " " + decryptPHI(plan.patient.encLastName); } catch {}
    try { content = decryptPHI(plan.encContent); } catch {}
    return {
      id: plan.id,
      patientId: plan.patientId,
      patientName,
      version: plan.version,
      active: plan.active,
      content,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { patientId, content } = parsed.data;

  // Verify patient belongs to this org
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: orgId ?? "" },
  });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  // Get physician record
  const physician = await prisma.physician.findFirst({
    where: { clerkUserId: userId },
  });
  if (!physician) return NextResponse.json({ error: "Physician record not found" }, { status: 404 });

  // Deactivate existing care plans
  await prisma.carePlan.updateMany({
    where: { patientId, active: true },
    data: { active: false },
  });

  const plan = await prisma.carePlan.create({
    data: {
      patientId,
      physicianId: physician.id,
      encContent: encryptPHI(content),
      version: 1,
      active: true,
    },
  });

  const ctx = await getAuditContext(userId, orgId ?? undefined, patientId);
  await logAudit("CREATE", "care_plan", plan.id, ctx);

  let patientName = "Patient";
  try { patientName = decryptPHI(patient.encFirstName) + " " + decryptPHI(patient.encLastName); } catch {}

  return NextResponse.json({
    id: plan.id,
    patientId: plan.patientId,
    patientName,
    version: plan.version,
    active: plan.active,
    content,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  }, { status: 201 });
}
