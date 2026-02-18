export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";

function adherenceColor(rate: number): string {
  if (rate >= 80) return "#10b981";
  if (rate >= 60) return "#f59e0b";
  return "#ef4444";
}

function adherenceBg(rate: number): string {
  if (rate >= 80) return "#f0fdf4";
  if (rate >= 60) return "#fefce8";
  return "#fef2f2";
}

export default async function MedicationsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const patient = await prisma.patient.findFirst({
    where: { clerkUserId: user.id },
    include: {
      medications: {
        where: { active: true },
        orderBy: { startDate: "desc" },
      },
    },
  });

  if (!patient) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
        <p>No patient record found. Please contact your care team.</p>
      </div>
    );
  }

  const ctx = await getAuditContext(user.id, patient.organizationId, patient.id);
  await logAudit("READ", "medication", patient.id, ctx, { view: "patient_portal" });

  return (
    <div>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#212070", margin: 0 }}>
          💊 My Medications
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          {patient.medications.length} active medication{patient.medications.length !== 1 ? "s" : ""}
        </p>
      </div>

      {patient.medications.length === 0 ? (
        <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "2rem", textAlign: "center", color: "#64748b" }}>
          No active medications on file. Contact your care team if you have questions.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {patient.medications.map((med) => (
            <div
              key={med.id}
              style={{
                background: "white",
                borderRadius: "0.75rem",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.875rem" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                    {med.drugName}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>
                    {med.dose} · {med.route} · {med.frequency}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.25rem 0.625rem",
                    borderRadius: "9999px",
                    background: adherenceBg(med.adherenceRate),
                    color: adherenceColor(med.adherenceRate),
                  }}
                >
                  {Math.round(med.adherenceRate)}%
                </span>
              </div>

              {/* Adherence bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Adherence</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: adherenceColor(med.adherenceRate) }}>
                    {Math.round(med.adherenceRate)}%
                  </span>
                </div>
                <div className="adherence-bar-track">
                  <div
                    className="adherence-bar-fill"
                    style={{
                      width: `${Math.min(100, med.adherenceRate)}%`,
                      background: adherenceColor(med.adherenceRate),
                    }}
                  />
                </div>
              </div>

              {med.lastTaken && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                  Last taken: {new Date(med.lastTaken).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reminder */}
      <div style={{ marginTop: "1.25rem", background: "#e8f7fd", borderRadius: "0.75rem", border: "1px solid #bae6fd", padding: "1rem 1.25rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0369a1", marginBottom: "0.375rem" }}>
          💡 Tip: Medication Adherence
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#0369a1", lineHeight: 1.6 }}>
          Taking your medications as prescribed is one of the most important things you can do for your health.
          If you&apos;re having trouble with a medication, chat with your health coordinator.
        </div>
      </div>
    </div>
  );
}
