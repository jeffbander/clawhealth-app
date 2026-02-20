/**
 * Twilio Client — SMS & Voice for patient communication
 * HIPAA: No PHI in logs. All patient messages encrypted before storage.
 */
import twilio from "twilio";
import { prisma } from "./prisma";
import { decryptPHI, encryptPHI } from "./encryption";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

let _client: twilio.Twilio | null = null;

export function getTwilioClient(): twilio.Twilio {
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required");
  }
  if (!_client) {
    _client = twilio(accountSid, authToken);
  }
  return _client;
}

export function getTwilioPhone(): string {
  if (!twilioPhone) throw new Error("TWILIO_PHONE_NUMBER required");
  return twilioPhone;
}

/** Validate Twilio webhook signature */
export function validateTwilioWebhook(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}

/** Send SMS to a patient */
export async function sendSMS(
  to: string,
  body: string
): Promise<{ sid: string; status: string }> {
  const client = getTwilioClient();
  const message = await client.messages.create({
    to,
    from: getTwilioPhone(),
    body,
  });
  return { sid: message.sid, status: message.status };
}

/** Initiate an outbound voice call */
export async function initiateCall(
  to: string,
  twimlUrl: string
): Promise<{ sid: string; status: string }> {
  const client = getTwilioClient();
  const call = await client.calls.create({
    to,
    from: getTwilioPhone(),
    url: twimlUrl,
  });
  return { sid: call.sid, status: call.status };
}

/** Look up a patient by phone number (decrypts encPhone to match) */
export async function findPatientByPhone(
  phone: string
): Promise<{ id: string; organizationId: string; agentEnabled: boolean } | null> {
  // Normalize phone: strip non-digits
  const normalized = phone.replace(/\D/g, "");

  // We have to scan patients since phone is encrypted
  // In production, consider a phone hash index for performance
  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      encPhone: true,
      organizationId: true,
      agentEnabled: true,
    },
  });

  for (const p of patients) {
    if (!p.encPhone) continue;
    try {
      const decrypted = decryptPHI(p.encPhone).replace(/\D/g, "");
      if (decrypted === normalized || decrypted.endsWith(normalized) || normalized.endsWith(decrypted)) {
        return { id: p.id, organizationId: p.organizationId, agentEnabled: p.agentEnabled };
      }
    } catch {
      // Skip patients with bad encryption data
    }
  }

  return null;
}

/** Store a conversation message (encrypted) */
export async function storeConversation(
  patientId: string,
  role: "PATIENT" | "AI",
  content: string,
  source: string
): Promise<void> {
  await prisma.conversation.create({
    data: {
      patientId,
      role,
      encContent: encryptPHI(content),
      audioUrl: source,
    },
  });
  await prisma.patient.update({
    where: { id: patientId },
    data: { lastInteraction: new Date() },
  });
}

/** Send medication reminder SMS to a patient */
export async function sendMedicationReminder(
  patientId: string
): Promise<{ sent: boolean; error?: string }> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      encPhone: true,
      encFirstName: true,
      medications: { where: { active: true }, select: { drugName: true, dose: true, frequency: true } },
    },
  });

  if (!patient?.encPhone) return { sent: false, error: "No phone number" };

  const phone = decryptPHI(patient.encPhone);
  const firstName = decryptPHI(patient.encFirstName);
  const meds = patient.medications
    .map((m) => `${m.drugName} ${m.dose} (${m.frequency})`)
    .join(", ");

  const body = meds
    ? `Hi ${firstName}, this is your ClawHealth reminder. Please take your medications: ${meds}. Reply TAKEN when done or HELP if you have questions.`
    : `Hi ${firstName}, this is your ClawHealth check-in. How are you feeling today? Reply with any concerns.`;

  const result = await sendSMS(phone, body);
  await storeConversation(patientId, "AI", body, `twilio://sms/${result.sid}`);
  return { sent: true };
}

/** Generate TwiML for voice response */
export function twiml() {
  return new twilio.twiml.VoiceResponse();
}

/** Generate TwiML for messaging response */
export function messagingTwiml() {
  return new twilio.twiml.MessagingResponse();
}
