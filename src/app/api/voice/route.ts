/**
 * /api/voice — ElevenLabs webhook endpoint
 * Called when a patient speaks to the AI voice agent.
 * NO Clerk auth — webhook verified via secret header instead.
 * HIPAA: PHI encrypted, full audit logging
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { encryptPHI } from "@/lib/encryption";
import { generatePatientResponse } from "@/lib/ai-agent";
import { z } from "zod";

const VoiceWebhookSchema = z.object({
  patientId: z.string().min(1),
  message: z.string().min(1).max(2000),
  sessionId: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  // Verify ElevenLabs webhook secret — no Clerk auth on this route
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[VOICE_WEBHOOK] ELEVENLABS_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!authHeader.includes(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = VoiceWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { patientId, message, sessionId, history } = parsed.data;

  // Load patient record to confirm it exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, organizationId: true, agentEnabled: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  if (!patient.agentEnabled) {
    return NextResponse.json({ response: "I'm sorry, but your AI coordinator is currently unavailable. Please contact your care team directly." });
  }

  // Generate AI response
  const { response, requiresEscalation, escalationReason } =
    await generatePatientResponse(patientId, message, history);

  // Store patient message (encrypted) — NEVER log PHI
  await prisma.conversation.create({
    data: {
      patientId,
      role: "PATIENT",
      encContent: encryptPHI(message),
      audioUrl: `elevenlabs://session/${sessionId}`,
    },
  });

  // Store AI response (encrypted)
  await prisma.conversation.create({
    data: {
      patientId,
      role: "AI",
      encContent: encryptPHI(response),
      audioUrl: `elevenlabs://session/${sessionId}`,
      modelVersion: "claude-sonnet-4-5-20250929",
    },
  });

  // Update last interaction
  await prisma.patient.update({
    where: { id: patientId },
    data: { lastInteraction: new Date() },
  });

  // Create HIGH alert if emergency escalation needed
  if (requiresEscalation) {
    await prisma.alert.create({
      data: {
        patientId,
        severity: "HIGH",
        category: "symptom",
        encMessage: encryptPHI(
          escalationReason ?? "Emergency keywords detected during voice call"
        ),
        triggerSource: "ai_agent",
      },
    });
  }

  // Audit log — no PHI in details
  await logAudit(
    "VOICE_CALL",
    "conversation",
    patientId,
    {
      userId: `elevenlabs_webhook`,
      organizationId: patient.organizationId,
      patientId,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    {
      sessionId,
      requiresEscalation,
      messageLength: message.length,
    }
  );

  return NextResponse.json({ response });
}
