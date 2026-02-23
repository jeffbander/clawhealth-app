export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptPHI } from "@/lib/encryption";
import { sendSMS } from "@/lib/twilio";
import { getAuditContext, logAudit } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      physician: { clerkUserId: userId },
    },
    select: {
      id: true,
      organizationId: true,
      encPhone: true,
      encFirstName: true,
    },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let phone = "";
  let firstName = "there";
  try {
    phone = patient.encPhone ? decryptPHI(patient.encPhone) : "";
  } catch {}
  try {
    firstName = decryptPHI(patient.encFirstName) || "there";
  } catch {}

  if (!phone.trim()) {
    return NextResponse.json({ error: "No phone number on file" }, { status: 400 });
  }

  const message =
    `Welcome to ClawHealth, ${firstName}! ` +
    "You can text me anytime about medications, symptoms, or health questions. " +
    "Text HELP for assistance or STOP to opt out.";
  const smsResult = await sendSMS(phone, message);

  const ctx = await getAuditContext(userId, patient.organizationId, id);
  await logAudit("UPDATE", "patient", id, ctx, {
    action: "resend_welcome_sms",
    smsStatus: smsResult.status ?? "queued",
  });

  return NextResponse.json({ success: true, sid: smsResult.sid });
}
