export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";
import VitalsForm from "../VitalsForm";

const VITAL_LABELS: Record<string, string> = {
  BLOOD_PRESSURE_SYSTOLIC: "BP Systolic",
  BLOOD_PRESSURE_DIASTOLIC: "BP Diastolic",
  HEART_RATE: "Heart Rate",
  WEIGHT: "Weight",
  GLUCOSE: "Blood Glucose",
  OXYGEN_SATURATION: "O₂ Saturation",
  TEMPERATURE: "Temperature",
};

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function VitalsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const patient = await prisma.patient.findFirst({
    where: { clerkUserId: user.id },
    include: {
      vitals: {
        where: { recordedAt: { gte: new Date(Date.now() - 14 * 86400000) } },
        orderBy: { recordedAt: "desc" },
        take: 50,
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
  await logAudit("READ", "vital", patient.id, ctx, { view: "patient_portal" });

  const vitals = patient.vitals.map((v) => {
    let value = "";
    try { value = decryptPHI(v.encValue); } catch {}
    return { ...v, value };
  });

  return (
    <div>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#212070", margin: 0 }}>
          📊 My Vitals
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          Log and track your health measurements
        </p>
      </div>

      {/* Log vitals form */}
      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.25rem", marginBottom: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginTop: 0, marginBottom: "1rem" }}>
          Log Today&apos;s Vitals
        </h2>
        <VitalsForm patientId={patient.id} />
      </div>

      {/* Recent readings */}
      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#374151" }}>
            Recent Readings (14 days)
          </span>
        </div>

        {vitals.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>
            No vitals recorded in the last 14 days. Log your first reading above!
          </div>
        ) : (
          <div>
            {vitals.map((v) => (
              <div
                key={v.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1.25rem",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b" }}>
                    {VITAL_LABELS[v.type] ?? v.type}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>
                    {v.source === "patient_app" ? "📱 Patient App" : v.source === "device" ? "⌚ Device" : v.source}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                    {v.value} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#64748b" }}>{v.unit}</span>
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>
                    {timeAgo(v.recordedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
