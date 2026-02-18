export const dynamic = "force-dynamic";
/**
 * /api/patients
 * GET: list patients for current org
 * POST: create patient
 * HIPAA: all PHI encrypted, full audit logging
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI, encryptJSON, decryptPHI } from "@/lib/encryption";
import { z } from "zod";

const CreatePatientSchema = z.object({
  clerkUserId: z.string().min(1),
  physicianId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  mrn: z.string().min(1),
  ssn: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  primaryDx: z.string().optional(),
  conditions: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getAuditContext(userId, orgId ?? undefined);

  const patients = await prisma.patient.findMany({
    where: { organizationId: orgId ?? "" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      encFirstName: true,
      riskLevel: true,
      primaryDx: true,
      lastInteraction: true,
      createdAt: true,
      agentEnabled: true,
      _count: {
        select: {
          alerts: { where: { resolved: false } },
          medications: { where: { active: true } },
        },
      },
    },
  });

  await logAudit("READ", "patient", "list", ctx, { count: patients.length });

  // Decrypt only firstName for list view — minimal PHI exposure
  const result = patients.map((p) => {
    let firstName = "Patient";
    try { firstName = decryptPHI(p.encFirstName); } catch {}
    return {
      id: p.id,
      firstName,
      riskLevel: p.riskLevel,
      primaryDx: p.primaryDx,
      lastInteraction: p.lastInteraction,
      createdAt: p.createdAt,
      agentEnabled: p.agentEnabled,
      activeAlerts: p._count.alerts,
      activeMedications: p._count.medications,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreatePatientSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Encrypt all PHI fields before storage
  const patient = await prisma.patient.create({
    data: {
      clerkUserId: data.clerkUserId,
      organizationId: orgId ?? "",
      physicianId: data.physicianId,
      encMrn: encryptPHI(data.mrn),
      encFirstName: encryptPHI(data.firstName),
      encLastName: encryptPHI(data.lastName),
      encDateOfBirth: encryptPHI(data.dateOfBirth),
      encSsn: data.ssn ? encryptPHI(data.ssn) : undefined,
      encAddress: data.address ? encryptPHI(data.address) : undefined,
      encPhone: data.phone ? encryptPHI(data.phone) : undefined,
      encEmail: data.email ? encryptPHI(data.email) : undefined,
      riskLevel: data.riskLevel,
      primaryDx: data.primaryDx,
      encConditions: encryptJSON(data.conditions),
      createdBy: userId,
    },
    select: { id: true, riskLevel: true, primaryDx: true, createdAt: true },
  });

  const ctx = await getAuditContext(userId, orgId ?? undefined, patient.id);
  await logAudit("CREATE", "patient", patient.id, ctx);

  // Return minimal non-PHI response
  return NextResponse.json(
    { id: patient.id, riskLevel: patient.riskLevel, primaryDx: patient.primaryDx },
    { status: 201 }
  );
}
