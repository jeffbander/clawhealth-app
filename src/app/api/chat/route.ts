export const dynamic = "force-dynamic";
/**
 * /api/chat
 * POST: patient → AI interaction
 * Loads patient context, calls Claude, stores conversation (encrypted),
 * creates HIGH alert if escalation required.
 * HIPAA: auth required, full audit logging, PHI encrypted
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI } from "@/lib/encryption";
import { generatePatientResponse } from "@/lib/ai-agent";
import { z } from "zod";

const ChatSchema = z.object({
  patientId: z.string().min(1),
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { patientId, message, history } = parsed.data;

  // Verify caller has access to this patient
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      OR: [
        { clerkUserId: userId }, // patient accessing their own record
        { physician: { clerkUserId: userId } }, // physician accessing patient
      ],
    },
    select: { id: true, organizationId: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found or access denied" }, { status: 403 });
  }

  const ctx = await getAuditContext(userId, patient.organizationId, patientId);

  // Generate AI response
  const { response, requiresEscalation, escalationReason } =
    await generatePatientResponse(patientId, message, history);

  // Store patient message (encrypted) — NEVER log PHI
  await prisma.conversation.create({
    data: {
      patientId,
      role: "PATIENT",
      encContent: encryptPHI(message),
    },
  });

  // Store AI response (encrypted)
  await prisma.conversation.create({
    data: {
      patientId,
      role: "AI",
      encContent: encryptPHI(response),
      modelVersion: "claude-sonnet-4-5-20250929",
    },
  });

  // Update last interaction timestamp
  await prisma.patient.update({
    where: { id: patientId },
    data: { lastInteraction: new Date() },
  });

  // Create HIGH alert if escalation is needed
  if (requiresEscalation) {
    await prisma.alert.create({
      data: {
        patientId,
        severity: "HIGH",
        category: "symptom",
        encMessage: encryptPHI(escalationReason ?? "AI agent flagged emergency keywords in patient message"),
        triggerSource: "ai_agent",
      },
    });
  }

  await logAudit("CREATE", "conversation", patientId, ctx, {
    requiresEscalation,
    messageLength: message.length,
  });

  return NextResponse.json({ response, requiresEscalation: !!requiresEscalation });
}
