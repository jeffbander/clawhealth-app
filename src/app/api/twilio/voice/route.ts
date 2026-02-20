export const dynamic = "force-dynamic";
/**
 * /api/twilio/voice — Inbound/outbound voice call webhook from Twilio
 * Uses Gather with speech recognition → AI agent → TwiML Say response
 * HIPAA: All content encrypted, full audit logging, no PHI in logs
 */
import { NextRequest, NextResponse } from "next/server";
import {
  validateTwilioWebhook,
  findPatientByPhone,
  storeConversation,
  twiml,
} from "@/lib/twilio";
import { generatePatientResponse } from "@/lib/ai-agent";
import { logAudit } from "@/lib/audit";

/** Initial call handler — greet and start gathering speech */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  const {
    From: from,
    CallSid: callSid,
    SpeechResult: speechResult,
    CallStatus: callStatus,
  } = params;

  // Validate signature in production
  if (process.env.NODE_ENV === "production") {
    const signature = req.headers.get("x-twilio-signature") || "";
    const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://clawhealth.com"}/api/twilio/voice`;
    if (!validateTwilioWebhook(signature, url, params)) {
      const response = twiml();
      response.say("Authentication failed. Goodbye.");
      response.hangup();
      return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }
  }

  const patient = from ? await findPatientByPhone(from) : null;
  const response = twiml();

  if (!patient) {
    response.say(
      { voice: "Polly.Joanna" },
      "Thank you for calling ClawHealth. We could not identify your account. Please contact your care team directly. Goodbye."
    );
    response.hangup();
    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  if (!patient.agentEnabled) {
    response.say(
      { voice: "Polly.Joanna" },
      "Your AI health coordinator is currently unavailable. Please contact your care team directly. Goodbye."
    );
    response.hangup();
    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // If we have speech input, process it through AI
  if (speechResult) {
    // Store patient speech (encrypted)
    await storeConversation(patient.id, "PATIENT", speechResult, `twilio://voice/${callSid}`);

    // Generate AI response
    const { response: aiResponse, requiresEscalation, escalationReason } =
      await generatePatientResponse(patient.id, speechResult, []);

    // Store AI response (encrypted)
    await storeConversation(patient.id, "AI", aiResponse, `twilio://voice/${callSid}/reply`);

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
            escalationReason ?? "Emergency keywords detected during voice call"
          ),
          triggerSource: "twilio_voice",
        },
      });
    }

    // Audit log
    await logAudit("VOICE_CALL", "conversation", patient.id, {
      userId: "twilio_voice_webhook",
      organizationId: patient.organizationId,
      patientId: patient.id,
    }, {
      channel: "voice",
      callSid: callSid || "unknown",
      requiresEscalation: requiresEscalation || false,
    });

    // Say the AI response, then gather more speech
    response.say({ voice: "Polly.Joanna" }, aiResponse);

    const gather = response.gather({
      input: ["speech"],
      speechTimeout: "auto",
      action: "/api/twilio/voice",
      method: "POST",
    });
    gather.say(
      { voice: "Polly.Joanna" },
      "Is there anything else I can help you with?"
    );

    // If no input, say goodbye
    response.say(
      { voice: "Polly.Joanna" },
      "Thank you for calling ClawHealth. Take care and stay healthy. Goodbye."
    );
    response.hangup();

    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Initial greeting — start gathering speech
  const gather = response.gather({
    input: ["speech"],
    speechTimeout: "auto",
    action: "/api/twilio/voice",
    method: "POST",
  });
  gather.say(
    { voice: "Polly.Joanna" },
    "Hello, this is your ClawHealth AI health coordinator. How can I help you today?"
  );

  // If no input after greeting
  response.say(
    { voice: "Polly.Joanna" },
    "I didn't hear anything. Please call back when you're ready. Goodbye."
  );
  response.hangup();

  // Audit the call start
  await logAudit("VOICE_CALL", "call", patient.id, {
    userId: "twilio_voice_webhook",
    organizationId: patient.organizationId,
    patientId: patient.id,
  }, {
    channel: "voice",
    callSid: callSid || "unknown",
    event: "call_started",
  });

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
