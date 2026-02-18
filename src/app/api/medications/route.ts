export const dynamic = "force-dynamic";
/**
 * /api/medications
 * GET: list medications for a patient
 * POST: create medication
 * PATCH: update adherence or status
 * HIPAA: auth + audit
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { z } from "zod";

const CreateMedSchema = z.object({
  patientId: z.string().min(1),
  drugName: z.string().min(1),
  dose: z.string().min(1),
  frequency: z.string().min(1),
  route: z.string().default("oral"),
  prescribedBy: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
});

const UpdateMedSchema = z.object({
  id: z.string().min(1),
  adherenceRate: z.number().min(0).max(100).optional(),
  lastTaken: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patientId = req.nextUrl.searchParams.get("patientId");
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });

  // Verify access
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      OR: [
        { clerkUserId: userId },
        { organizationId: orgId ?? "" },
      ],
    },
    select: { id: true, organizationId: true },
  });
  if (!patient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const meds = await prisma.medication.findMany({
    where: { patientId },
    orderBy: { startDate: "desc" },
  });

  const ctx = await getAuditContext(userId, patient.organizationId, patientId);
  await logAudit("READ", "medication", patientId, ctx, { count: meds.length });

  return NextResponse.json(meds);
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateMedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, organizationId: orgId ?? "" },
    select: { id: true, organizationId: true },
  });
  if (!patient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const med = await prisma.medication.create({
    data: {
      patientId: data.patientId,
      drugName: data.drugName,
      dose: data.dose,
      frequency: data.frequency,
      route: data.route,
      prescribedBy: data.prescribedBy,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });

  const ctx = await getAuditContext(userId, orgId ?? undefined, data.patientId);
  await logAudit("CREATE", "medication", med.id, ctx, { drugName: med.drugName });

  return NextResponse.json(med, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = UpdateMedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { id, adherenceRate, lastTaken, active } = parsed.data;

  // Fetch medication to verify org access
  const med = await prisma.medication.findFirst({
    where: { id },
    include: { patient: { select: { organizationId: true, clerkUserId: true } } },
  });
  if (!med) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify access: own patient or org physician
  const isOwnPatient = med.patient.clerkUserId === userId;
  const isOrgPhysician = med.patient.organizationId === (orgId ?? "");
  if (!isOwnPatient && !isOrgPhysician) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (adherenceRate !== undefined) updateData.adherenceRate = adherenceRate;
  if (lastTaken) updateData.lastTaken = new Date(lastTaken);
  if (active !== undefined) updateData.active = active;

  const updated = await prisma.medication.update({ where: { id }, data: updateData });

  const ctx = await getAuditContext(userId, med.patient.organizationId, med.patientId);
  await logAudit("UPDATE", "medication", id, ctx, adherenceRate !== undefined ? { adherenceRate } : undefined);

  return NextResponse.json(updated);
}
