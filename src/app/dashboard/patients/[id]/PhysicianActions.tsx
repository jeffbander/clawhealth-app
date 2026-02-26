"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AlertInfo {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  message: string;
  patientMessage?: string;
  matchedKeywords?: string[];
}

interface Props {
  patientId: string;
  patientName: string;
  hasPhone: boolean;
  alerts: AlertInfo[];
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { dot: string; badge: string; border: string }> = {
  CRITICAL: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-600 ring-1 ring-red-500/10",
    border: "border-l-red-500",
  },
  HIGH: {
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-600 ring-1 ring-orange-500/10",
    border: "border-l-orange-400",
  },
  MEDIUM: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-600 ring-1 ring-amber-500/10",
    border: "border-l-amber-400",
  },
  LOW: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10",
    border: "border-l-emerald-400",
  },
};

// ─── Alert Resolve Component ───────────────────────────────────────────────────

function AlertResolveRow({ alert, onResolved }: { alert: AlertInfo; onResolved: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const styles = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.LOW;

  const handleResolve = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolved: true,
          resolution: resolution.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to resolve");
      setResolved(true);
      onResolved(alert.id);
    } catch (err) {
      setResolveError((err as Error).message || "Failed to resolve. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (resolved) return null;

  return (
    <div className={`border-l-4 ${styles.border} pl-3 py-2.5 pr-3 rounded-r-lg bg-white border border-l-4 border-gray-100 mb-2 last:mb-0`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${styles.dot}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className={`text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-md ${styles.badge}`}>
                {alert.severity}
              </span>
              <span className="text-xs text-gray-400 font-medium">{alert.category.replace(/_/g, " ")}</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed m-0 line-clamp-2">{alert.message}</p>
            {alert.patientMessage && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 mt-1.5 m-0 italic line-clamp-3">
                &ldquo;{alert.patientMessage}&rdquo;
              </p>
            )}
            {alert.matchedKeywords && alert.matchedKeywords.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {alert.matchedKeywords.map((kw) => (
                  <span key={kw} className="text-[0.5625rem] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 ring-1 ring-red-500/10">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap flex-shrink-0 px-2 py-1 rounded-md hover:bg-emerald-50 transition-colors"
        >
          {expanded ? "Cancel" : "Resolve"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-50 space-y-2">
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution note (optional) — e.g. Contacted patient, BP stable after adjustment..."
            className="w-full text-xs border border-gray-200 rounded-lg p-2.5 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 placeholder:text-gray-300"
          />
          {resolveError && (
            <p className="text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">{resolveError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setExpanded(false); setResolveError(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={loading}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Resolving…" : "✓ Mark Resolved"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message Composer ──────────────────────────────────────────────────────────

function MessageComposer({
  patientId,
  patientName,
  hasPhone,
  onSent,
}: {
  patientId: string;
  patientName: string;
  hasPhone: boolean;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sendSms, setSendSms] = useState(hasPhone);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; text: string } | null>(null);

  const charCount = message.length;
  const smsSegments = Math.ceil(charCount / 160);

  const handleSend = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/physician/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, message: message.trim(), sendSms }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to send");

      setResult({
        success: true,
        text: data.smsSent
          ? `✓ Message sent via SMS and logged`
          : `✓ Message logged${!hasPhone ? " (no phone on file)" : " (SMS skipped)"}`,
      });
      setMessage("");
      onSent();
    } catch (err) {
      setResult({ success: false, text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); setResult(null); }}
          placeholder={`Write a message to ${patientName}…`}
          className="w-full text-sm border border-gray-200 rounded-xl p-3.5 h-28 resize-none focus:outline-none focus:ring-2 focus:ring-[#212070]/20 focus:border-[#212070]/40 placeholder:text-gray-300 transition-shadow"
          maxLength={1600}
        />
        <span className="absolute bottom-2.5 right-3 text-[0.5625rem] text-gray-300">
          {charCount}/1600{charCount > 0 && ` · ${smsSegments} SMS segment${smsSegments !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        {hasPhone ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendSms}
              onChange={(e) => setSendSms(e.target.checked)}
              className="rounded text-[#212070] focus:ring-[#212070]"
            />
            <span className="text-xs text-gray-500">Send via SMS</span>
          </label>
        ) : (
          <span className="text-xs text-gray-300">No phone on file — log only</span>
        )}

        <button
          onClick={handleSend}
          disabled={!message.trim() || loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#212070] hover:bg-[#191860] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Sending…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Send Message
            </>
          )}
        </button>
      </div>

      {result && (
        <div className={`text-xs px-3 py-2 rounded-lg ${result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {result.text}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PhysicianActions({ patientId, patientName, hasPhone, alerts: initialAlerts }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeAlerts, setActiveAlerts] = useState(initialAlerts);
  const [activeTab, setActiveTab] = useState<"message" | "alerts">(
    initialAlerts.length > 0 ? "alerts" : "message"
  );

  const handleAlertResolved = (alertId: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
    // Refresh server data so the other alert card updates
    startTransition(() => router.refresh());
  };

  const handleMessageSent = () => {
    startTransition(() => router.refresh());
  };

  const unresolvedCount = activeAlerts.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header with tabs */}
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-4">
        <span className="text-sm font-semibold text-gray-900">Physician Actions</span>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setActiveTab("alerts")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "alerts"
                ? "bg-[#212070] text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            🔔 Resolve Alerts
            {unresolvedCount > 0 && (
              <span className={`text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === "alerts" ? "bg-white/20 text-white" : "bg-red-100 text-red-600"
              }`}>
                {unresolvedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("message")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "message"
                ? "bg-[#212070] text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            ✉️ Message Patient
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Alerts tab */}
        {activeTab === "alerts" && (
          <>
            {activeAlerts.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-sm text-gray-400">All alerts resolved</p>
                <button
                  onClick={() => setActiveTab("message")}
                  className="mt-3 text-xs text-[#06ABEB] hover:underline"
                >
                  Send a message to {patientName} →
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400 mb-3">
                  {unresolvedCount} unresolved alert{unresolvedCount !== 1 ? "s" : ""}
                  {" — "}click <strong>Resolve</strong> to add a clinical note and close.
                </p>
                {activeAlerts.map((alert) => (
                  <AlertResolveRow
                    key={alert.id}
                    alert={alert}
                    onResolved={handleAlertResolved}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Message tab */}
        {activeTab === "message" && (
          <MessageComposer
            patientId={patientId}
            patientName={patientName}
            hasPhone={hasPhone}
            onSent={handleMessageSent}
          />
        )}
      </div>
    </div>
  );
}
