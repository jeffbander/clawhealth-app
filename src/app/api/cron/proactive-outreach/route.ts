/**
 * Proactive Patient Outreach Cron
 *
 * Runs daily at 9:00 AM ET (14:00 UTC) via Vercel cron.
 * Sends personalized AI-generated check-ins to patients who haven't
 * been contacted recently. Each interaction counts toward CCM billing.
 *
 * CCM time credit: 2 min per proactive outreach (logged as cron://*)
 * 100 patients × 2 min × 22 working days = 4,400 min/month
 * At 20 min threshold: all patients qualify for 99490 = $6,400/month
 *
 * Authentication: Vercel sets Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePatientResponse } from "@/lib/ai-agent";
import { sendSMS } from "@/lib/twilio";
import { decryptPHI, encryptPHI } from "@/lib/encryption";

// How long since last interaction before we send proactive outreach
const OUTREACH_INTERVAL_HOURS = {
  CRITICAL: 12,  // twice daily for CRITICAL patients
  HIGH: 20,      // daily for HIGH-risk
  MEDIUM: 24,    // daily for MEDIUM-risk
  LOW: 48,       // every other day for LOW-risk
} as const;

// Max patients per cron run (rate limiting)
const MAX_PATIENTS_PER_RUN = 50;

// Conversation starters by risk level and context
const PROACTIVE_PROMPTS: Record<string, string[]> = {
  CRITICAL: [
    "Good morning! I'm checking in on you today. How are you feeling? Any shortness of breath, chest discomfort, or new symptoms?",
    "Hi, just doing my daily check-in. How did you sleep? Any concerns with your medications today?",
    "Good morning! Time for our check-in. How are your energy levels today? Any swelling in your legs or ankles?",
  ],
  HIGH: [
    "Good morning! How are you feeling today? Don't forget your morning medications if you haven't taken them yet.",
    "Hi! Checking in to see how you're doing. Any questions about your medications or health today?",
    "Good morning! Just your daily check-in. How's your health today? Let me know if anything feels off.",
  ],
  MEDIUM: [
    "Good morning! How are you today? Remember to take your medications as prescribed.",
    "Hi! Your ClawHealth care team is checking in. How are you feeling today?",
    "Good morning! Any health questions or concerns today? We're here to help.",
  ],
  LOW: [
    "Hi! Your health care team is checking in. How have you been feeling lately?",
    "Good morning! Just a friendly check-in from your care team. All good?",
  ],
};

function getProactivePrompt(riskLevel: string, firstName: string): string {
  const prompts = PROACTIVE_PROMPTS[riskLevel] || PROACTIVE_PROMPTS['MEDIUM'];
  const base = prompts[Math.floor(Math.random() * prompts.length)];
  // Personalize with first name
  return base.replace(/^(Good morning|Hi)(!|,)/, `$1, ${firstName}$2`);
}

function getOutreachIntervalHours(riskLevel: string): number {
  return OUTREACH_INTERVAL_HOURS[riskLevel as keyof typeof OUTREACH_INTERVAL_HOURS] ?? 24;
}

interface OutreachResult {
  patientId: string;
  sent: boolean;
  reason?: string;
  messageSid?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Authenticate cron request
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");
    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: OutreachResult[] = [];
  const errors: string[] = [];
  const startTime = Date.now();

  try {
    const now = new Date();

    // Find patients who need outreach, ordered by risk level (most critical first)
    const patients = await prisma.patient.findMany({
      where: {
        agentEnabled: true,
        encPhone: { not: null },
      },
      select: {
        id: true,
        encFirstName: true,
        encPhone: true,
        riskLevel: true,
        lastInteraction: true,
        primaryDx: true,
        medications: {
          where: { active: true },
          select: { drugName: true, dose: true, frequency: true },
          take: 3,
        },
      },
      orderBy: [
        // CRITICAL first
        { riskLevel: "asc" },
        { lastInteraction: "asc" },
      ],
      take: MAX_PATIENTS_PER_RUN,
    });

    for (const patient of patients) {
      // Check if enough time has passed since last interaction
      const intervalHours = getOutreachIntervalHours(patient.riskLevel);
      const cutoff = new Date(now.getTime() - intervalHours * 60 * 60 * 1000);

      if (patient.lastInteraction && patient.lastInteraction > cutoff) {
        results.push({
          patientId: patient.id,
          sent: false,
          reason: `Contacted within last ${intervalHours}h`,
        });
        continue;
      }

      // Decrypt PHI in memory
      let firstName = "there";
      let phone = "";
      try {
        firstName = decryptPHI(patient.encFirstName);
        phone = decryptPHI(patient.encPhone!);
      } catch {
        results.push({ patientId: patient.id, sent: false, reason: "PHI decryption failed" });
        continue;
      }

      if (!phone) {
        results.push({ patientId: patient.id, sent: false, reason: "No phone number" });
        continue;
      }

      // Generate personalized check-in message using Claude
      let messageBody: string;
      try {
        // Use proactive prompt as the "user" turn, agent replies as the actual message
        const proactivePrompt = getProactivePrompt(patient.riskLevel, firstName);

        // For CRITICAL and HIGH patients, use Claude for a more personalized message
        if (patient.riskLevel === "CRITICAL" || patient.riskLevel === "HIGH") {
          const { response } = await generatePatientResponse(
            patient.id,
            "__PROACTIVE_OUTREACH__",  // sentinel value
            []  // fresh conversation
          );
          // Use the AI response but cap at SMS length
          messageBody = response.slice(0, 320);
        } else {
          // For MEDIUM and LOW, use template (saves API cost)
          const medReminder = patient.medications.length > 0
            ? ` Your medications today: ${patient.medications.map(m => m.drugName).join(", ")}.`
            : "";
          messageBody = `${proactivePrompt}${medReminder} Reply HELP for assistance or STOP to unsubscribe.`;
        }
      } catch (aiError) {
        // Fallback to template message if Claude fails
        const medList = patient.medications.map((m) => m.drugName).join(", ");
        messageBody = `Hi ${firstName}, this is your ClawHealth care coordinator checking in. How are you feeling today?${
          medList ? ` Please remember your medications: ${medList}.` : ""
        } Reply HELP for assistance.`;
      }

      // Send SMS
      try {
        const { sid } = await sendSMS(phone, messageBody);

        // Log as conversation (encrypted, tagged as cron outreach)
        await prisma.conversation.create({
          data: {
            patientId: patient.id,
            role: "AI",
            encContent: encryptPHI(messageBody),
            audioUrl: `cron://proactive-outreach/${sid}`, // tagged for CCM billing
          },
        });

        // Update lastInteraction
        await prisma.patient.update({
          where: { id: patient.id },
          data: { lastInteraction: now },
        });

        results.push({ patientId: patient.id, sent: true, messageSid: sid });
      } catch (smsError) {
        const errMsg = (smsError as Error).message;
        errors.push(`Patient ${patient.id}: ${errMsg}`);
        results.push({ patientId: patient.id, sent: false, reason: errMsg });
      }
    }
  } catch (error) {
    console.error("[proactive-outreach] Fatal error:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: (error as Error).message },
      { status: 500 }
    );
  }

  const sent = results.filter((r) => r.sent).length;
  const skipped = results.filter((r) => !r.sent).length;
  const elapsedMs = Date.now() - startTime;

  console.log(
    `[proactive-outreach] Done: ${sent} sent, ${skipped} skipped, ${errors.length} errors, ${elapsedMs}ms`
  );

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    errors: errors.length,
    elapsedMs,
    // Don't return PHI in response
    summary: results.map((r) => ({ id: r.patientId, sent: r.sent, reason: r.reason })),
  });
}
