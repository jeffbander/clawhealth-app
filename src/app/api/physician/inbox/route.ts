export const dynamic = "force-dynamic";
/**
 * GET /api/physician/inbox
 *
 * Returns recent patient-initiated messages for the physician's dashboard.
 * Groups by patient, shows most recent message per patient, sorted by recency.
 * Used for the physician inbox — "who replied to me today?"
 *
 * Query params:
 *   days=7    — look back N days (default: 7)
 *   limit=50  — max patients to return
 *
 * HIPAA: auth required, PHI decrypted in-memory only, full audit log
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") ?? "7"), 30);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const ctx = await getAuditContext(userId, orgId ?? undefined);

  // Get all patient-sent messages in the window for this org
  const patientMessages = await prisma.conversation.findMany({
    where: {
      role: "PATIENT",
      createdAt: { gte: since },
      patient: { organizationId: orgId ?? "" },
    },
    include: {
      patient: {
        select: {
          id: true,
          encFirstName: true,
          encLastName: true,
          riskLevel: true,
          primaryDx: true,
          agentEnabled: true,
          alerts: {
            where: { resolved: false },
            select: { severity: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 5, // fetch more so we can deduplicate by patient
  });

  // Get the most recent PHYSICIAN and AI messages per patient (to detect if replied)
  const patientIds = [...new Set(patientMessages.map((m) => m.patientId))];
  const recentPhysicianMessages = await prisma.conversation.findMany({
    where: {
      role: { in: ["PHYSICIAN", "AI"] },
      patientId: { in: patientIds },
      createdAt: { gte: since },
    },
    select: { patientId: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Build: lastPhysicianReply[patientId] = most recent PHYSICIAN message time
  const lastPhysicianReply: Record<string, Date> = {};
  for (const m of recentPhysicianMessages) {
    if (m.role === "PHYSICIAN") {
      if (!lastPhysicianReply[m.patientId] || m.createdAt > lastPhysicianReply[m.patientId]) {
        lastPhysicianReply[m.patientId] = m.createdAt;
      }
    }
  }

  // Deduplicate: one entry per patient (most recent PATIENT message)
  const seen = new Set<string>();
  const inboxItems: Array<{
    patientId: string;
    patientName: string;
    riskLevel: string;
    primaryDx: string | null;
    agentEnabled: boolean;
    messagePreview: string;
    messageAt: string;
    unread: boolean;         // patient sent after last physician reply
    activeAlertSeverity: string | null;
    messageCount: number;    // total messages from patient in window
  }> = [];

  // Count messages per patient
  const messageCountByPatient: Record<string, number> = {};
  for (const m of patientMessages) {
    messageCountByPatient[m.patientId] = (messageCountByPatient[m.patientId] ?? 0) + 1;
  }

  for (const msg of patientMessages) {
    if (seen.has(msg.patientId)) continue;
    seen.add(msg.patientId);
    if (inboxItems.length >= limit) break;

    const p = msg.patient;

    let firstName = "Patient";
    let lastName = "";
    try { firstName = decryptPHI(p.encFirstName); } catch {}
    try { lastName = decryptPHI(p.encLastName); } catch {}

    let content = "";
    try { content = decryptPHI(msg.encContent); } catch {}
    const preview = content.length > 120 ? content.slice(0, 120) + "…" : content;

    // "Unread" = patient messaged AFTER last physician reply (or no physician reply exists)
    const lastReply = lastPhysicianReply[msg.patientId];
    const unread = !lastReply || msg.createdAt > lastReply;

    // Most severe active alert for this patient
    const alertSeverities = p.alerts.map((a) => a.severity);
    const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const topAlert = alertSeverities.sort(
      (a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b)
    )[0] ?? null;

    inboxItems.push({
      patientId: p.id,
      patientName: `${firstName} ${lastName}`.trim(),
      riskLevel: p.riskLevel,
      primaryDx: p.primaryDx,
      agentEnabled: p.agentEnabled,
      messagePreview: preview,
      messageAt: msg.createdAt.toISOString(),
      unread,
      activeAlertSeverity: topAlert,
      messageCount: messageCountByPatient[msg.patientId] ?? 1,
    });
  }

  await logAudit("READ", "inbox", "physician_inbox", ctx, {
    itemCount: inboxItems.length,
    unreadCount: inboxItems.filter((i) => i.unread).length,
    days,
  });

  return NextResponse.json({
    items: inboxItems,
    unreadCount: inboxItems.filter((i) => i.unread).length,
    days,
  });
}
