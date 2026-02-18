import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";

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
  ]);

  await logAudit("READ", "analytics", "population_health", ctx);

  const resolutionRate =
    totalAlerts > 0 ? Math.round((resolvedAlerts / totalAlerts) * 100) : 0;

  const severityMap: Record<string, number> = {};
  alertsBySeverity.forEach((row) => {
    severityMap[row.severity] = row._count.severity;
  });

  const riskMap: Record<string, number> = {};
  riskDistribution.forEach((row) => {
    riskMap[row.riskLevel] = row._count.riskLevel;
  });

  const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#ca8a04",
    LOW: "#10b981",
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#212070", margin: 0 }}>
          📈 Population Health Analytics
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          Aggregate metrics — no individual PHI displayed
        </p>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "Total Patients", value: totalPatients, color: "#212070" },
          { label: "Total Interactions", value: totalConversations, color: "#06ABEB" },
          { label: "Alerts Generated", value: totalAlerts, color: "#ea580c" },
          { label: "Resolution Rate", value: `${resolutionRate}%`, color: "#10b981" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "white",
              borderRadius: "0.75rem",
              padding: "1.25rem",
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: s.color,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* Alert severity breakdown */}
        <div
          style={{
            background: "white",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginTop: 0 }}>
            Alert Severity Breakdown
          </h2>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => {
            const count = severityMap[sev] ?? 0;
            const pct = totalAlerts > 0 ? (count / totalAlerts) * 100 : 0;
            return (
              <div key={sev} style={{ marginBottom: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: SEVERITY_COLORS[sev] }}>
                    {sev}
                  </span>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                    {count} ({Math.round(pct)}%)
                  </span>
                </div>
                <div
                  style={{
                    background: "#e2e8f0",
                    borderRadius: "9999px",
                    height: "8px",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "8px",
                      borderRadius: "9999px",
                      background: SEVERITY_COLORS[sev],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Risk distribution */}
        <div
          style={{
            background: "white",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginTop: 0 }}>
            Patient Risk Distribution
          </h2>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((risk) => {
            const count = riskMap[risk] ?? 0;
            const pct = totalPatients > 0 ? (count / totalPatients) * 100 : 0;
            return (
              <div key={risk} style={{ marginBottom: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: SEVERITY_COLORS[risk] }}>
                    {risk}
                  </span>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                    {count} patients ({Math.round(pct)}%)
                  </span>
                </div>
                <div
                  style={{
                    background: "#e2e8f0",
                    borderRadius: "9999px",
                    height: "8px",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "8px",
                      borderRadius: "9999px",
                      background: SEVERITY_COLORS[risk],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CCM Revenue estimate */}
      <div
        style={{
          background: "linear-gradient(135deg, #212070, #06ABEB)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginTop: "1.25rem",
          color: "white",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
          💰 CCM Revenue Estimate
        </h2>
        <p style={{ margin: "0.5rem 0 1rem", color: "rgba(255,255,255,0.8)", fontSize: "0.875rem" }}>
          Based on CMS chronic care management reimbursements
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {[
            { label: "Patients × $42/mo", value: `$${(totalPatients * 42).toLocaleString()}` },
            { label: "Patients × $86/mo (complex)", value: `$${(totalPatients * 86).toLocaleString()}` },
            { label: "Annual potential", value: `$${(totalPatients * 86 * 12).toLocaleString()}` },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontWeight: 700, fontSize: "1.5rem" }}>{item.value}</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
