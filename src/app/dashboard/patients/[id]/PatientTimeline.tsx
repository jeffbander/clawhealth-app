"use client";
import { useState, useEffect, useCallback } from "react";

interface TimelineEvent {
  id: string;
  type: "conversation" | "vital" | "alert" | "medication" | "careplan";
  timestamp: string;
  title: string;
  description: string;
  severity?: string;
  metadata?: Record<string, string | number | boolean>;
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  conversation: { color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: "💬", label: "Conversations" },
  vital: { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: "📊", label: "Vitals" },
  alert: { color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: "🔔", label: "Alerts" },
  medication: { color: "text-purple-600", bg: "bg-purple-50 border-purple-200", icon: "💊", label: "Medications" },
  careplan: { color: "text-gray-600", bg: "bg-gray-50 border-gray-200", icon: "📋", label: "Care Plans" },
};

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-emerald-500",
};

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function PatientTimeline({ patientId }: { patientId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchEvents = useCallback(async (before?: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (before) params.set("before", before);
      const res = await fetch(`/api/patients/${patientId}/timeline?${params}`);
      const data = await res.json();
      if (before) {
        setEvents(prev => [...prev, ...data.events]);
      } else {
        setEvents(data.events);
      }
      setHasMore(data.hasMore);
      setNextBefore(data.nextBefore);
    } catch {
      console.error("Failed to load timeline");
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = filter === "all" ? events : events.filter(e => e.type === filter);
  const types = Object.keys(TYPE_CONFIG);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-[0.9375rem] m-0">📅 Patient Timeline</h3>
          <p className="text-xs text-gray-400 mt-0.5 m-0">Unified view of all patient events</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-[#212070] text-white border-[#212070]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                filter === t
                  ? "bg-[#212070] text-white border-[#212070]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading timeline...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">No events found</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[39px] top-0 bottom-0 w-px bg-gray-100" />

          <div className="py-2">
            {filtered.map((event, idx) => {
              const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.careplan;
              const isExpanded = expanded.has(event.id);
              const fullText = event.metadata?.full as string | undefined;
              const hasMore = fullText && fullText.length > 300;

              // Date separator
              const prevDate = idx > 0 ? new Date(filtered[idx - 1].timestamp).toDateString() : null;
              const curDate = new Date(event.timestamp).toDateString();
              const showDateSep = curDate !== prevDate;

              return (
                <div key={event.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 px-6 py-2">
                      <div className="w-5" />
                      <span className="text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-wider">
                        {new Date(event.timestamp).toLocaleDateString("en-US", {
                          weekday: "long", month: "long", day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-4 px-6 py-2 hover:bg-gray-50/50 transition-colors group">
                    {/* Timeline dot */}
                    <div className="relative flex-shrink-0 w-5 flex items-start justify-center pt-1">
                      <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                        event.severity ? SEVERITY_DOT[event.severity] || "bg-gray-400" : 
                        event.type === "conversation" ? "bg-blue-500" :
                        event.type === "vital" ? "bg-emerald-500" :
                        event.type === "alert" ? "bg-orange-500" :
                        event.type === "medication" ? "bg-purple-500" : "bg-gray-400"
                      }`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs">{config.icon}</span>
                        <span className="text-[0.8125rem] font-semibold text-gray-900">{event.title}</span>
                        {event.severity && (
                          <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded ${
                            event.severity === "CRITICAL" ? "bg-red-100 text-red-700" :
                            event.severity === "HIGH" ? "bg-orange-100 text-orange-700" :
                            event.severity === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                            "bg-emerald-100 text-emerald-700"
                          }`}>
                            {event.severity}
                          </span>
                        )}
                        <span className="text-[0.6875rem] text-gray-400 ml-auto flex-shrink-0">
                          {relativeTime(event.timestamp)}
                        </span>
                      </div>
                      <p
                        className={`text-sm text-gray-600 leading-relaxed m-0 ${!isExpanded && hasMore ? "line-clamp-2" : ""}`}
                        onClick={() => hasMore && toggleExpand(event.id)}
                        style={hasMore ? { cursor: "pointer" } : undefined}
                      >
                        {isExpanded && fullText ? fullText : event.description}
                      </p>
                      {hasMore && (
                        <button
                          onClick={() => toggleExpand(event.id)}
                          className="text-xs text-[#06ABEB] mt-1 cursor-pointer bg-transparent border-none p-0 hover:underline"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                      <div className="text-[0.625rem] text-gray-300 mt-1">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="px-6 py-4 border-t border-gray-50 text-center">
              <button
                onClick={() => fetchEvents(nextBefore)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer border-none"
              >
                {loading ? "Loading..." : "Load more events"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
