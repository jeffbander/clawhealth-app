export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { decryptPHI, decryptJSON } from "@/lib/encryption";
import { logAudit, getAuditContext } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

export interface TimelineEvent {
  id: string;
  type: "conversation" | "vital" | "alert" | "medication" | "careplan";
  timestamp: string;
  title: string;
  description: string;
  severity?: string;
  metadata?: Record<string, string | number | boolean>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const before = url.searchParams.get("before");

  const patient = await prisma.patient.findFirst({
    where: { id, organizationId: orgId ?? "" },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const beforeDate = before ? new Date(before) : new Date();

  // Fetch all event types in parallel
  const [conversations, vitals, alerts, medications, carePlans] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        patientId: id,
        createdAt: { lt: beforeDate },
        NOT: { audioUrl: { startsWith: "system://" } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.vital.findMany({
      where: { patientId: id, recordedAt: { lt: beforeDate } },
      orderBy: { recordedAt: "desc" },
      take: limit,
    }),
    prisma.alert.findMany({
      where: { patientId: id, createdAt: { lt: beforeDate } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.medication.findMany({
      where: { patientId: id, startDate: { lt: beforeDate } },
      orderBy: { startDate: "desc" },
      take: limit,
    }),
    prisma.carePlan.findMany({
      where: { patientId: id, createdAt: { lt: beforeDate } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const events: TimelineEvent[] = [];

  // Conversations
  for (const c of conversations) {
    let content = "";
    try { content = decryptPHI(c.encContent); } catch {}
    const isProactive = c.audioUrl?.startsWith("cron://");
    events.push({
      id: c.id,
      type: "conversation",
      timestamp: c.createdAt.toISOString(),
      title: c.role === "PATIENT" ? "Patient Message" : c.role === "PHYSICIAN" ? "Physician Message" : isProactive ? "Proactive Outreach" : "AI Response",
      description: content.length > 300 ? content.slice(0, 300) + "…" : content,
      metadata: { role: c.role, full: content },
    });
  }

  // Vitals
  for (const v of vitals) {
    let value = "";
    try { value = decryptPHI(v.encValue); } catch {}
    events.push({
      id: v.id,
      type: "vital",
      timestamp: v.recordedAt.toISOString(),
      title: `${v.type.replace(/_/g, " ")} Recorded`,
      description: `${value} ${v.unit}`,
      metadata: { vitalType: v.type, source: v.source },
    });
  }

  // Alerts
  for (const a of alerts) {
    let message = "";
    try { message = decryptPHI(a.encMessage); } catch {}
    events.push({
      id: a.id,
      type: "alert",
      timestamp: a.createdAt.toISOString(),
      title: `${a.severity} Alert: ${a.category}`,
      description: message,
      severity: a.severity,
      metadata: { resolved: a.resolved, triggerSource: a.triggerSource },
    });
  }

  // Medications
  for (const m of medications) {
    events.push({
      id: m.id,
      type: "medication",
      timestamp: m.startDate.toISOString(),
      title: `${m.active ? "Started" : "Stopped"}: ${m.drugName}`,
      description: `${m.dose} ${m.frequency} (${m.route}). Adherence: ${Math.round(m.adherenceRate)}%`,
      metadata: { active: m.active, adherence: m.adherenceRate },
    });
  }

  // Care Plans
  for (const cp of carePlans) {
    let content = "";
    try { content = decryptPHI(cp.encContent); } catch {}
    events.push({
      id: cp.id,
      type: "careplan",
      timestamp: cp.createdAt.toISOString(),
      title: `Care Plan ${cp.active ? "Updated" : "Archived"}`,
      description: content.length > 200 ? content.slice(0, 200) + "…" : content,
    });
  }

  // Sort all events chronologically (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Trim to limit
  const trimmed = events.slice(0, limit);

  const ctx = await getAuditContext(userId, orgId ?? undefined, id);
  await logAudit("READ", "timeline", id, ctx, { eventCount: trimmed.length });

  return NextResponse.json({
    events: trimmed,
    hasMore: events.length > limit,
    nextBefore: trimmed.length > 0 ? trimmed[trimmed.length - 1].timestamp : null,
  });
}
