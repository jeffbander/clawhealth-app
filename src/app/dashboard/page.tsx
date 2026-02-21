export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";
import Link from "next/link";

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-green-100 text-green-700 border-green-200",
};
const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-green-500",
};
const RISK_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border border-red-200",
  HIGH: "bg-orange-50 text-orange-700 border border-orange-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  LOW: "bg-green-50 text-green-700 border border-green-200",
};

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const STAT_COLORS = [
  "text-[var(--primary)]",
  "text-red-600",
  "text-orange-600",
  "text-[var(--accent)]",
];

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const ctx = await getAuditContext(userId, orgId ?? undefined);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalPatients,
    criticalHighAlerts,
    lowAdherencePatients,
    todayInteractions,
    recentAlerts,
    patients,
  ] = await Promise.all([
    prisma.patient.count({ where: { organizationId: orgId ?? "" } }),
    prisma.alert.count({
      where: {
        resolved: false,
        severity: { in: ["CRITICAL", "HIGH"] },
        patient: { organizationId: orgId ?? "" },
      },
    }),
    prisma.medication.count({
      where: {
        adherenceRate: { lt: 70 },
        active: true,
        patient: { organizationId: orgId ?? "" },
      },
    }),
    prisma.conversation.count({
      where: {
        createdAt: { gte: todayStart },
        patient: { organizationId: orgId ?? "" },
      },
    }),
    prisma.alert.findMany({
      where: { resolved: false, patient: { organizationId: orgId ?? "" } },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.patient.findMany({
      where: { organizationId: orgId ?? "" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const sortedAlerts = [...recentAlerts].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 3) -
      (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 3)
  );

  await logAudit("READ", "dashboard", "overview", ctx, {
    patientsCount: totalPatients,
    alertsCount: criticalHighAlerts,
  });

  const stats = [
    { label: "Total Patients", value: totalPatients, icon: "👥" },
    { label: "Active Alerts", value: criticalHighAlerts, icon: "🔔" },
    { label: "Low Adherence", value: lowAdherencePatients, icon: "💊" },
    { label: "Today's Interactions", value: todayInteractions, icon: "💬" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--primary)]">
          Physician Dashboard
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Mount Sinai West — Cardiology Program
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="bg-[var(--surface)] rounded-xl p-5 border border-[var(--border)] shadow-sm hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl group-hover:scale-110 transition-transform duration-200">{s.icon}</span>
              <span className="text-[0.8125rem] text-[var(--text-muted)] font-medium">{s.label}</span>
            </div>
            <div className={`text-3xl font-bold ${STAT_COLORS[i]}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Alerts + Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <section className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">🔔 Active Alerts</h2>
            <Link href="/dashboard/alerts" className="text-[0.8125rem] text-[var(--accent)] font-medium hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {sortedAlerts.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)]">✅ No active alerts</div>
            ) : (
              sortedAlerts.map((alert) => {
                let firstName = "Patient";
                try { firstName = decryptPHI(alert.patient.encFirstName); } catch {}
                return (
                  <div key={alert.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[var(--background)] transition-colors duration-150">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[alert.severity] ?? "bg-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[var(--text-primary)]">
                        {firstName}
                        <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${SEVERITY_STYLES[alert.severity] ?? ""}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {alert.category} · {timeAgo(alert.createdAt)}
                      </div>
                    </div>
                    <Link href={`/dashboard/patients/${alert.patientId}`} className="text-xs text-[var(--accent)] font-medium hover:underline">
                      View
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Patient Roster */}
        <section className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">👥 Patient Roster</h2>
            <Link href="/dashboard/patients" className="text-[0.8125rem] text-[var(--accent)] font-medium hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {patients.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)]">No patients yet</div>
            ) : (
              patients.map((p) => {
                let firstName = "Patient";
                try { firstName = decryptPHI(p.encFirstName); } catch {}
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/patients/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--background)] transition-colors duration-150 no-underline text-inherit"
                  >
                    <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] flex items-center justify-center font-bold text-[var(--primary)] text-sm flex-shrink-0">
                      {firstName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[var(--text-primary)]">{firstName}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {p.primaryDx ?? "No DX"} · {p.lastInteraction ? `Last: ${timeAgo(p.lastInteraction)}` : "No interactions"}
                      </div>
                    </div>
                    <span className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full ${RISK_STYLES[p.riskLevel] ?? ""}`}>
                      {p.riskLevel}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
