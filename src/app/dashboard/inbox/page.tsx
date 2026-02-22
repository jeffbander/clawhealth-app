"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InboxItem {
  patientId: string;
  patientName: string;
  riskLevel: string;
  primaryDx: string | null;
  agentEnabled: boolean;
  messagePreview: string;
  messageAt: string;
  unread: boolean;
  activeAlertSeverity: string | null;
  messageCount: number;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const RISK_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-400",
  MEDIUM: "bg-amber-400",
  LOW: "bg-emerald-500",
};

const ALERT_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 ring-1 ring-red-500/10",
  HIGH: "bg-orange-100 text-orange-700 ring-1 ring-orange-500/10",
  MEDIUM: "bg-amber-100 text-amber-700 ring-1 ring-amber-500/10",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [error, setError] = useState("");

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/physician/inbox?days=${days}`);
      if (!res.ok) throw new Error("Failed to load inbox");
      const data = await res.json();
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const displayed = filter === "unread" ? items.filter((i) => i.unread) : items;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Inbox</h1>
          <p className="text-sm text-gray-400 mt-1">
            Patients who have messaged in the last {days} days
          </p>
        </div>
        <button
          onClick={fetchInbox}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter + stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setFilter("unread")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              filter === "unread" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            All ({items.length})
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-gray-400">Lookback:</span>
          {[3, 7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                days === d
                  ? "bg-[#212070] text-white"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-300">
          <svg className="w-6 h-6 animate-spin mr-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Loading inbox…
        </div>
      )}

      {!loading && !error && displayed.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <div className="text-5xl mb-4">
            {filter === "unread" ? "✅" : "📭"}
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">
            {filter === "unread" ? "All caught up!" : "No messages"}
          </h3>
          <p className="text-sm text-gray-400">
            {filter === "unread"
              ? "No unread patient messages in the last " + days + " days."
              : "No patient messages in the last " + days + " days."}
          </p>
          {filter === "unread" && items.length > 0 && (
            <button
              onClick={() => setFilter("all")}
              className="mt-4 text-xs text-[#06ABEB] hover:underline"
            >
              View all {items.length} conversations →
            </button>
          )}
        </div>
      )}

      {!loading && !error && displayed.length > 0 && (
        <div className="space-y-2">
          {displayed.map((item) => (
            <Link
              key={item.patientId}
              href={`/dashboard/patients/${item.patientId}`}
              className="no-underline block"
            >
              <div
                className={`bg-white rounded-2xl border transition-all hover:shadow-md hover:border-gray-200 cursor-pointer ${
                  item.unread
                    ? "border-[#06ABEB]/30 shadow-[0_0_0_1px_rgba(6,171,235,0.12)]"
                    : "border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                }`}
              >
                <div className="px-5 py-4 flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm"
                    style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
                  >
                    {item.patientName.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{item.patientName}</span>

                      {/* Risk dot */}
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_DOT[item.riskLevel] ?? "bg-gray-300"}`}
                        title={`${item.riskLevel} risk`}
                      />

                      {/* Unread indicator */}
                      {item.unread && (
                        <span className="text-[0.5625rem] font-bold bg-[#06ABEB] text-white px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}

                      {/* Alert badge */}
                      {item.activeAlertSeverity && item.activeAlertSeverity !== "LOW" && (
                        <span className={`text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-md ${ALERT_BADGE[item.activeAlertSeverity] ?? ""}`}>
                          {item.activeAlertSeverity} ALERT
                        </span>
                      )}

                      {/* AI locked */}
                      {!item.agentEnabled && (
                        <span className="text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                          🔒 LOCKED
                        </span>
                      )}

                      <span className="text-[0.625rem] text-gray-300 ml-auto">
                        {timeAgo(item.messageAt)}
                        {item.messageCount > 1 && (
                          <span className="ml-1 text-gray-300">
                            · {item.messageCount} msg{item.messageCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Message preview */}
                    <p className="text-sm text-gray-500 leading-relaxed m-0 line-clamp-2">
                      {item.messagePreview}
                    </p>

                    {item.primaryDx && (
                      <span className="inline-block mt-1.5 text-[0.5625rem] text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded-md">
                        {item.primaryDx}
                      </span>
                    )}
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-4 h-4 text-gray-200 flex-shrink-0 mt-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Footer hint */}
      {!loading && displayed.length > 0 && (
        <p className="text-center text-xs text-gray-300">
          Click any patient to view their full conversation history and take action
        </p>
      )}
    </div>
  );
}
