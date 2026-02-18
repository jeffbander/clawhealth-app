import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI, decryptJSON } from "@/lib/encryption";
import { notFound } from "next/navigation";
import Link from "next/link";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#16a34a",
};

function adherenceColor(rate: number) {
  if (rate >= 80) return "#10b981";
  if (rate >= 60) return "#f59e0b";
  return "#ef4444";
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const patient = await prisma.patient.findFirst({
    where: { id, organizationId: orgId ?? "" },
    include: {
      medications: { where: { active: true }, orderBy: { startDate: "desc" } },
      vitals: {
        where: {
          recordedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { recordedAt: "desc" },
      },
      conversations: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      carePlans: { where: { active: true }, take: 1 },
      alerts: { where: { resolved: false }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!patient) notFound();

  // Audit log — no PHI in details
  const ctx = await getAuditContext(userId, orgId ?? undefined, id);
  await logAudit("READ", "patient", id, ctx, { fields: "detail_view" });

  // Decrypt PHI in memory only — never log
  let firstName = "Patient";
  let lastName = "";
  let conditions: string[] = [];
  try {
    firstName = decryptPHI(patient.encFirstName);
    lastName = decryptPHI(patient.encLastName);
    conditions = decryptJSON<string[]>(patient.encConditions);
  } catch {}

  // Decrypt vitals
  const vitals = patient.vitals.map((v) => {
    let value = "—";
    try { value = decryptPHI(v.encValue); } catch {}
    return { ...v, value };
  });

  // Decrypt conversations
  const conversations = patient.conversations.map((c) => {
    let content = "";
    try { content = decryptPHI(c.encContent); } catch {}
    return { ...c, content };
  });

  // Decrypt alerts
  const alerts = patient.alerts.map((a) => {
    let message = "";
    try { message = decryptPHI(a.encMessage); } catch {}
    return { ...a, message };
  });

  // Decrypt care plan
  let carePlanContent = "";
  if (patient.carePlans[0]) {
    try { carePlanContent = decryptPHI(patient.carePlans[0].encContent); } catch {}
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Back link */}
      <Link
        href="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          color: "#06ABEB",
          textDecoration: "none",
          fontSize: "0.875rem",
          fontWeight: 500,
          marginBottom: "1.25rem",
        }}
      >
        ← Back to Dashboard
      </Link>

      {/* Patient header */}
      <div
        style={{
          background: "white",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          padding: "1.5rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #212070, #06ABEB)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
            fontSize: "1.5rem",
            flexShrink: 0,
          }}
        >
          {firstName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>
            {firstName} {lastName}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.2rem 0.625rem",
                borderRadius: "9999px",
                background: SEVERITY_COLORS[patient.riskLevel]
                  ? `${SEVERITY_COLORS[patient.riskLevel]}20`
                  : "#f1f5f9",
                color: SEVERITY_COLORS[patient.riskLevel] ?? "#64748b",
                border: `1px solid ${SEVERITY_COLORS[patient.riskLevel] ?? "#e2e8f0"}`,
              }}
            >
              Risk: {patient.riskLevel}
            </span>
            {patient.primaryDx && (
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                📋 ICD-10: {patient.primaryDx}
              </span>
            )}
            {conditions.length > 0 && (
              <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                {conditions.join(" · ")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* Medications */}
        <Card title="💊 Medications">
          {patient.medications.length === 0 ? (
            <Empty>No active medications</Empty>
          ) : (
            patient.medications.map((med) => (
              <div
                key={med.id}
                style={{ padding: "0.875rem", borderBottom: "1px solid #f1f5f9" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    {med.drugName}
                  </span>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                    {med.dose} · {med.frequency}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div className="adherence-bar-track" style={{ flex: 1 }}>
                    <div
                      className="adherence-bar-fill"
                      style={{
                        width: `${Math.min(100, med.adherenceRate)}%`,
                        background: adherenceColor(med.adherenceRate),
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: adherenceColor(med.adherenceRate),
                      minWidth: "36px",
                      textAlign: "right",
                    }}
                  >
                    {Math.round(med.adherenceRate)}%
                  </span>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Recent vitals */}
        <Card title="📊 Recent Vitals (7 days)">
          {vitals.length === 0 ? (
            <Empty>No vitals recorded this week</Empty>
          ) : (
            vitals.slice(0, 10).map((v) => (
              <div
                key={v.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.625rem 0.875rem",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                  {v.type.replace(/_/g, " ")}
                </span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    {v.value} {v.unit}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>
                    {timeAgo(v.recordedAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Active Alerts */}
        <Card title="🔔 Active Alerts">
          {alerts.length === 0 ? (
            <Empty>✅ No active alerts</Empty>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: "0.875rem",
                  borderBottom: "1px solid #f1f5f9",
                  borderLeft: `4px solid ${SEVERITY_COLORS[a.severity] ?? "#94a3b8"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                      color: SEVERITY_COLORS[a.severity],
                    }}
                  >
                    {a.severity} — {a.category}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {timeAgo(a.createdAt)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "#475569", lineHeight: 1.5 }}>
                  {a.message}
                </p>
              </div>
            ))
          )}
        </Card>

        {/* Care Plan */}
        <Card title="📋 Active Care Plan">
          {!carePlanContent ? (
            <Empty>No care plan on file</Empty>
          ) : (
            <div
              style={{
                padding: "0.875rem",
                fontSize: "0.875rem",
                color: "#475569",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {carePlanContent}
            </div>
          )}
        </Card>
      </div>

      {/* Conversation history */}
      <div
        style={{
          background: "white",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          marginTop: "1.25rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 600,
            fontSize: "1rem",
            color: "#1e293b",
          }}
        >
          💬 Conversation History (last 20)
        </div>
        {conversations.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            No conversations yet
          </div>
        ) : (
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {conversations.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: "0.875rem 1.25rem",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  gap: "0.75rem",
                  background: c.role === "AI" ? "#f8fafc" : "white",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background:
                      c.role === "AI"
                        ? "linear-gradient(135deg,#06ABEB,#212070)"
                        : c.role === "PHYSICIAN"
                        ? "#212070"
                        : "#e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    color: c.role !== "PATIENT" ? "white" : "#64748b",
                  }}
                >
                  {c.role === "AI" ? "🤖" : c.role === "PHYSICIAN" ? "👨‍⚕️" : "👤"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#1e293b" }}>
                      {c.role === "AI" ? "AI Coordinator" : c.role === "PHYSICIAN" ? "Physician" : firstName}
                    </span>
                    <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.875rem",
                      color: "#475569",
                      lineHeight: 1.5,
                    }}
                  >
                    {c.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "0.75rem",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.875rem 1.25rem",
          borderBottom: "1px solid #e2e8f0",
          fontWeight: 600,
          fontSize: "0.9375rem",
          color: "#1e293b",
        }}
      >
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
      {children}
    </div>
  );
}
