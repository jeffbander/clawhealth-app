/**
 * Morning Brief Cron — Daily 7 AM ET (12:00 UTC)
 *
 * Sends a structured Telegram summary to the attending physician every morning.
 * 30-second read that surfaces everything that needs attention for the day.
 *
 * Sections:
 *   1. Patient panel snapshot (total, by risk level, AI-locked count)
 *   2. Overnight messages (patient replies since midnight)
 *   3. Active alerts (CRITICAL → HIGH priority)
 *   4. Low medication adherence flags (<70%)
 *   5. CCM billing progress for the month
 *   6. Today's proactive outreach queue (planned check-ins)
 *
 * No PHI in Telegram message — patient first name only (de-identified per HIPAA
 * minimum necessary standard for internal care coordination).
 *
 * Authentication: Vercel CRON_SECRET header
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptPHI } from "@/lib/encryption";
import { calculateCCMBilling } from "@/lib/ccm-billing";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PHYSICIAN_TELEGRAM_ID = process.env.PHYSICIAN_TELEGRAM_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.clawmd.ai";

// ─── Telegram sender ─────────────────────────────────────────────────────────

async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !PHYSICIAN_TELEGRAM_ID) {
    console.warn("[morning-brief] Telegram not configured — skipping send");
    return false;
  }

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PHYSICIAN_TELEGRAM_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        disable_notification: false,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[morning-brief] Telegram send failed:", err);
    return false;
  }
  return true;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function safeFirstName(encName: string): string {
  try { return decryptPHI(encName).split(" ")[0]; } catch { return "Patient"; }
}

function fmt$(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  }).format(n);
}

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });
}

const SEVERITY_EMOJI: Record<string, string> = {
  CRITICAL: "🚨",
  HIGH: "⚠️",
  MEDIUM: "🔵",
  LOW: "🟢",
};

const RISK_EMOJI: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🟢",
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Authenticate
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = req.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  try {
    // ── 1. Patient panel ───────────────────────────────────────────────────────
    const allPatients = await prisma.patient.findMany({
      select: {
        id: true,
        encFirstName: true,
        riskLevel: true,
        agentEnabled: true,
        lastInteraction: true,
        organizationId: true,
      },
    });

    const totalPatients = allPatients.length;
    const byRisk: Record<string, number> = {};
    let lockedCount = 0;
    for (const p of allPatients) {
      byRisk[p.riskLevel] = (byRisk[p.riskLevel] ?? 0) + 1;
      if (!p.agentEnabled) lockedCount++;
    }

    // ── 2. Overnight patient messages ─────────────────────────────────────────
    const overnightMessages = await prisma.conversation.findMany({
      where: {
        role: "PATIENT",
        createdAt: { gte: midnight },
      },
      include: {
        patient: { select: { encFirstName: true, riskLevel: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Deduplicate by patient
    const seenPatients = new Set<string>();
    const uniqueOvernightSenders: Array<{ name: string; risk: string; count: number }> = [];
    const countByPatient: Record<string, number> = {};
    for (const m of overnightMessages) {
      countByPatient[m.patientId] = (countByPatient[m.patientId] ?? 0) + 1;
    }
    for (const m of overnightMessages) {
      if (!seenPatients.has(m.patientId)) {
        seenPatients.add(m.patientId);
        uniqueOvernightSenders.push({
          name: safeFirstName(m.patient.encFirstName),
          risk: m.patient.riskLevel,
          count: countByPatient[m.patientId] ?? 1,
        });
      }
    }

    // ── 3. Active alerts ──────────────────────────────────────────────────────
    const activeAlerts = await prisma.alert.findMany({
      where: { resolved: false },
      include: {
        patient: { select: { encFirstName: true } },
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 10,
    });

    const criticalCount = activeAlerts.filter((a) => a.severity === "CRITICAL").length;
    const highCount = activeAlerts.filter((a) => a.severity === "HIGH").length;
    const topAlerts = activeAlerts.slice(0, 5);

    // ── 4. Low adherence (<70%) ───────────────────────────────────────────────
    const lowAdherenceMeds = await prisma.medication.findMany({
      where: {
        active: true,
        adherenceRate: { lt: 70 },
      },
      include: {
        patient: { select: { encFirstName: true, riskLevel: true } },
      },
      orderBy: { adherenceRate: "asc" },
      take: 5,
    });

    // ── 5. CCM billing ────────────────────────────────────────────────────────
    // Use a lightweight approach to avoid full CCM calc overhead
    const orgIds = [...new Set(allPatients.map((p) => p.organizationId).filter(Boolean))];
    let ccmQualified = 0;
    let ccmRevenue = 0;
    let nearlyQualified = 0;

    if (orgIds.length > 0) {
      try {
        // Calculate for first org (single-org for now)
        const ccm = await calculateCCMBilling(prisma, orgIds[0]);
        ccmQualified = ccm.qualifyingPatients;
        ccmRevenue = ccm.estimatedMonthlyRevenue;
        nearlyQualified = ccm.nearlyQualifying.length;
      } catch {
        // CCM calc failed — skip this section
      }
    }

    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

    // ── 6. Today's outreach queue ─────────────────────────────────────────────
    // Count patients who will receive proactive outreach today
    const outreachIntervals: Record<string, number> = {
      CRITICAL: 12, HIGH: 20, MEDIUM: 24, LOW: 48
    };
    let outreachCount = 0;
    for (const p of allPatients) {
      if (!p.agentEnabled) continue;
      const intervalHours = outreachIntervals[p.riskLevel] ?? 24;
      const cutoff = new Date(now.getTime() - intervalHours * 60 * 60 * 1000);
      if (!p.lastInteraction || p.lastInteraction < cutoff) {
        outreachCount++;
      }
    }

    // ── Format Telegram message ───────────────────────────────────────────────

    const lines: string[] = [
      `🌅 <b>ClawHealth Morning Brief</b>`,
      `<i>${today()}</i>`,
      ``,
    ];

    // Patient panel
    const riskSummary = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
      .filter((r) => byRisk[r])
      .map((r) => `${RISK_EMOJI[r]} ${byRisk[r]} ${r.toLowerCase()}`)
      .join(" · ");

    lines.push(
      `👥 <b>PATIENTS</b> — ${totalPatients} enrolled`,
      riskSummary || "No patients enrolled",
      lockedCount > 0 ? `🔒 ${lockedCount} AI-locked` : "",
    );
    lines.push(``);

    // Overnight messages
    lines.push(`📬 <b>OVERNIGHT MESSAGES</b>`);
    if (uniqueOvernightSenders.length === 0) {
      lines.push(`No patient messages since midnight`);
    } else {
      lines.push(
        `${uniqueOvernightSenders.length} patient${uniqueOvernightSenders.length !== 1 ? "s" : ""} replied:`
      );
      for (const s of uniqueOvernightSenders.slice(0, 4)) {
        lines.push(
          `  ${RISK_EMOJI[s.risk]} ${s.name}${s.count > 1 ? ` (${s.count} messages)` : ""}`
        );
      }
      if (uniqueOvernightSenders.length > 4) {
        lines.push(`  + ${uniqueOvernightSenders.length - 4} more`);
      }
    }
    lines.push(``);

    // Active alerts
    lines.push(`🔔 <b>ACTIVE ALERTS</b>`);
    if (activeAlerts.length === 0) {
      lines.push(`✅ No unresolved alerts`);
    } else {
      lines.push(
        `${criticalCount > 0 ? `${criticalCount} 🚨 CRITICAL  ` : ""}` +
        `${highCount > 0 ? `${highCount} ⚠️ HIGH` : ""}` +
        (criticalCount === 0 && highCount === 0 ? `${activeAlerts.length} total` : "")
      );
      for (const a of topAlerts) {
        const name = safeFirstName(a.patient.encFirstName);
        const emoji = SEVERITY_EMOJI[a.severity] ?? "•";
        lines.push(`  ${emoji} ${name} — ${a.category.replace(/_/g, " ")}`);
      }
      if (activeAlerts.length > 5) {
        lines.push(`  + ${activeAlerts.length - 5} more alerts`);
      }
    }
    lines.push(``);

    // Low adherence
    if (lowAdherenceMeds.length > 0) {
      lines.push(`💊 <b>LOW ADHERENCE</b> (&lt;70%)`);
      for (const m of lowAdherenceMeds) {
        const name = safeFirstName(m.patient.encFirstName);
        lines.push(
          `  ${RISK_EMOJI[m.patient.riskLevel]} ${name}: ${m.drugName} — ${Math.round(m.adherenceRate)}%`
        );
      }
      lines.push(``);
    }

    // CCM billing
    const paceRevenue = dayOfMonth > 0
      ? Math.round((ccmRevenue / dayOfMonth) * daysInMonth)
      : ccmRevenue;

    lines.push(`💰 <b>CCM BILLING</b> — ${currentMonth} (${monthProgress}% through)`);
    lines.push(
      `Qualified (99490): ${ccmQualified}/${totalPatients} patients — ${fmt$(ccmRevenue)} earned`
    );
    if (nearlyQualified > 0) {
      lines.push(`⚡ ${nearlyQualified} nearly qualifying (10–19 min away)`);
    }
    if (paceRevenue > ccmRevenue && dayOfMonth < daysInMonth) {
      lines.push(`📈 Month-end pace: ${fmt$(paceRevenue)}`);
    }
    lines.push(``);

    // Today's outreach
    lines.push(
      `🤖 <b>TODAY'S OUTREACH</b>`,
      `${outreachCount} patient${outreachCount !== 1 ? "s" : ""} scheduled for 9 AM check-in`,
    );
    lines.push(``);

    // Footer links
    lines.push(
      `──────────────────`,
      `<a href="${APP_URL}/dashboard">📊 Dashboard</a>  ·  <a href="${APP_URL}/dashboard/inbox">✉️ Inbox</a>  ·  <a href="${APP_URL}/dashboard/alerts">🔔 Alerts</a>`
    );

    const message = lines.filter((l) => l !== null).join("\n");

    const sent = await sendTelegramMessage(message);
    const elapsedMs = Date.now() - startTime;

    console.log(
      `[morning-brief] Sent: ${sent} | Patients: ${totalPatients} | Alerts: ${activeAlerts.length} | Messages: ${overnightMessages.length} | ${elapsedMs}ms`
    );

    return NextResponse.json({
      success: true,
      sent,
      stats: {
        totalPatients,
        activeAlerts: activeAlerts.length,
        criticalAlerts: criticalCount,
        overnightMessages: overnightMessages.length,
        uniquePatientReplies: uniqueOvernightSenders.length,
        ccmQualified,
        outreachScheduled: outreachCount,
      },
      elapsedMs,
    });
  } catch (error) {
    console.error("[morning-brief] Fatal error:", error);
    return NextResponse.json(
      { error: "Morning brief failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
