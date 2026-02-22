export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";
import Link from "next/link";

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-emerald-500",
};

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 ring-1 ring-red-600/10",
  HIGH: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/10",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
  LOW: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10",
};

const RISK_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 ring-1 ring-red-600/10",
  HIGH: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/10",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
  LOW: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10",
};

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const ctx = await getAuditContext(userId, orgId ?? undefined);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalPatients,
    activeAlerts,
    lowAdherencePatients,
    todayInteractions,
    recentAlerts,
    patients,
  ] = await Promise.all([
    prisma.patient.count({ where: { organizationId: orgId ?? "" } }),
    prisma.alert.count({
      where: {
        resolved: false,
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
      take: 8,
    }),
    prisma.patient.findMany({
      where: { organizationId: orgId ?? "" },
      include: {
        _count: { select: { alerts: { where: { resolved: false } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const sortedAlerts = [...recentAlerts].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 3) -
      (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 3)
  );

  await logAudit("READ", "dashboard", "overview", ctx, {
    patientsCount: totalPatients,
    alertsCount: activeAlerts,
  });

  const kpis = [
    {
      label: "Total Patients",
      value: totalPatients,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      color: "text-[#212070]",
      bg: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
    {
      label: "Active Alerts",
      value: activeAlerts,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      color: activeAlerts > 0 ? "text-red-600" : "text-gray-400",
      bg: activeAlerts > 0 ? "bg-red-50" : "bg-gray-50",
      iconColor: activeAlerts > 0 ? "text-red-500" : "text-gray-400",
    },
    {
      label: "Low Adherence",
      value: lowAdherencePatients,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>
        </svg>
      ),
      color: lowAdherencePatients > 0 ? "text-amber-600" : "text-gray-400",
      bg: lowAdherencePatients > 0 ? "bg-amber-50" : "bg-gray-50",
      iconColor: lowAdherencePatients > 0 ? "text-amber-500" : "text-gray-400",
    },
    {
      label: "Today's Messages",
      value: todayInteractions,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      iconColor: "text-cyan-500",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Patient overview and clinical alerts
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {kpi.label}
              </span>
              <div className={`w-8 h-8 rounded-lg ${kpi.bg} ${kpi.iconColor} flex items-center justify-center`}>
                {kpi.icon}
              </div>
            </div>
            <div className={`text-3xl font-bold tracking-tight ${kpi.color}`}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Alerts + Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-900">Active Alerts</h2>
            <Link
              href="/dashboard/alerts"
              className="text-xs font-medium text-[#06ABEB] hover:text-[#0596d4] no-underline transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {sortedAlerts.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-sm text-gray-400">No active alerts</div>
              </div>
            ) : (
              sortedAlerts.map((alert) => {
                let firstName = "Patient";
                try { firstName = decryptPHI(alert.patient.encFirstName); } catch {}
                return (
                  <Link
                    key={alert.id}
                    href={`/dashboard/patients/${alert.patientId}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors no-underline group"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[alert.severity] ?? "bg-gray-300"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{firstName}</span>
                        <span className={`text-[0.625rem] font-semibold px-1.5 py-0.5 rounded-md ${SEVERITY_BADGE[alert.severity] ?? ""}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {alert.category.replace(/_/g, " ")} · {timeAgo(alert.createdAt)}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Patient Roster */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-900">Patients</h2>
            <Link
              href="/dashboard/patients"
              className="text-xs font-medium text-[#06ABEB] hover:text-[#0596d4] no-underline transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {patients.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-2xl mb-2">👥</div>
                <div className="text-sm text-gray-400">No patients enrolled</div>
                <Link href="/dashboard/patients/onboard" className="text-xs text-[#06ABEB] mt-2 inline-block no-underline">
                  Onboard your first patient →
                </Link>
              </div>
            ) : (
              patients.map((p) => {
                let firstName = "Patient";
                let lastName = "";
                try { firstName = decryptPHI(p.encFirstName); } catch {}
                try { lastName = decryptPHI(p.encLastName); } catch {}
                const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/patients/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors no-underline group"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {firstName} {lastName}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p.primaryDx ?? "—"} · {p.lastInteraction ? timeAgo(p.lastInteraction) : "No messages"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p._count.alerts > 0 && (
                        <span className="text-[0.625rem] font-medium bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md ring-1 ring-red-600/10">
                          {p._count.alerts}
                        </span>
                      )}
                      <span className={`text-[0.625rem] font-semibold px-2 py-0.5 rounded-md ${RISK_BADGE[p.riskLevel] ?? "bg-gray-50 text-gray-500"}`}>
                        {p.riskLevel}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
