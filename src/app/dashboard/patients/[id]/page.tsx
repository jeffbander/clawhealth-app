export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI, decryptJSON } from "@/lib/encryption";
import { getPatientCCMStatus } from "@/lib/ccm-billing";
import { notFound } from "next/navigation";
import Link from "next/link";
import PatientInstructions from "./PatientInstructions";
import PhysicianActions from "./PhysicianActions";
import PatientTimeline from "./PatientTimeline";
import MedInteractions from "./MedInteractions";

// ─── Style helpers ────────────────────────────────────────────────────────────

const RISK_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 ring-1 ring-red-600/10",
  HIGH: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/10",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
  LOW: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10",
};

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-600 ring-1 ring-red-500/10",
  HIGH: "bg-orange-50 text-orange-600 ring-1 ring-orange-500/10",
  MEDIUM: "bg-amber-50 text-amber-600 ring-1 ring-amber-500/10",
  LOW: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10",
};

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-emerald-500",
};

function adherenceColor(rate: number) {
  if (rate >= 80) return { bar: "bg-emerald-500", text: "text-emerald-600" };
  if (rate >= 60) return { bar: "bg-amber-400", text: "text-amber-600" };
  return { bar: "bg-red-400", text: "text-red-500" };
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
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
        alerts: { where: { resolved: false }, orderBy: [{ severity: "asc" }, { createdAt: "desc" }] },
      },
    }),
    getPatientCCMStatus(prisma, id).catch(() => null),
  ]);

  if (!patient) notFound();

  const ctx = await getAuditContext(userId, orgId ?? undefined, id);
  await logAudit("READ", "patient", id, ctx, { fields: "detail_view" });

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

  const conversations = patient.conversations
    .filter((c) => !c.audioUrl?.startsWith("system://"))
    .map((c) => {
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Back */}
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 no-underline transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        Back to Patients
      </Link>

      {/* Patient Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg"
            style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
          >
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight m-0">
                {firstName} {lastName}
              </h1>
              <span className={`text-[0.6875rem] font-bold px-2.5 py-0.5 rounded-lg ${RISK_BADGE[patient.riskLevel] ?? ""}`}>
                {patient.riskLevel} RISK
              </span>
              {!patient.agentEnabled && (
                <span className="text-[0.6875rem] font-bold px-2.5 py-0.5 rounded-lg bg-gray-100 text-gray-500 ring-1 ring-gray-200">
                  🔒 AI LOCKED
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {patient.primaryDx && (
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                  {patient.primaryDx}
                </span>
              )}
              {conditions.slice(0, 5).map((c, i) => (
                <span key={i} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md ring-1 ring-blue-600/5">
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* CCM Status */}
          {ccmStatus && (
            <div className={`text-center px-5 py-3 rounded-2xl border flex-shrink-0 ${
              ccmStatus.qualifies99490
                ? "bg-emerald-50 border-emerald-200"
                : ccmStatus.totalMinutes >= 10
                ? "bg-amber-50 border-amber-200"
                : "bg-gray-50 border-gray-200"
            }`}>
              <div className={`text-3xl font-bold tracking-tight ${
                ccmStatus.qualifies99490 ? "text-emerald-700" : ccmStatus.totalMinutes >= 10 ? "text-amber-700" : "text-gray-400"
              }`}>
                {ccmStatus.totalMinutes}
                <span className="text-sm font-normal ml-0.5">min</span>
              </div>
              <div className="text-[0.625rem] text-gray-400 mt-0.5 font-medium">CCM THIS MONTH</div>
              {ccmStatus.qualifies99490 ? (
                <div className="text-[0.625rem] font-bold text-emerald-600 mt-0.5">✓ 99490 Qualified</div>
              ) : (
                <div className="text-[0.625rem] text-gray-400 mt-0.5">{20 - ccmStatus.totalMinutes} min to qualify</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Meds + Vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medications */}
        <Card title="Medications" icon="💊" badge={`${patient.medications.length} active`}>
          {patient.medications.length === 0 ? (
            <Empty>No active medications</Empty>
          ) : (
            <div className="divide-y divide-gray-50">
              {patient.medications.map((med) => {
                const { bar, text } = adherenceColor(med.adherenceRate);
                return (
                  <div key={med.id} className="px-5 py-3.5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-900">{med.drugName}</span>
                      <span className="text-xs text-gray-400">{med.dose} · {med.frequency}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(100, med.adherenceRate)}%` }} />
                      </div>
                      <span className={`text-xs font-bold min-w-[32px] text-right ${text}`}>
                        {Math.round(med.adherenceRate)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Vitals */}
        <Card title="Recent Vitals" icon="📊" badge="7 days">
          {vitals.length === 0 ? (
            <Empty>No vitals recorded this week</Empty>
          ) : (
            <div className="divide-y divide-gray-50">
              {vitals.slice(0, 10).map((v) => (
                <div key={v.id} className="flex justify-between items-center px-5 py-2.5">
                  <span className="text-sm text-gray-500">{v.type.replace(/_/g, " ")}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">{v.value}</span>
                    <span className="text-xs text-gray-300 ml-1">{v.unit}</span>
                    <div className="text-[0.625rem] text-gray-300">{timeAgo(v.recordedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Alerts */}
        <Card title="Active Alerts" icon="🔔" badge={alerts.length > 0 ? `${alerts.length} unresolved` : undefined}>
          {alerts.length === 0 ? (
            <Empty>✅ No active alerts</Empty>
          ) : (
            <div className="divide-y divide-gray-50">
              {alerts.map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOT[a.severity] ?? "bg-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded-md ${SEVERITY_BADGE[a.severity] ?? ""}`}>
                        {a.severity}
                      </span>
                      <span className="text-xs text-gray-400">{a.category.replace(/_/g, " ")}</span>
                      <span className="text-[0.625rem] text-gray-300 ml-auto">{timeAgo(a.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed m-0">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Care Plan */}
        <Card title="Care Plan" icon="📝">
          {!carePlanContent ? (
            <Empty>No care plan on file</Empty>
          ) : (
            <div className="px-5 py-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {carePlanContent}
            </div>
          )}
        </Card>
      </div>

      {/* Physician Actions — message patient + resolve alerts */}
      <PhysicianActions
        patientId={id}
        patientName={firstName}
        hasPhone={!!patient.encPhone}
        alerts={alerts.map((a) => ({
          id: a.id,
          severity: a.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
          category: a.category,
          message: a.message,
        }))}
      />

      {/* Drug Interactions */}
      <MedInteractions patientId={id} />

      {/* AI Instructions */}
      <PatientInstructions patientId={id} />

      {/* Patient Timeline */}
      <PatientTimeline patientId={id} />

      {/* Conversation History — Chat Style */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Conversations</span>
            <span className="text-[0.625rem] text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-md">
              last {conversations.length}
            </span>
          </div>
        </div>

        {conversations.length === 0 ? (
          <Empty>No conversations yet</Empty>
        ) : (
          <div className="p-5 space-y-3 max-h-[500px] overflow-y-auto">
            {[...conversations].reverse().map((c) => {
              const isAI = c.role === "AI";
              const isPhysician = c.role === "PHYSICIAN";
              const isProactive = c.audioUrl?.startsWith("cron://");

              return (
                <div
                  key={c.id}
                  className={`flex gap-3 ${isAI || isPhysician ? "" : "flex-row-reverse"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                      isAI
                        ? "text-white shadow-sm"
                        : isPhysician
                        ? "bg-[#212070] text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                    style={isAI ? { background: "linear-gradient(135deg, #06ABEB, #212070)" } : {}}
                  >
                    {isAI ? "🤖" : isPhysician ? "👨‍⚕️" : firstName.charAt(0)}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isAI
                        ? "bg-gray-50 border border-gray-100 rounded-tl-md"
                        : isPhysician
                        ? "bg-indigo-50 border border-indigo-100 rounded-tl-md"
                        : "bg-[#06ABEB]/10 border border-[#06ABEB]/10 rounded-tr-md"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[0.625rem] font-semibold text-gray-500">
                        {isAI ? "AI Coordinator" : isPhysician ? "Physician" : firstName}
                      </span>
                      <span className="text-[0.5625rem] text-gray-300">{timeAgo(c.createdAt)}</span>
                      {isProactive && (
                        <span className="text-[0.5625rem] text-cyan-500 font-medium">⚡ proactive</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed m-0">{c.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

function Card({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        {badge && (
          <span className="text-[0.625rem] text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-md">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-10 text-center text-sm text-gray-300">{children}</div>
  );
}
