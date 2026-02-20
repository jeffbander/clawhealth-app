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

  // Validate Twilio signature (skip in development for testing)
  if (process.env.NODE_ENV === "production") {
    const signature = req.headers.get("x-twilio-signature") || "";
    const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://clawhealth.com"}/api/twilio/sms`;
    if (!validateTwilioWebhook(signature, url, params)) {
      console.error("[TWILIO_SMS] Invalid signature");
      return new NextResponse("Invalid signature", { status: 403 });
    }
  }

  // Find patient by phone number
  const patient = await findPatientByPhone(from);

  const twimlRes = messagingTwiml();

  if (!patient) {
    twimlRes.message(
      "Thank you for contacting ClawHealth. We could not find your account. Please contact your care team directly."
    );
    return new NextResponse(twimlRes.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  if (!patient.agentEnabled) {
    twimlRes.message(
      "Your AI health coordinator is currently unavailable. Please contact your care team directly for assistance."
    );
    return new NextResponse(twimlRes.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Store inbound message (encrypted)
  await storeConversation(patient.id, "PATIENT", body, `twilio://sms/${messageSid}`);

  // Generate AI response
  const { response, requiresEscalation, escalationReason } =
    await generatePatientResponse(patient.id, body, []);

  // Store AI response (encrypted)
  await storeConversation(patient.id, "AI", response, `twilio://sms/${messageSid}/reply`);

  // Create alert if escalation needed
  if (requiresEscalation) {
    const { prisma } = await import("@/lib/prisma");
    const { encryptPHI } = await import("@/lib/encryption");
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
