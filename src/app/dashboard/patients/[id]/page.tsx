export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI, decryptJSON } from "@/lib/encryption";
import { getPatientCCMStatus } from "@/lib/ccm-billing";
import { notFound } from "next/navigation";
import Link from "next/link";

// ─── Style helpers ────────────────────────────────────────────────────────────

const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-500",
  HIGH: "border-l-orange-400",
  MEDIUM: "border-l-yellow-400",
  LOW: "border-l-green-500",
};

const SEVERITY_TEXT: Record<string, string> = {
  CRITICAL: "text-red-600",
  HIGH: "text-orange-500",
  MEDIUM: "text-yellow-600",
  LOW: "text-green-600",
};

const RISK_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
  LOW: "bg-green-50 text-green-700 border-green-200",
};

function adherenceBg(rate: number) {
  if (rate >= 80) return "bg-emerald-500";
  if (rate >= 60) return "bg-amber-400";
  return "bg-red-400";
}

function adherenceText(rate: number) {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 60) return "text-amber-600";
  return "text-red-500";
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const [patient, ccmStatus] = await Promise.all([
    prisma.patient.findFirst({
      where: { id, organizationId: orgId ?? "" },
      include: {
        medications: { where: { active: true }, orderBy: { startDate: "desc" } },
        vitals: {
          where: { recordedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          orderBy: { recordedAt: "desc" },
        },
        conversations: { orderBy: { createdAt: "desc" }, take: 20 },
        carePlans: { where: { active: true }, take: 1 },
        alerts: { where: { resolved: false }, orderBy: { createdAt: "desc" } },
      },
    }),
    getPatientCCMStatus(prisma, id).catch(() => null),
  ]);

  if (!patient) notFound();

  const ctx = await getAuditContext(userId, orgId ?? undefined, id);
  await logAudit("READ", "patient", id, ctx, { fields: "detail_view" });

  // Decrypt PHI in memory only
  let firstName = "Patient";
  let lastName = "";
  let conditions: string[] = [];
  try { firstName = decryptPHI(patient.encFirstName); } catch {}
  try { lastName = decryptPHI(patient.encLastName); } catch {}
  try { conditions = decryptJSON<string[]>(patient.encConditions); } catch {}

  const vitals = patient.vitals.map((v) => {
    let value = "—";
    try { value = decryptPHI(v.encValue); } catch {}
    return { ...v, value };
  });

  const conversations = patient.conversations.map((c) => {
    let content = "";
    try { content = decryptPHI(c.encContent); } catch {}
    return { ...c, content };
  });

  const alerts = patient.alerts.map((a) => {
    let message = "";
    try { message = decryptPHI(a.encMessage); } catch {}
    return { ...a, message };
  });

  let carePlanContent = "";
  if (patient.carePlans[0]) {
    try { carePlanContent = decryptPHI(patient.carePlans[0].encContent); } catch {}
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:opacity-80 no-underline"
      >
        ← Back to Dashboard
      </Link>

      {/* Patient header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-5">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
        >
          {initials}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 m-0">
            {firstName} {lastName}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${RISK_BADGE[patient.riskLevel] ?? "bg-gray-100 text-gray-600"}`}>
              {patient.riskLevel} RISK
            </span>
            {patient.primaryDx && (
              <span className="text-sm text-gray-500">ICD-10: {patient.primaryDx}</span>
            )}
            {conditions.slice(0, 3).map((c, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* CCM status pill */}
        {ccmStatus && (
          <div
            className={`text-center px-4 py-2.5 rounded-xl border ${
              ccmStatus.qualifies99490
                ? "bg-emerald-50 border-emerald-200"
                : ccmStatus.totalMinutes >= 10
                ? "bg-amber-50 border-amber-200"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div
              className={`text-2xl font-bold ${
                ccmStatus.qualifies99490
                  ? "text-emerald-700"
                  : ccmStatus.totalMinutes >= 10
                  ? "text-amber-700"
                  : "text-gray-500"
              }`}
            >
              {ccmStatus.totalMinutes}
              <span className="text-sm font-normal ml-0.5">min</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">CCM this month</div>
            {ccmStatus.qualifies99490 ? (
              <div className="text-xs font-semibold text-emerald-600 mt-0.5">✓ 99490</div>
            ) : (
              <div className="text-xs text-gray-400 mt-0.5">
                {20 - ccmStatus.totalMinutes} min to qualify
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Medications */}
        <SectionCard title="💊 Medications">
          {patient.medications.length === 0 ? (
            <EmptyState>No active medications</EmptyState>
          ) : (
            <div className="divide-y divide-gray-50">
              {patient.medications.map((med) => (
                <div key={med.id} className="p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold text-sm text-gray-900">{med.drugName}</span>
                    <span className="text-xs text-gray-500">{med.dose} · {med.frequency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${adherenceBg(med.adherenceRate)}`}
                        style={{ width: `${Math.min(100, med.adherenceRate)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold min-w-[36px] text-right ${adherenceText(med.adherenceRate)}`}>
                      {Math.round(med.adherenceRate)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Vitals */}
        <SectionCard title="📊 Recent Vitals (7 days)">
          {vitals.length === 0 ? (
            <EmptyState>No vitals recorded this week</EmptyState>
          ) : (
            <div className="divide-y divide-gray-50">
              {vitals.slice(0, 10).map((v) => (
                <div key={v.id} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-sm text-gray-600">{v.type.replace(/_/g, " ")}</span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {v.value} <span className="font-normal text-gray-400">{v.unit}</span>
                    </div>
                    <div className="text-xs text-gray-400">{timeAgo(v.recordedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Alerts */}
        <SectionCard title="🔔 Active Alerts">
          {alerts.length === 0 ? (
            <EmptyState>✅ No active alerts</EmptyState>
          ) : (
            <div className="divide-y divide-gray-50">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-4 border-l-4 ${SEVERITY_BORDER[a.severity] ?? "border-l-gray-300"}`}
                >
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-bold ${SEVERITY_TEXT[a.severity] ?? "text-gray-500"}`}>
                      {a.severity} — {a.category.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(a.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed m-0">{a.message}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Care plan */}
        <SectionCard title="📋 Active Care Plan">
          {!carePlanContent ? (
            <EmptyState>No care plan on file</EmptyState>
          ) : (
            <div className="p-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {carePlanContent}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Conversation history */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 font-semibold text-gray-900">
          💬 Conversation History
          <span className="ml-2 text-sm font-normal text-gray-400">(last 20)</span>
        </div>
        {conversations.length === 0 ? (
          <EmptyState>No conversations yet</EmptyState>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`flex gap-3 px-5 py-3.5 ${c.role === "AI" ? "bg-gray-50/60" : "bg-white"}`}
              >
                {/* Role avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                    c.role === "AI"
                      ? "text-white"
                      : c.role === "PHYSICIAN"
                      ? "bg-[var(--primary)] text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                  style={
                    c.role === "AI"
                      ? { background: "linear-gradient(135deg,#06ABEB,#212070)" }
                      : {}
                  }
                >
                  {c.role === "AI" ? "🤖" : c.role === "PHYSICIAN" ? "👨‍⚕️" : "👤"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs font-semibold text-gray-800">
                      {c.role === "AI"
                        ? "AI Coordinator"
                        : c.role === "PHYSICIAN"
                        ? "Physician"
                        : firstName}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed m-0">{c.content}</p>
                  {c.audioUrl?.startsWith("cron://") && (
                    <span className="text-xs text-[var(--accent)] mt-1 inline-block">
                      ⚡ Proactive outreach
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900 text-sm">
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-sm text-gray-400">{children}</div>
  );
}
