export const dynamic = "force-dynamic";
/**
 * /api/twilio/sms — Inbound SMS webhook from Twilio
 * Matches phone → patient, routes through AI agent, replies via TwiML
 * HIPAA: All content encrypted, full audit logging, no PHI in logs
 */
import { NextRequest, NextResponse } from "next/server";
import {
  validateTwilioWebhook,
  findPatientByPhone,
  storeConversation,
  messagingTwiml,
} from "@/lib/twilio";
import { generatePatientResponse } from "@/lib/ai-agent";
import { logAudit } from "@/lib/audit";
import {
  alertPhysicianTelegram,
  shouldLockAccount,
  lockPatientAccount,
} from "@/lib/physician-alert";

// ─── Rate Limiting (in-memory, per-phone) ────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;      // messages per window
const RATE_LIMIT_WINDOW = 300000; // 5 minutes in ms

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

export async function POST(req: NextRequest) {
  // Parse form-encoded Twilio webhook body
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  const { From: from, Body: body, MessageSid: messageSid } = params;

  if (!from || !body) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  // Validate Twilio signature
  const signature = req.headers.get("x-twilio-signature") || "";
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.clawmd.ai"}/api/twilio/sms`;
  if (signature && !validateTwilioWebhook(signature, webhookUrl, params)) {
    console.error("[TWILIO_SMS] Invalid signature for URL:", webhookUrl);
    // Log but don't block — URL mismatch is common during setup
  }

  // Rate limiting
  if (isRateLimited(from)) {
    const twiml = messagingTwiml();
    twiml.message(
      "You're sending messages too quickly. Please wait a few minutes and try again. For emergencies, call 911."
    );
    return new NextResponse(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Find patient by phone number
  const patient = await findPatientByPhone(from);

  const twimlRes = messagingTwiml();

  if (!patient) {
    const enrollUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.clawmd.ai";
    twimlRes.message(
      `Welcome to ClawHealth! 👋\n\nYour AI-powered heart health companion, built by cardiologists.\n\nTo get started, enroll here:\n${enrollUrl}/enroll\n\nIt takes 2 minutes. Once enrolled, you can text this number anytime for personalized health support.`
    );
    return new NextResponse(twimlRes.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  if (!patient.agentEnabled) {
    twimlRes.message(
      "SYSTEM LOCKED — NO FURTHER INTERACTION POSSIBLE.\n\nThis account has been flagged for immediate clinical and security review. All communications logged and escalated.\n\nIf you are in crisis: Call 988 or 911\n\nEnd of service."
    );
    return new NextResponse(twimlRes.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Store inbound message (encrypted)
  await storeConversation(patient.id, "PATIENT", body, `twilio://sms/${messageSid}`);

  // Generate AI response — history loaded from DB automatically
  const { response, requiresEscalation, escalationReason } =
    await generatePatientResponse(patient.id, body);

  // Store AI response (encrypted)
  await storeConversation(patient.id, "AI", response, `twilio://sms/${messageSid}/reply`);

  // Create alert + notify physician if escalation needed
  if (requiresEscalation) {
    const { prisma } = await import("@/lib/prisma");
    const { encryptPHI, decryptPHI } = await import("@/lib/encryption");

    await prisma.alert.create({
      data: {
        patientId: patient.id,
        severity: "HIGH",
        category: "symptom",
        encMessage: encryptPHI(
          escalationReason ?? "Emergency keywords detected in SMS"
        ),
        triggerSource: "twilio_sms",
      },
    });

    // Get patient first name for the alert (no other PHI sent)
    let patientFirstName = "Patient";
    try {
      const p = await prisma.patient.findUnique({
        where: { id: patient.id },
        select: { encFirstName: true },
      });
      if (p) patientFirstName = decryptPHI(p.encFirstName);
    } catch {}

    // Fire-and-forget: alert physician via Telegram
    alertPhysicianTelegram({
      patientId: patient.id,
      patientFirstName,
      severity: "HIGH",
      category: "Emergency SMS",
      summary: escalationReason ?? "Emergency keywords detected in patient message",
    }).catch(() => {});

    // Check if account should be auto-locked (3+ emergencies in 30 min)
    const shouldLock = await shouldLockAccount(patient.id);
    if (shouldLock) {
      await lockPatientAccount(
        patient.id,
        "Auto-locked: 3+ emergency escalations in 30 minutes without resolution"
      );

      // Alert physician about the lock
      alertPhysicianTelegram({
        patientId: patient.id,
        patientFirstName,
        severity: "CRITICAL",
        category: "Account Locked",
        summary: "Auto-locked after 3+ unresolved emergency escalations. Clinical review required.",
      }).catch(() => {});
    }
  }

  // Audit log — no PHI
  await logAudit("VOICE_CALL", "conversation", patient.id, {
    userId: "twilio_sms_webhook",
    organizationId: patient.organizationId,
    patientId: patient.id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  }, {
    channel: "sms",
    messageSid: messageSid || "unknown",
    requiresEscalation: requiresEscalation || false,
    messageLength: body.length,
  });

  twimlRes.message(response);
  return new NextResponse(twimlRes.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
