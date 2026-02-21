/**
 * Real-time physician alerting via Telegram
 * Sends CRITICAL/HIGH alerts directly to the attending physician
 * No PHI in the Telegram message — just severity, category, and patient ID
 * Physician checks dashboard for full details
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PHYSICIAN_TELEGRAM_ID = process.env.PHYSICIAN_TELEGRAM_ID;

interface AlertPayload {
  patientId: string;
  patientFirstName: string;
  severity: "HIGH" | "CRITICAL";
  category: string;
  summary: string; // Brief, no PHI — e.g. "Emergency keywords in SMS"
  dashboardUrl?: string;
}

/**
 * Send an alert to the physician's Telegram immediately
 * Fire-and-forget — never blocks patient response
 */
export async function alertPhysicianTelegram(payload: AlertPayload): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !PHYSICIAN_TELEGRAM_ID) {
    console.warn("[PHYSICIAN_ALERT] Telegram not configured — skipping alert");
    return;
  }

  const emoji = payload.severity === "CRITICAL" ? "🚨" : "⚠️";
  const dashboardUrl = payload.dashboardUrl || `https://app.clawmd.ai/dashboard/patients/${payload.patientId}`;

  const message = [
    `${emoji} <b>${payload.severity} ALERT</b> — ClawHealth`,
    ``,
    `<b>Patient:</b> ${payload.patientFirstName}`,
    `<b>Category:</b> ${payload.category}`,
    `<b>Summary:</b> ${payload.summary}`,
    ``,
    `<a href="${dashboardUrl}">View in Dashboard →</a>`,
  ].join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: PHYSICIAN_TELEGRAM_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[PHYSICIAN_ALERT] Telegram send failed:", err);
    }
  } catch (err) {
    console.error("[PHYSICIAN_ALERT] Telegram error:", err);
  }
}

/**
 * Check recent alerts for a patient and determine if account should be locked
 * Returns true if 3+ emergency escalations in the last 30 minutes
 */
export async function shouldLockAccount(patientId: string): Promise<boolean> {
  const { prisma } = await import("./prisma");
  
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const recentAlerts = await prisma.alert.count({
    where: {
      patientId,
      severity: { in: ["HIGH", "CRITICAL"] },
      resolved: false,
      createdAt: { gte: thirtyMinAgo },
    },
  });

  return recentAlerts >= 3;
}

/**
 * Lock a patient account — disables AI agent, creates CRITICAL alert
 */
export async function lockPatientAccount(
  patientId: string,
  reason: string
): Promise<void> {
  const { prisma } = await import("./prisma");
  const { encryptPHI } = await import("./encryption");

  await prisma.patient.update({
    where: { id: patientId },
    data: { agentEnabled: false },
  });

  await prisma.alert.create({
    data: {
      patientId,
      severity: "CRITICAL",
      category: "account_locked",
      encMessage: encryptPHI(reason),
      triggerSource: "auto_lock",
    },
  });
}
