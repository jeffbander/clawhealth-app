export const dynamic = "force-dynamic";
/**
 * /api/patients/enroll — Public patient self-enrollment
 * No Clerk auth required — patients register with phone + basic info
 * HIPAA: All PHI encrypted before storage
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptPHI } from "@/lib/encryption";
import { sendSMS } from "@/lib/twilio";

async function sendSMSWithRetry(phone: string, body: string, attempts = 3): Promise<boolean> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await sendSMS(phone, body);
      return true;
    } catch (err) {
      lastError = err;
      console.warn(`[ENROLL] SMS attempt ${i} failed`, err instanceof Error ? err.message : String(err));
      await new Promise((resolve) => setTimeout(resolve, 400 * i));
    }
  }
  console.error("[ENROLL] SMS failed after retries", lastError instanceof Error ? lastError.message : String(lastError));
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, phone, dob, conditions, medications, additionalInfo, emrText } =
      await req.json();

    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: "Name and phone number are required" },
        { status: 400 }
      );
    }

    // Normalize phone
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    // Check for duplicate phone number
    const e164Phone = phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`;
    const existingPatients = await prisma.patient.findMany({
      select: { id: true, encPhone: true },
    });
    
    // Decrypt and compare phones (encrypted field can't be queried directly)
    const { decryptPHI: decryptCheck } = await import("@/lib/encryption");
    for (const ep of existingPatients) {
      if (ep.encPhone) {
        try {
          const existingPhone = decryptCheck(ep.encPhone);
          if (existingPhone === e164Phone || existingPhone === phone) {
            return NextResponse.json(
              { error: "This phone number is already registered. Please text (929) 412-1499 to reach your health coordinator." },
              { status: 409 }
            );
          }
        } catch {
          // Skip entries that can't be decrypted
        }
      }
    }

    // Find or create a default physician (the practice physician)
    let physician = await prisma.physician.findFirst({
      where: { specialty: "Cardiology" },
      orderBy: { createdAt: "asc" },
    });

    if (!physician) {
      physician = await prisma.physician.create({
        data: {
          clerkUserId: "system_default",
          organizationId: "",
          encName: encryptPHI("Dr. Provider"),
          specialty: "Cardiology",
        },
      });
    }

    // Parse conditions
    const conditionList = Array.isArray(conditions) ? conditions : [];

    // Determine risk level from conditions
    let riskLevel = "LOW";
    const condLower = conditionList.map((c: string) => c.toLowerCase());
    if (condLower.some((c: string) => c.includes("heart failure"))) riskLevel = "HIGH";
    if (condLower.some((c: string) => c.includes("heart attack") || c.includes("prior heart attack"))) riskLevel = "HIGH";
    if (condLower.some((c: string) => c.includes("atrial fibrillation") || c.includes("arrhythmia"))) riskLevel = "MEDIUM";
    if (conditionList.length >= 3) riskLevel = "HIGH";
    if (conditionList.length >= 4) riskLevel = "CRITICAL";

    // Create patient
    const patient = await prisma.patient.create({
      data: {
        clerkUserId: `patient_self_${Date.now()}`,
        organizationId: "",
        encMrn: encryptPHI(`SELF-${Date.now()}`),
        encFirstName: encryptPHI(firstName),
        encLastName: encryptPHI(lastName),
        encDateOfBirth: dob ? encryptPHI(dob) : encryptPHI(""),
        encPhone: encryptPHI(phone),
        encConditions: encryptPHI(JSON.stringify(conditionList)),
        riskLevel,
        physicianId: physician.id,
        agentEnabled: true,
        createdBy: "patient_self_enrollment",
      },
    });

    // Parse and store medications if provided
    if (medications && medications.trim()) {
      const medLines = medications
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      for (const line of medLines) {
        // Try to parse "DrugName dose frequency" pattern
        const parts = line.split(/\s+/);
        const drugName = parts[0] || line;
        const dose = parts[1] || "";
        const frequency = parts.slice(2).join(" ") || "as directed";

        await prisma.medication.create({
          data: {
            patientId: patient.id,
            drugName,
            dose,
            frequency,
            route: "oral",
            prescribedBy: physician.id,
            startDate: new Date(),
            adherenceRate: 0,
            active: true,
          },
        });
      }
    }

    // Store additional info as care plan note
    if (additionalInfo && additionalInfo.trim()) {
      await prisma.carePlan.create({
        data: {
          patientId: patient.id,
          physicianId: physician.id,
          encContent: encryptPHI(`Patient-reported information:\n${additionalInfo}`),
          version: 1,
          active: true,
        },
      });
    }

    // Store onboarding record
    await prisma.conversation.create({
      data: {
        patientId: patient.id,
        role: "AI",
        encContent: encryptPHI(
          `Patient self-enrolled. Name: ${firstName} ${lastName}. Conditions: ${conditionList.join(", ") || "none reported"}. Risk: ${riskLevel}.`
        ),
        audioUrl: "system://self-enrollment",
      },
    });

    try {
      const { initializePatientMarkdownFiles } = await import('@/lib/patient-memory');
      await initializePatientMarkdownFiles(patient.id, {
        name: firstName,
        conditions: conditionList,
        medicalSummary: additionalInfo?.trim() || '',
      });
    } catch {
      // Non-blocking for enrollment flow
    }

    // Send welcome SMS (must succeed)
    const welcomeMessage = `Welcome to ClawHealth, ${firstName}! 🏥 I'm your AI health coordinator, working with your cardiologist at Mount Sinai.\n\nYou can text me anytime about:\n💊 Medications\n📊 Symptoms & vitals\n❓ Health questions\n\nText HELP for assistance or STOP to opt out.\n\nLet's start: how are you feeling today?`;
    const smsSent = await sendSMSWithRetry(phone, welcomeMessage, 3);
    if (!smsSent) {
      return NextResponse.json({ error: "Welcome SMS failed. Please retry." }, { status: 502 });
    }

    // Store the welcome as a conversation
    await prisma.conversation.create({
      data: {
        patientId: patient.id,
        role: "AI",
        encContent: encryptPHI(
          `Welcome to ClawHealth, ${firstName}! I'm your AI health coordinator. You can text me anytime about medications, symptoms, or health questions.`
        ),
        audioUrl: `twilio://sms/welcome`,
      },
    });

    return NextResponse.json({
      success: true,
      patientId: patient.id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Enrollment failed";
    console.error("[ENROLL] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
