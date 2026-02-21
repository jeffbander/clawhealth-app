export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { calculateCCMBilling, type CCMPatientMonth } from "@/lib/ccm-billing";
import Link from "next/link";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#10b981",
};

const RISK_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-green-100 text-green-700 border-green-200",
};

function fmt$(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function ProgressBar({
  minutes,
  max = 60,
}: {
  minutes: number;
  max?: number;
}) {
  const pct = Math.min((minutes / max) * 100, 100);
  const color =
    minutes >= 20 ? "#10b981" : minutes >= 10 ? "#f59e0b" : "#e2e8f0";
  return (
    <div
      style={{
        background: "#e2e8f0",
        borderRadius: "9999px",
        height: "6px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "6px",
          background: color,
          borderRadius: "9999px",
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

export default async function AnalyticsPage() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const ctx = await getAuditContext(userId, orgId ?? undefined);

  const [
    totalPatients,
    totalAlerts,
    resolvedAlerts,
    totalConversations,
    alertsBySeverity,
    riskDistribution,
    ccmData,
  ] = await Promise.all([
    prisma.patient.count({ where: { organizationId: orgId ?? "" } }),
    prisma.alert.count({ where: { patient: { organizationId: orgId ?? "" } } }),
    prisma.alert.count({
      where: { resolved: true, patient: { organizationId: orgId ?? "" } },
    }),
    prisma.conversation.count({
      where: { patient: { organizationId: orgId ?? "" } },
    }),
    prisma.alert.groupBy({
      by: ["severity"],
      _count: { severity: true },
      where: { patient: { organizationId: orgId ?? "" } },
    }),
    prisma.patient.groupBy({
      by: ["riskLevel"],
      _count: { riskLevel: true },
      where: { organizationId: orgId ?? "" },
    }),
    calculateCCMBilling(prisma, orgId ?? ""),
  ]);

  await logAudit("READ", "analytics", "population_health_ccm", ctx);

  const resolutionRate =
    totalAlerts > 0 ? Math.round((resolvedAlerts / totalAlerts) * 100) : 0;

  const severityMap: Record<string, number> = {};
  alertsBySeverity.forEach((r) => {
    severityMap[r.severity] = r._count.severity;
  });

  const riskMap: Record<string, number> = {};
  riskDistribution.forEach((r) => {
    riskMap[r.riskLevel] = r._count.riskLevel;
  });

  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--primary)]">
          Population Health &amp; Revenue
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {monthName} · {dayOfMonth}/{daysInMonth} days ({monthProgress}% through month)
        </p>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Enrolled Patients",
            value: totalPatients,
            color: "text-[var(--primary)]",
            bg: "bg-[var(--primary)]/5",
          },
          {
            label: "Qualifying for CCM",
            value: ccmData.qualifyingPatients,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            sub: `${Math.round((ccmData.qualifyingPatients / Math.max(totalPatients, 1)) * 100)}% of roster`,
          },
          {
            label: `${monthName.split(" ")[0]} Revenue`,
            value: fmt$(ccmData.estimatedMonthlyRevenue),
            color: "text-emerald-700",
            bg: "bg-emerald-50",
            sub: "CCM billing est.",
          },
          {
            label: "Annual Run Rate",
            value: fmt$(ccmData.estimatedAnnualRevenue),
            color: "text-[var(--accent)]",
            bg: "bg-[var(--accent)]/5",
            sub: "at current pace",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`${s.bg} rounded-xl p-4 border border-white/40 shadow-sm`}
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-medium">{s.label}</div>
            {s.sub && <div className="text-xs text-[var(--text-muted)]/70 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* CCM Revenue Breakdown */}
      <div
        className="rounded-xl text-white p-6"
        style={{ background: "linear-gradient(135deg, #212070 0%, #06ABEB 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">💰 CCM Billing Status — {monthName}</h2>
            <p className="text-sm text-white/70 mt-0.5">
              CMS chronic care management · CPT 99490/99439/99491
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{fmt$(ccmData.estimatedMonthlyRevenue)}</div>
            <div className="text-sm text-white/70">est. this month</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "99490 (20 min)",
              count: ccmData.qualifyingPatients,
              rate: "$64/pt",
              revenue: ccmData.qualifyingPatients * 64,
            },
            {
              label: "Nearly qualifying",
              count: ccmData.nearlyQualifying.length,
              rate: "10–19 min",
              revenue: 0,
              sub: "1 contact away",
            },
            {
              label: "Total CCM minutes",
              count: ccmData.totalMinutes,
              rate: "min logged",
              revenue: 0,
            },
            {
              label: "Potential if fully enrolled",
              count: totalPatients,
              rate: "$64 × patients",
              revenue: totalPatients * 64,
              sub: "at 100% qualification",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white/10 rounded-xl p-3 backdrop-blur-sm"
            >
              <div className="text-xl font-bold">
                {item.revenue > 0 ? fmt$(item.revenue) : item.count.toLocaleString()}
              </div>
              <div className="text-xs text-white/80 mt-0.5 font-medium">{item.label}</div>
              <div className="text-xs text-white/50 mt-0.5">{item.sub ?? item.rate}</div>
            </div>
          ))}
        </div>

        {/* CCM code legend */}
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-3 text-xs text-white/70">
          <div>
            <span className="font-semibold text-white">99490</span> — First 20 min CCM ≈
            $64/patient/month
          </div>
          <div>
            <span className="font-semibold text-white">99439</span> — Each +20 min block ≈
            $47/patient/month
          </div>
          <div>
            <span className="font-semibold text-white">99491</span> — Physician 30 min ≈
            $84/patient/month
          </div>
        </div>
      </div>

      {/* Patient CCM status table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top qualifying patients */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Per-Patient CCM Tracker</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Minutes this month → billing eligibility
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Patient
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Min
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">
                      Progress
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Codes
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Est. $
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ccmData.topPatients.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-gray-400 text-sm"
                      >
                        No patient interaction data this month yet.
                        <br />
                        <span className="text-xs">
                          Proactive outreach cron will populate this daily at 9 AM ET.
                        </span>
                      </td>
                    </tr>
                  )}
                  {ccmData.topPatients.map((p) => (
                    <tr key={p.patientId} className="hover:bg-gray-50">
                      <td className="py-2.5 px-4">
                        <Link
                          href={`/dashboard/patients/${p.patientId}`}
                          className="font-medium text-gray-900 hover:text-[var(--primary)] no-underline"
                        >
                          {p.patientName}
                        </Link>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {p.primaryDx || p.riskLevel}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`font-bold ${
                            p.totalMinutes >= 20
                              ? "text-emerald-600"
                              : p.totalMinutes >= 10
                              ? "text-yellow-600"
                              : "text-gray-500"
                          }`}
                        >
                          {p.totalMinutes}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 w-24">
                        <ProgressBar minutes={p.totalMinutes} />
                        <div className="text-xs text-gray-400 mt-0.5">
                          {p.totalMinutes >= 20 ? "✓ qualifies" : `${20 - p.totalMinutes} min to go`}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {p.billableCodes.length > 0 ? (
                            p.billableCodes.map((code, i) => (
                              <span
                                key={i}
                                className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono"
                              >
                                {code}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-gray-800">
                        {p.estimatedRevenue > 0 ? fmt$(p.estimatedRevenue) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar: nearly qualifying + risk distribution */}
        <div className="space-y-5">
          {/* Nearly qualifying */}
          {ccmData.nearlyQualifying.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-800 text-sm mb-3">
                ⚡ Almost Qualifying ({ccmData.nearlyQualifying.length})
              </h3>
              <p className="text-xs text-amber-700 mb-3">
                10–19 min this month — one more contact qualifies them for 99490
              </p>
              <div className="space-y-2">
                {ccmData.nearlyQualifying.slice(0, 6).map((p) => (
                  <Link
                    key={p.patientId}
                    href={`/dashboard/patients/${p.patientId}`}
                    className="flex items-center justify-between py-1.5 hover:bg-amber-100/50 rounded px-1 no-underline"
                  >
                    <span className="text-sm font-medium text-gray-800">{p.patientName}</span>
                    <span className="text-xs font-bold text-amber-700">
                      {p.totalMinutes} min ({20 - p.totalMinutes} to go)
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Revenue by risk level */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Revenue by Risk Level</h3>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
              const data = ccmData.byRiskLevel[level] || {
                count: riskMap[level] ?? 0,
                qualifying: 0,
                revenue: 0,
              };
              return (
                <div key={level} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold" style={{ color: SEVERITY_COLORS[level] }}>
                      {level}
                    </span>
                    <span className="text-gray-500">
                      {data.qualifying}/{data.count} qualifying · {fmt$(data.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${data.count > 0 ? (data.qualifying / data.count) * 100 : 0}%`,
                        background: SEVERITY_COLORS[level],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alert & interaction stats */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">
              Interaction Summary
            </h3>
            {[
              {
                label: "Total interactions",
                value: totalConversations,
                color: "#06ABEB",
              },
              {
                label: "Alerts generated",
                value: totalAlerts,
                color: "#ea580c",
              },
              {
                label: "Alerts resolved",
                value: resolvedAlerts,
                color: "#10b981",
              },
              {
                label: "Resolution rate",
                value: `${resolutionRate}%`,
                color: resolutionRate >= 80 ? "#10b981" : "#f59e0b",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="flex justify-between items-center py-1.5"
              >
                <span className="text-xs text-gray-600">{s.label}</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: s.color }}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {/* Cron status */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 text-sm mb-2">⏱ Automation Schedule</h3>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>🔔 Daily alerts scan</span>
                <span className="font-mono text-gray-500">7:00 AM ET</span>
              </div>
              <div className="flex justify-between">
                <span>💬 Proactive outreach</span>
                <span className="font-mono text-gray-500">9:00 AM ET</span>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 text-gray-500">
                Each outreach = 2 min CCM credit · Each alert = 3 min
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
