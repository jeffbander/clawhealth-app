export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { decryptPHI } from "@/lib/encryption";
import Link from "next/link";

const RISK_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
  LOW: "bg-green-50 text-green-700 border-green-200",
};
const RISK_STAT: Record<string, string> = {
  CRITICAL: "bg-red-50 border-red-200 text-red-700",
  HIGH: "bg-orange-50 border-orange-200 text-orange-700",
  MEDIUM: "bg-yellow-50 border-yellow-200 text-yellow-700",
  LOW: "bg-green-50 border-green-200 text-green-700",
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

  const riskOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  decrypted.sort((a, b) => riskOrder.indexOf(a.riskLevel) - riskOrder.indexOf(b.riskLevel));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)]">Patient Roster</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{decrypted.length} patients enrolled</p>
        </div>
        <Link
          href="/dashboard/patients/add"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity duration-200 no-underline"
        >
          + Add Patient
        </Link>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {riskOrder.map((level) => {
          const count = decrypted.filter((p) => p.riskLevel === level).length;
          return (
            <div key={level} className={`rounded-xl p-3.5 text-center border ${RISK_STAT[level]}`}>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs font-semibold">{level}</div>
            </div>
          );
        })}
      </div>

      {/* Patient table */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="hidden lg:grid grid-cols-[1fr_100px_140px_80px_90px_70px] gap-4 px-5 py-3 bg-[var(--background)] border-b border-[var(--border)]">
          {["Patient", "Risk", "Primary DX", "Alerts", "Last Visit", ""].map((h) => (
            <div key={h} className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{h}</div>
          ))}
        </div>

        {decrypted.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-muted)]">
            <div className="text-4xl mb-2">👥</div>
            <div className="font-semibold mb-1">No patients yet</div>
            <Link href="/dashboard/patients/add" className="text-[var(--accent)] font-medium hover:underline">
              Add your first patient →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {decrypted.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_100px_140px_80px_90px_70px] gap-4 px-5 py-3.5 items-center hover:bg-[var(--background)] transition-colors duration-150"
              >
                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {p.firstName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[var(--text-primary)]">{p.firstName} {p.lastName}</div>
                    <div className="text-xs text-[var(--text-muted)]">{p._count.medications} meds active</div>
                  </div>
                </div>

                {/* Risk */}
                <span className={`inline-block text-[0.6875rem] font-bold px-2.5 py-0.5 rounded-full border ${RISK_STYLES[p.riskLevel] ?? ""}`}>
                  {p.riskLevel}
                </span>

                {/* DX */}
                <div className="text-[0.8125rem] text-[var(--text-secondary)]">{p.primaryDx ?? "—"}</div>

                {/* Alerts */}
                <div>
                  {p._count.alerts > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                      🔔 {p._count.alerts}
                    </span>
                  ) : (
                    <span className="text-green-600 text-[0.8125rem]">✅</span>
                  )}
                </div>

                {/* Last Visit */}
                <div className="text-[0.8125rem] text-[var(--text-muted)]">{timeAgo(p.lastInteraction)}</div>

                {/* Action */}
                <Link
                  href={`/dashboard/patients/${p.id}`}
                  className="inline-block bg-[var(--primary)] text-white px-3 py-1.5 rounded-lg text-xs font-semibold text-center hover:opacity-90 transition-opacity duration-200 no-underline"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
