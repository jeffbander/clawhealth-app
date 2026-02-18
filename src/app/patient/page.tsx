export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";
import Link from "next/link";
import VitalsForm from "./VitalsForm";

function isMedDueToday(frequency: string): boolean {
  // Simple heuristic — all medications are "due" unless end date passed
  const f = frequency.toLowerCase();
  return (
    f.includes("daily") ||
    f.includes("every day") ||
    f.includes("qd") ||
    f.includes("bid") ||
    f.includes("tid") ||
    f.includes("qid") ||
    f.includes("twice") ||
    f.includes("three times") ||
    f.includes("four times") ||
    f.includes("morning") ||
    f.includes("evening") ||
    f.includes("night")
  );
}

export default async function PatientHomePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const patient = await prisma.patient.findFirst({
    where: { clerkUserId: user.id },
    include: {
      medications: { where: { active: true } },
      conversations: {
        where: { role: "AI" },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!patient) {
    return (
      <div style={{ textAlign: "center", padding: "3rem" }}>
        <h2 style={{ color: "#212070" }}>Welcome to ClawHealth</h2>
        <p style={{ color: "#64748b" }}>
          Your care team is setting up your account. Please check back shortly.
        </p>
      </div>
    );
  }

  const ctx = await getAuditContext(user.id, patient.organizationId, patient.id);
  await logAudit("READ", "patient_portal", patient.id, ctx, { view: "home" });

  let firstName = "Patient";
  try { firstName = decryptPHI(patient.encFirstName); } catch {}

  const todayMeds = patient.medications.filter((m) => isMedDueToday(m.frequency));

  const recentAiMessages = patient.conversations.map((c) => {
    let content = "";
    try { content = decryptPHI(c.encContent); } catch {}
    return { ...c, content };
  });

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#212070", margin: 0 }}>
          Good day, {firstName} 👋
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          Here&apos;s your health summary for today.
        </p>
      </div>

      {/* Today's Medications */}
      <Section title="💊 Today's Medications">
        {todayMeds.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0 }}>
            No medications scheduled for today.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {todayMeds.map((med) => (
              <div
                key={med.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem",
                  background: "#f8fafc",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#1e293b" }}>
                    {med.drugName}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.125rem" }}>
                    {med.dose} · {med.frequency}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color:
                      med.adherenceRate >= 80
                        ? "#10b981"
                        : med.adherenceRate >= 60
                        ? "#f59e0b"
                        : "#ef4444",
                    background:
                      med.adherenceRate >= 80
                        ? "#f0fdf4"
                        : med.adherenceRate >= 60
                        ? "#fefce8"
                        : "#fef2f2",
                    padding: "0.25rem 0.625rem",
                    borderRadius: "9999px",
                  }}
                >
                  {Math.round(med.adherenceRate)}% adherence
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Vitals form */}
      <Section title="📊 Log Today's Vitals">
        <VitalsForm patientId={patient.id} />
      </Section>

      {/* Recent AI messages */}
      <Section title="🤖 Recent Messages from Your Coordinator">
        {recentAiMessages.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0 }}>
            No messages yet. Start a chat below!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {recentAiMessages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  padding: "0.875rem",
                  background: "#f0f9ff",
                  borderRadius: "0.625rem",
                  border: "1px solid #bae6fd",
                  fontSize: "0.875rem",
                  color: "#0369a1",
                  lineHeight: 1.6,
                }}
              >
                {msg.content.length > 200 ? `${msg.content.slice(0, 200)}…` : msg.content}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Chat CTA */}
      <Link
        href="/patient/chat"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.625rem",
          background: "#DC298D",
          color: "white",
          padding: "1rem",
          borderRadius: "0.75rem",
          textDecoration: "none",
          fontWeight: 700,
          fontSize: "1rem",
          textAlign: "center",
          marginTop: "0.5rem",
        }}
      >
        💬 Chat with Your Health Coordinator
      </Link>

      {/* Emergency Button */}
      <div style={{ marginTop: "1.25rem" }}>
        <div style={{ textAlign: "center", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.625rem", fontWeight: 500 }}>
          EMERGENCY
        </div>
        <a
          href="tel:911"
          className="emergency-btn"
        >
          🚨 Call 911 — Emergency
        </a>
        <div style={{ textAlign: "center", marginTop: "0.625rem", fontSize: "0.75rem", color: "#94a3b8" }}>
          For non-emergency urgent issues, use chat or call{" "}
          <a href="tel:+12125550100" style={{ color: "#06ABEB", textDecoration: "none", fontWeight: 600 }}>
            (212) 555-0100
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "0.75rem",
        border: "1px solid #e2e8f0",
        padding: "1.25rem",
        marginBottom: "1rem",
      }}
    >
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600, color: "#1e293b" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
