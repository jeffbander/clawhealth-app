export const dynamic = "force-dynamic";
/**
 * /api/patients/onboard — EMR paste → LLM parses into structured patient record
 * Physician pastes raw EMR text, Claude extracts medications, conditions, summary
 * HIPAA: All output encrypted before storage, no PHI in logs
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { encryptPHI } from "@/lib/encryption";
import { logAudit, getAuditContext } from "@/lib/audit";
import { sendSMS } from "@/lib/twilio";
import { parseEmrText, type ParsedPatient } from "@/lib/emr-parser";

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emrText, physicianId: providedPhysicianId } = await req.json();

  if (!emrText) {
    return NextResponse.json(
      { error: "emrText required" },
      { status: 400 }
    );
  }

  // Resolve physician — use provided ID or find from auth
  let physicianId = providedPhysicianId;
  if (!physicianId || physicianId === "auto") {
    const physician = await prisma.physician.findFirst({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (!physician) {
      // Auto-create physician record if none exists
      const created = await prisma.physician.create({
        data: {
          clerkUserId: userId,
          organizationId: orgId ?? "",
          encName: encryptPHI("Dr. Provider"),
          specialty: "Cardiology",
        },
      });
      physicianId = created.id;
    } else {
      physicianId = physician.id;
    }
  }

  let parsed: ParsedPatient;
  try {
    parsed = await parseEmrText(emrText);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse EMR text. Please try again with more structured input." },
      { status: 422 }
    );
  }

  // Create patient with encrypted PHI
  const patient = await prisma.patient.create({
    data: {
      clerkUserId: `patient_${Date.now()}`, // placeholder — not a real Clerk user
      organizationId: orgId ?? "",
      encMrn: encryptPHI(`MRN-${Date.now()}`),
      encFirstName: encryptPHI(parsed.firstName || "Unknown"),
      encLastName: encryptPHI(parsed.lastName || "Unknown"),
      encDateOfBirth: encryptPHI(parsed.dateOfBirth || ""),
      encPhone: parsed.phone ? encryptPHI(parsed.phone) : null,
      encConditions: encryptPHI(JSON.stringify(parsed.conditions)),
      riskLevel: parsed.riskLevel || "MEDIUM",
      primaryDx: parsed.primaryDx || null,
      physicianId,
      agentEnabled: true,
      createdBy: userId,
    },
  });

  // Create medications
  if (parsed.medications?.length) {
    await prisma.medication.createMany({
      data: parsed.medications.map((med) => ({
        patientId: patient.id,
        drugName: med.drugName,
        dose: med.dose,
        frequency: med.frequency,
        route: med.route || "oral",
        prescribedBy: physicianId,
        startDate: new Date(),
        adherenceRate: 0,
        active: true,
      })),
    });
  }

  // Create initial care plan from medical summary
  if (parsed.medicalSummary) {
    await prisma.carePlan.create({
      data: {
        patientId: patient.id,
        physicianId,
        encContent: encryptPHI(parsed.medicalSummary),
        version: 1,
        active: true,
      },
    });
  }

  // Store initial memory/insights as first AI conversation
  const onboardingSummary = `Patient onboarded via EMR import. ${parsed.conditions.length} conditions identified: ${parsed.conditions.join(", ")}. ${parsed.medications.length} active medications. Risk level: ${parsed.riskLevel}.`;
  await prisma.conversation.create({
    data: {
      patientId: patient.id,
      role: "AI",
      encContent: encryptPHI(onboardingSummary),
      audioUrl: "system://onboarding",
    },
  });

  // Initialize NanoClaw patient memory (SOUL.md + MEMORY.md)
  try {
    const { initializePatientMemory, initializePatientMarkdownFiles } = await import('@/lib/patient-memory')
    await initializePatientMemory(patient.id, {
      name: parsed.firstName,
      conditions: parsed.conditions,
      communicationStyle: 'Warm, supportive, plain language appropriate for SMS. 2-4 sentences max.',
    })
    await initializePatientMarkdownFiles(patient.id, {
      name: parsed.firstName || "Patient",
      conditions: parsed.conditions,
      medicalSummary: parsed.medicalSummary,
    })
  } catch {
    // Non-blocking — memory files are supplementary to DB
  }

  // Send welcome SMS if phone number was parsed from EMR
  if (parsed.phone) {
    try {
      await sendSMS(
        parsed.phone,
        `Welcome to ClawHealth, ${parsed.firstName}! 🏥 I'm your AI health coordinator, working with your cardiologist at Mount Sinai.\n\nYou can text me anytime about:\n💊 Medications\n📊 Symptoms & vitals\n❓ Health questions\n\nText HELP for assistance or STOP to opt out.\n\nLet's start: how are you feeling today?`
      );
      await prisma.conversation.create({
        data: {
          patientId: patient.id,
          role: "AI",
          encContent: encryptPHI(
            `Welcome to ClawHealth, ${parsed.firstName}! I'm your AI health coordinator. You can text me anytime about medications, symptoms, or health questions.`
          ),
          audioUrl: `twilio://sms/welcome`,
        },
      });
    } catch {
      // SMS failure shouldn't block onboarding — patient record is already created
    }
  }

  // Audit log
  const ctx = await getAuditContext(userId, orgId ?? undefined, patient.id);
  await logAudit("CREATE", "patient", patient.id, ctx, {
    method: "emr_paste",
    conditionsCount: parsed.conditions.length,
    medicationsCount: parsed.medications.length,
  });

  return NextResponse.json({
    success: true,
    patientId: patient.id,
    parsed: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      conditions: parsed.conditions,
      medicationCount: parsed.medications.length,
      riskLevel: parsed.riskLevel,
      primaryDx: parsed.primaryDx,
    },
  });
}
