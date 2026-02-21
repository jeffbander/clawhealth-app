export const dynamic = "force-dynamic";
/**
 * /api/twilio/status — Delivery status callback for SMS/Voice
 * Tracks message delivery, call completion, errors
 */
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  const {
    MessageSid: messageSid,
    CallSid: callSid,
    MessageStatus: messageStatus,
    CallStatus: callStatus,
    ErrorCode: errorCode,
    ErrorMessage: errorMessage,
  } = params;

  const sid = messageSid || callSid || "unknown";
  const status = messageStatus || callStatus || "unknown";
  const channel = messageSid ? "sms" : "voice";

  // Log status update — no PHI involved
  await logAudit(
    "VOICE_CALL",
    "delivery_status",
    sid,
    {
      userId: "twilio_status_webhook",
    },
    {
      channel,
      status,
      ...(errorCode ? { errorCode } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    }
  );

  if (errorCode) {
    console.error(`[TWILIO_STATUS] ${channel} ${sid} error: ${errorCode} - ${errorMessage}`);
  }

  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
