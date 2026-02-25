export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI, encryptJSON, decryptPHI } from "@/lib/encryption";
import { z } from "zod";
import { sendSMS } from "@/lib/twilio";

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

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreatePatientSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

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

  try {
    const { initializePatientMarkdownFiles } = await import("@/lib/patient-memory");
    await initializePatientMarkdownFiles(patient.id, {
      name: data.firstName,
      conditions: data.conditions,
    });
  } catch {
    // Non-blocking for patient creation
  }

  // Send welcome SMS if phone number is provided
  if (data.phone) {
    try {
      await sendSMS(
        data.phone,
        `Welcome to ClawHealth!`
      );
      await prisma.conversation.create({
        data: {
          patientId: patient.id,
          role: "AI",
          encContent: encryptPHI(
            `Welcome to ClawHealth!`
          ),
          audioUrl: `twilio://sms/welcome`,
        },
      });
    } catch (e) {
       console.error(`Failed to send welcome SMS to ${data.phone}:`, e)
       // Non-blocking for patient creation
    }
  }

  return NextResponse.json(
    { id: patient.id, riskLevel: patient.riskLevel, primaryDx: patient.primaryDx },
    { status: 201 }
  );
}
