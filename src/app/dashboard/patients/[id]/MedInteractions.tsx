"use client";
import { useState, useEffect } from "react";

interface Interaction {
  drug1: string;
  drug2: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  effect: string;
  recommendation: string;
  mechanism?: string;
}

const SEVERITY_STYLE: Record<string, { border: string; bg: string; text: string; badge: string; icon: string }> = {
  CRITICAL: {
    border: "border-l-red-500",
    bg: "bg-red-50/50",
    text: "text-red-700",
    badge: "bg-red-100 text-red-800 ring-1 ring-red-600/10",
    icon: "🚨",
  },
  HIGH: {
    border: "border-l-orange-400",
    bg: "bg-orange-50/50",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-800 ring-1 ring-orange-600/10",
    icon: "⚠️",
  },
  MODERATE: {
    border: "border-l-amber-300",
    bg: "bg-amber-50/30",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-800 ring-1 ring-amber-600/10",
    icon: "💡",
  },
};

export default function MedInteractions({ patientId }: { patientId: string }) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`/api/patients/${patientId}/interactions`)
      .then(r => r.json())
      .then(data => {
        setInteractions(data.interactions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="text-sm text-gray-400">Checking medication interactions...</div>
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">💊 Medication Interactions</span>
        </div>
        <div className="py-8 text-center">
          <span className="text-2xl">✅</span>
          <p className="text-sm text-gray-500 mt-2 m-0">No known interactions detected</p>
        </div>
      </div>
    );
  }

  const critCount = interactions.filter(i => i.severity === "CRITICAL").length;
  const highCount = interactions.filter(i => i.severity === "HIGH").length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">💊 Medication Interactions</span>
          <span className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-full ${
            critCount > 0 ? "bg-red-100 text-red-700" : highCount > 0 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"
          }`}>
            {interactions.length} found
          </span>
        </div>
        {critCount > 0 && (
          <span className="text-xs font-bold text-red-600 animate-pulse">
            🚨 {critCount} CRITICAL
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-50">
        {interactions.map((ix, idx) => {
          const style = SEVERITY_STYLE[ix.severity];
          const isExpanded = expanded.has(idx);

          return (
            <div
              key={idx}
              className={`border-l-4 ${style.border} ${style.bg} transition-colors`}
            >
              <div
                className="px-5 py-3.5 cursor-pointer"
                onClick={() => {
                  const next = new Set(expanded);
                  next.has(idx) ? next.delete(idx) : next.add(idx);
                  setExpanded(next);
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs">{style.icon}</span>
                  <span className={`text-[0.6875rem] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>
                    {ix.severity}
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-gray-900">
                    {ix.drug1} + {ix.drug2}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
                <p className="text-sm text-gray-600 m-0 leading-relaxed">{ix.effect}</p>
              </div>

              {isExpanded && (
                <div className="px-5 pb-4 space-y-2">
                  <div className="bg-white/80 rounded-xl p-3 border border-gray-100">
                    <div className="text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Recommendation
                    </div>
                    <p className="text-sm text-gray-700 m-0 leading-relaxed">{ix.recommendation}</p>
                  </div>
                  {ix.mechanism && (
                    <div className="bg-white/80 rounded-xl p-3 border border-gray-100">
                      <div className="text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Mechanism
                      </div>
                      <p className="text-[0.8125rem] text-gray-500 m-0 italic">{ix.mechanism}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
