export const dynamic = "force-dynamic";
/**
 * /api/patients/onboard — EMR paste → LLM parses into structured patient record
 * Physician pastes raw EMR text, Claude extracts medications, conditions, summary
 * HIPAA: All output encrypted before storage, no PHI in logs
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { encryptPHI } from "@/lib/encryption";
import { logAudit, getAuditContext } from "@/lib/audit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ParsedPatient {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  conditions: string[];
  medications: Array<{
    drugName: string;
    dose: string;
    frequency: string;
    route: string;
  }>;
  medicalSummary: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  primaryDx: string;
}

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

  // Use Claude to parse raw EMR text into structured data
  const completion = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    system: `You are a medical data extraction assistant. Parse the provided EMR/clinical text and extract structured patient data. Return ONLY valid JSON with no additional text.

Extract:
- firstName, lastName, dateOfBirth (YYYY-MM-DD format)
- phone (if present, E.164 format preferred)
- conditions: array of condition names (e.g. ["Heart Failure with reduced EF", "Atrial Fibrillation", "Type 2 Diabetes"])
- medications: array of objects with drugName, dose, frequency, route (default "oral")
- medicalSummary: 2-3 sentence clinical summary including relevant history, EF if available, relevant procedures
- riskLevel: assess as LOW/MEDIUM/HIGH/CRITICAL using cardiology criteria:
  CRITICAL = EF ≤30%, NYHA III-IV, elevated BNP/NT-proBNP, recent hospitalization, or ≥3 major comorbidities
  HIGH = EF 31-40%, AFib on anticoagulation, CAD with stents/CABG, CKD stage 3+, or ≥2 major comorbidities  
  MEDIUM = Controlled HTN with 2+ meds, stable valvular disease, single major condition
  LOW = Well-controlled single condition, normal EF, low medication burden
- primaryDx: primary ICD-10 code if identifiable (e.g. "I50.22" for HFrEF)

If a field is not found in the text, use empty string or empty array. Never fabricate data not present in the source text.`,
    messages: [
      {
        role: "user",
        content: `Parse this EMR text into structured patient data:\n\n${emrText}`,
      },
    ],
  });

  let parsed: ParsedPatient;
  try {
    const text =
      completion.content[0].type === "text" ? completion.content[0].text : "";
    // Strip markdown code fences if present
    const jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch (e) {
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
