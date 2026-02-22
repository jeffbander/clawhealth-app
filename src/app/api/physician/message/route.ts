export const dynamic = "force-dynamic";
/**
 * POST /api/physician/message
 *
 * Physician sends a direct message to a patient.
 * - Creates a PHYSICIAN conversation record (encrypted, audited)
 * - Optionally sends via Twilio SMS if patient has a phone
 * - Updates patient.lastInteraction for CCM tracking
 *
 * HIPAA: auth required, PHI encrypted at rest, full audit log
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { encryptPHI, decryptPHI } from "@/lib/encryption";
import { sendSMS } from "@/lib/twilio";
import { z } from "zod";

const MessageSchema = z.object({
  patientId: z.string().min(1),
  message: z.string().min(1).max(1600).trim(),
  sendSms: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { patientId, message, sendSms } = parsed.data;

  // Verify patient belongs to physician's org
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: orgId ?? "" },
    select: {
      id: true,
      encFirstName: true,
      encLastName: true,
      encPhone: true,
      agentEnabled: true,
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const ctx = await getAuditContext(userId, orgId ?? undefined, patientId);

  let smsSent = false;
  let smsSid: string | null = null;
  let smsError: string | null = null;

  // Send SMS if requested and patient has a phone
  if (sendSms && patient.encPhone) {
    try {
      const phone = decryptPHI(patient.encPhone);
      if (phone) {
        const result = await sendSMS(phone, message);
        smsSent = true;
        smsSid = result.sid;
      }
    } catch (err) {
      smsError = (err as Error).message;
      // Don't fail the whole request if SMS fails — still log the conversation
      console.error("[physician/message] SMS send failed:", smsError);
    }
  }

  // Always create a PHYSICIAN conversation record (encrypted)
  const conversation = await prisma.conversation.create({
    data: {
      patientId,
      role: "PHYSICIAN",
      encContent: encryptPHI(message),
      audioUrl: smsSid ? `twilio://sms/${smsSid}` : "direct",
    },
  });

  // Update lastInteraction for CCM billing tracking
  await prisma.patient.update({
    where: { id: patientId },
    data: { lastInteraction: new Date() },
  });

  // Audit log — no PHI in details, just metadata
  await logAudit("CREATE", "conversation", conversation.id, ctx, {
    role: "PHYSICIAN",
    smsSent,
    hasPhone: !!patient.encPhone,
  });

  return NextResponse.json({
    success: true,
    conversationId: conversation.id,
    smsSent,
    smsError,
    message: smsSent
      ? "Message sent and logged"
      : "Message logged (SMS not sent)",
  });
}
