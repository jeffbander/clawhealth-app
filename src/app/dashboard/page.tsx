import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";
import Link from "next/link";

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#16a34a",
};
const RISK_BADGE: Record<string, string> = {
  CRITICAL: "badge-critical",
  HIGH: "badge-high",
  MEDIUM: "badge-medium",
  LOW: "badge-low",
};

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const ctx = await getAuditContext(userId, orgId ?? undefined);

  // Fetch all stats in parallel
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
      where: {
        resolved: false,
        patient: { organizationId: orgId ?? "" },
      },
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

  // Sort alerts by severity
  const sortedAlerts = [...recentAlerts].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 3) -
      (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 3)
  );

  // Log audit — no PHI in details
  await logAudit("READ", "dashboard", "overview", ctx, {
    patientsCount: totalPatients,
    alertsCount: criticalHighAlerts,
  });

  const stats = [
    { label: "Total Patients", value: totalPatients, color: "#212070", icon: "👥" },
    { label: "Active Alerts (Critical+High)", value: criticalHighAlerts, color: "#dc2626", icon: "🔔" },
    { label: "Low Medication Adherence", value: lowAdherencePatients, color: "#ea580c", icon: "💊" },
    { label: "Interactions Today", value: todayInteractions, color: "#06ABEB", icon: "💬" },
  ];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#212070", margin: 0 }}>
          Physician Dashboard
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          Mount Sinai West — Cardiology Program
        </p>
      </div>

      {/* Stats cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "white",
              borderRadius: "0.75rem",
              padding: "1.25rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>{s.icon}</span>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 500 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Recent Alerts */}
        <section
          style={{
            background: "white",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#1e293b" }}>
              🔔 Active Alerts
            </h2>
            <Link
              href="/dashboard/alerts"
              style={{ fontSize: "0.8125rem", color: "#06ABEB", textDecoration: "none", fontWeight: 500 }}
            >
              View all →
            </Link>
          </div>
          <div>
            {sortedAlerts.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                ✅ No active alerts
              </div>
            ) : (
              sortedAlerts.map((alert) => {
                // Decrypt first name only for display — no PHI in logs
                let firstName = "Patient";
                try {
                  firstName = decryptPHI(alert.patient.encFirstName);
                } catch {}

                return (
                  <div
                    key={alert.id}
                    style={{
                      padding: "0.875rem 1.25rem",
                      borderBottom: "1px solid #f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: SEVERITY_COLORS[alert.severity] ?? "#64748b",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b" }}>
                        {firstName}
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: SEVERITY_COLORS[alert.severity],
                          }}
                        >
                          [{alert.severity}]
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>
                        {alert.category} · {timeAgo(alert.createdAt)}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/patients/${alert.patientId}`}
                      style={{
                        fontSize: "0.75rem",
                        color: "#06ABEB",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      View
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Patient Roster */}
        <section
          style={{
            background: "white",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#1e293b" }}>
              👥 Patient Roster
            </h2>
            <Link
              href="/dashboard/patients"
              style={{ fontSize: "0.8125rem", color: "#06ABEB", textDecoration: "none", fontWeight: 500 }}
            >
              View all →
            </Link>
          </div>
          <div>
            {patients.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                No patients yet
              </div>
            ) : (
              patients.map((p) => {
                let firstName = "Patient";
                try {
                  firstName = decryptPHI(p.encFirstName);
                } catch {}

                const riskClass = RISK_BADGE[p.riskLevel] ?? "badge-medium";

                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/patients/${p.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.875rem 1.25rem",
                      borderBottom: "1px solid #f1f5f9",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#e8f7fd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "#212070",
                        fontSize: "0.875rem",
                        flexShrink: 0,
                      }}
                    >
                      {firstName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b" }}>
                        {firstName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {p.primaryDx ?? "No DX on file"} ·{" "}
                        {p.lastInteraction
                          ? `Last: ${timeAgo(p.lastInteraction)}`
                          : "No interactions"}
                      </div>
                    </div>
                    <span
                      className={riskClass}
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "9999px",
                      }}
                    >
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
