export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";
import Link from "next/link";

const RISK_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 ring-1 ring-red-600/10",
  HIGH: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/10",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
  LOW: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10",
};

const RISK_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-500",
  HIGH: "border-l-orange-400",
  MEDIUM: "border-l-amber-400",
  LOW: "border-l-emerald-400",
};

const RISK_COUNT_BG: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-emerald-500",
};

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
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
          conversations: true,
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

  const riskOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  decrypted.sort((a, b) => riskOrder.indexOf(a.riskLevel) - riskOrder.indexOf(b.riskLevel));

  const riskCounts = Object.fromEntries(
    riskOrder.map((r) => [r, decrypted.filter((p) => p.riskLevel === r).length])
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Patients</h1>
          <p className="text-sm text-gray-400 mt-0.5">{decrypted.length} enrolled</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/patients/onboard"
            className="inline-flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors no-underline shadow-sm"
          >
            📋 EMR Onboard
          </Link>
          <Link
            href="/dashboard/patients/add"
            className="inline-flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-semibold no-underline shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
          >
            + Add Patient
          </Link>
        </div>
      </div>

      {/* Risk summary pills */}
      <div className="flex gap-2">
        {riskOrder.map((level) => (
          <div
            key={level}
            className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${RISK_COUNT_BG[level]}`} />
            <span className="text-sm font-bold text-gray-900">{riskCounts[level]}</span>
            <span className="text-xs text-gray-400 font-medium">{level}</span>
          </div>
        ))}
      </div>

      {/* Patient list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Table header */}
        <div className="hidden lg:grid grid-cols-[1fr_90px_140px_70px_90px] gap-4 px-5 py-3 bg-gray-50/50 border-b border-gray-100">
          {["Patient", "Risk", "Primary DX", "Alerts", "Last Active"].map((h) => (
            <div key={h} className="text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-wider">
              {h}
            </div>
          ))}
        </div>

        {decrypted.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-4xl mb-3">👥</div>
            <div className="font-semibold text-gray-900 mb-1">No patients yet</div>
            <p className="text-sm text-gray-400 mb-4">Onboard your first patient to get started</p>
            <Link
              href="/dashboard/patients/onboard"
              className="text-sm text-[#06ABEB] font-medium no-underline hover:underline"
            >
              Onboard patient →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {decrypted.map((p) => {
              const initials = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/patients/${p.id}`}
                  className={`grid grid-cols-1 lg:grid-cols-[1fr_90px_140px_70px_90px] gap-2 lg:gap-4 px-5 py-3.5 items-center hover:bg-gray-50/70 transition-all duration-150 no-underline border-l-[3px] ${RISK_BORDER[p.riskLevel] ?? "border-l-gray-200"}`}
                >
                  {/* Name */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {p.firstName} {p.lastName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {p._count.medications} meds · {p._count.conversations} msgs
                      </div>
                    </div>
                  </div>

                  {/* Risk */}
                  <div>
                    <span className={`text-[0.625rem] font-bold px-2 py-0.5 rounded-md ${RISK_BADGE[p.riskLevel] ?? ""}`}>
                      {p.riskLevel}
                    </span>
                  </div>

                  {/* DX */}
                  <div className="text-sm text-gray-500 truncate">{p.primaryDx ?? "—"}</div>

                  {/* Alerts */}
                  <div>
                    {p._count.alerts > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md ring-1 ring-red-600/10">
                        {p._count.alerts}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-500">✓</span>
                    )}
                  </div>

                  {/* Last Active */}
                  <div className="text-xs text-gray-400">{timeAgo(p.lastInteraction)}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
