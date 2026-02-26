"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-green-500",
};
const SEVERITY_TEXT: Record<string, string> = {
  CRITICAL: "text-red-600",
  HIGH: "text-orange-600",
  MEDIUM: "text-yellow-600",
  LOW: "text-green-600",
};
const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-500",
  HIGH: "border-l-orange-500",
  MEDIUM: "border-l-yellow-500",
  LOW: "border-l-green-500",
};

interface Alert {
  id: string;
  patientId: string;
  severity: string;
  category: string;
  message: string;
  patientMessage?: string;
  matchedKeywords?: string[];
  firstName: string;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error("Failed to load alerts");
      const data = await res.json();
      const sorted = [...data].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
      );
      setAlerts(sorted);
    } catch {
      setError("Failed to load alerts. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    setResolving(alertId);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      });
      if (!res.ok) throw new Error("Failed to resolve");
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      alert("Failed to resolve alert. Please try again.");
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--primary)]">🔔 Active Alerts</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">All unresolved alerts sorted by severity</p>
      </div>

      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--text-muted)]">
            <div className="animate-pulse">Loading alerts…</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">✅</div>
            <div className="font-semibold text-[var(--text-primary)]">All clear!</div>
            <div className="text-[var(--text-muted)] text-sm mt-1">No active alerts for your patients.</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[100px_1fr_2fr_100px_90px] gap-4 px-5 py-3 bg-[var(--background)] border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              <span>Severity</span>
              <span>Patient</span>
              <span>Alert</span>
              <span>Time</span>
              <span>Action</span>
            </div>

            <div className="divide-y divide-[var(--border-light)]">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`grid grid-cols-[100px_1fr_2fr_100px_90px] gap-4 px-5 py-3.5 items-start border-l-4 ${SEVERITY_BORDER[a.severity] ?? "border-l-gray-300"} hover:bg-[var(--background)] transition-colors duration-150`}
                >
                  {/* Severity */}
                  <span className={`inline-flex items-center gap-1.5 text-[0.8125rem] font-bold ${SEVERITY_TEXT[a.severity] ?? ""}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[a.severity] ?? "bg-gray-400"}`} />
                    {a.severity}
                  </span>

                  {/* Patient — clickable link */}
                  <Link
                    href={`/dashboard/patients/${a.patientId}`}
                    className="font-semibold text-sm text-[var(--primary)] hover:underline no-underline"
                  >
                    {a.firstName}
                  </Link>

                  {/* Alert + patient message + keywords */}
                  <div>
                    <div className="text-[0.8125rem] font-medium text-[var(--text-secondary)] mb-0.5">[{a.category}]</div>
                    <div className="text-[0.8125rem] text-[var(--text-muted)]">{a.message}</div>
                    {a.patientMessage && (
                      <div className="mt-1.5 text-[0.8125rem] text-[var(--text-primary)] bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 italic">
                        &ldquo;{a.patientMessage}&rdquo;
                      </div>
                    )}
                    {a.matchedKeywords && a.matchedKeywords.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {a.matchedKeywords.map((kw) => (
                          <span key={kw} className="text-[0.6875rem] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 ring-1 ring-red-500/10">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Time */}
                  <span className="text-[0.8125rem] text-[var(--text-muted)]">{timeAgo(a.createdAt)}</span>

                  {/* Resolve */}
                  <button
                    onClick={() => handleResolve(a.id)}
                    disabled={resolving === a.id}
                    className={`px-3.5 py-1.5 rounded-lg border-none font-semibold text-[0.8125rem] transition-all duration-200 cursor-pointer ${
                      resolving === a.id
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[var(--primary)] text-white hover:opacity-90"
                    }`}
                  >
                    {resolving === a.id ? "…" : "Resolve"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
