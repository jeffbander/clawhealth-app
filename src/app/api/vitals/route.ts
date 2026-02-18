/**
 * /api/vitals
 * GET: recent vitals for a patient
 * POST: create a vital entry (encrypted)
 * HIPAA: auth + audit
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI, decryptPHI } from "@/lib/encryption";
import { z } from "zod";

const VitalType = z.enum([
  "BLOOD_PRESSURE_SYSTOLIC",
  "BLOOD_PRESSURE_DIASTOLIC",
  "HEART_RATE",
  "WEIGHT",
  "GLUCOSE",
  "OXYGEN_SATURATION",
  "TEMPERATURE",
]);

const CreateVitalSchema = z.object({
  patientId: z.string().min(1),
  type: VitalType,
  value: z.string().min(1),
  unit: z.string().min(1),
  source: z.string().default("patient_app"),
  recordedAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patientId = req.nextUrl.searchParams.get("patientId");
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7");

  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 });
  }

  // Verify access
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      OR: [
        { organizationId: orgId ?? "", clerkUserId: undefined },
        { clerkUserId: userId },
        { organizationId: orgId ?? "" },
      ],
    },
    select: { id: true, organizationId: true },
  });

  if (!patient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const vitals = await prisma.vital.findMany({
    where: { patientId, recordedAt: { gte: since } },
    orderBy: { recordedAt: "desc" },
  });

  const ctx = await getAuditContext(userId, patient.organizationId, patientId);
  await logAudit("READ", "vital", patientId, ctx, { days, count: vitals.length });

  const decrypted = vitals.map((v) => {
    let value = "";
    try { value = decryptPHI(v.encValue); } catch {}
    return { id: v.id, type: v.type, value, unit: v.unit, recordedAt: v.recordedAt, source: v.source };
  });

  return NextResponse.json(decrypted);
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateVitalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { patientId, type, value, unit, source, recordedAt } = parsed.data;

  // Verify access — patient can log their own, physician can log for org patients
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

  const vital = await prisma.vital.create({
    data: {
      patientId,
      type,
      encValue: encryptPHI(value), // encrypt the vital value
      unit,
      source,
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    },
    select: { id: true, type: true, unit: true, recordedAt: true, source: true },
  });

  const ctx = await getAuditContext(userId, patient.organizationId, patientId);
  await logAudit("CREATE", "vital", vital.id, ctx, { type, unit });

  return NextResponse.json(vital, { status: 201 });
}
