export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";
import Link from "next/link";

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  HIGH: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  MEDIUM: { bg: "#fefce8", text: "#ca8a04", border: "#fde68a" },
  LOW: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
};

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function PatientsPage() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const ctx = await getAuditContext(userId, orgId ?? undefined);

  const patients = await prisma.patient.findMany({
    where: { organizationId: orgId ?? "" },
    orderBy: [{ riskLevel: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          alerts: { where: { resolved: false } },
          medications: { where: { active: true } },
        },
      },
    },
  });

  await logAudit("READ", "patient", "list", ctx, { count: patients.length });

  const decrypted = patients.map((p) => {
    let firstName = "Patient";
    let lastName = "";
    try { firstName = decryptPHI(p.encFirstName); } catch {}
    try { lastName = decryptPHI(p.encLastName); } catch {}
    return { ...p, firstName, lastName };
  });

  // Sort by risk priority
  const riskOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  decrypted.sort((a, b) => riskOrder.indexOf(a.riskLevel) - riskOrder.indexOf(b.riskLevel));

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#212070", margin: 0 }}>
            Patient Roster
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
            {decrypted.length} patients enrolled
          </p>
        </div>
        <Link
          href="/dashboard/patients/add"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "linear-gradient(135deg, #212070, #06ABEB)",
            color: "white",
            padding: "0.625rem 1.25rem",
            borderRadius: "0.75rem",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          + Add Patient
        </Link>
      </div>

      {/* Summary bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
          const count = decrypted.filter((p) => p.riskLevel === level).length;
          const colors = RISK_COLORS[level] ?? RISK_COLORS.LOW;
          return (
            <div
              key={level}
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: "0.75rem",
                padding: "0.875rem 1rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: colors.text }}>{count}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.text }}>{level}</div>
            </div>
          );
        })}
      </div>

      {/* Patient table */}
      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 150px 100px 100px 80px", gap: "1rem", padding: "0.75rem 1.25rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {["Patient", "Risk Level", "Primary DX", "Alerts", "Last Visit", ""].map((h) => (
            <div key={h} style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {h}
            </div>
          ))}
        </div>

        {decrypted.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👥</div>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No patients yet</div>
            <Link href="/dashboard/patients/add" style={{ color: "#06ABEB", textDecoration: "none", fontWeight: 500 }}>
              Add your first patient →
            </Link>
          </div>
        ) : (
          decrypted.map((p) => {
            const colors = RISK_COLORS[p.riskLevel] ?? RISK_COLORS.MEDIUM;
            return (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 150px 100px 100px 80px",
                  gap: "1rem",
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid #f1f5f9",
                  alignItems: "center",
                }}
              >
                {/* Name */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #212070, #06ABEB)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    flexShrink: 0,
                  }}>
                    {p.firstName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b" }}>
                      {p.firstName} {p.lastName}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {p._count.medications} meds active
                    </div>
                  </div>
                </div>

                {/* Risk */}
                <span style={{
                  display: "inline-block",
                  background: colors.bg,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "9999px",
                  padding: "0.2rem 0.625rem",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                }}>
                  {p.riskLevel}
                </span>

                {/* DX */}
                <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
                  {p.primaryDx ?? "—"}
                </div>

                {/* Alerts */}
                <div>
                  {p._count.alerts > 0 ? (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      background: "#fef2f2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      borderRadius: "9999px",
                      padding: "0.15rem 0.5rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}>
                      🔔 {p._count.alerts}
                    </span>
                  ) : (
                    <span style={{ color: "#10b981", fontSize: "0.8125rem" }}>✅ Clear</span>
                  )}
                </div>

                {/* Last Visit */}
                <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                  {timeAgo(p.lastInteraction)}
                </div>

                {/* Action */}
                <Link
                  href={`/dashboard/patients/${p.id}`}
                  style={{
                    display: "inline-block",
                    background: "#212070",
                    color: "white",
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.5rem",
                    textDecoration: "none",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  View
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
