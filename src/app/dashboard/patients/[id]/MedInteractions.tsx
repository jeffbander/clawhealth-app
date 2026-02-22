"use client";
import { useState, useEffect } from "react";

interface Interaction {
  severity: "critical" | "major" | "moderate";
  drug1: string;
  drug2: string;
  description: string;
  clinicalSignificance: string;
  recommendation: string;
}

const SEVERITY_CONFIG = {
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-800", icon: "🚨", label: "CRITICAL" },
  major: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-800", icon: "⚠️", label: "MAJOR" },
  moderate: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800", icon: "💡", label: "MODERATE" },
};

export default function MedInteractions({ patientId }: { patientId: string }) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`/api/patients/${patientId}/interactions`)
      .then(r => r.json())
      .then(d => {
        setInteractions(d.interactions || []);
        setLoading(true); // done
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 text-[0.9375rem] m-0">⚕️ Drug Interactions</h3>
        <p className="text-sm text-gray-400 mt-2">Checking medications...</p>
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 text-[0.9375rem] m-0">⚕️ Drug Interactions</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            ✓ No known interactions
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-2 m-0">
          Based on active medications. Not a substitute for pharmacist review.
        </p>
      </div>
    );
  }

  const criticalCount = interactions.filter(i => i.severity === "critical").length;
  const majorCount = interactions.filter(i => i.severity === "major").length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 text-[0.9375rem] m-0">⚕️ Drug Interactions</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            criticalCount > 0 ? "bg-red-100 text-red-700" :
            majorCount > 0 ? "bg-orange-100 text-orange-700" :
            "bg-amber-100 text-amber-700"
          }`}>
            {interactions.length} found
          </span>
        </div>
        <p className="text-xs text-gray-400 m-0">
          Physician review recommended
        </p>
      </div>

      <div className="divide-y divide-gray-50">
        {interactions.map((ix, idx) => {
          const config = SEVERITY_CONFIG[ix.severity];
          const isExpanded = expanded.has(idx);

          return (
            <div
              key={idx}
              className={`${config.bg} border-l-4 ${config.border} transition-colors`}
            >
              <button
                onClick={() => {
                  setExpanded(prev => {
                    const next = new Set(prev);
                    next.has(idx) ? next.delete(idx) : next.add(idx);
                    return next;
                  });
                }}
                className="w-full text-left px-5 py-3.5 cursor-pointer bg-transparent border-none"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded ${config.badge}`}>
                    {config.icon} {config.label}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {ix.drug1} + {ix.drug2}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 m-0">{ix.description}</p>
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 space-y-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Clinical Significance</div>
                    <p className="text-sm text-gray-700 m-0">{ix.clinicalSignificance}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Recommendation</div>
                    <p className="text-sm text-gray-700 m-0 font-medium">{ix.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 bg-gray-50/50 text-[0.625rem] text-gray-400 text-center">
        Based on known cardiology drug interactions (ACC/AHA guidelines). Not a substitute for comprehensive pharmacist review.
      </div>
    </div>
  );
}
