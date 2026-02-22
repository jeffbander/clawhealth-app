"use client";
import { useState, useEffect } from "react";

interface Template {
  id: string;
  slug: string;
  conditionName: string;
  matchPatterns: string;
  monitoringProtocol: string;
  redFlags: string;
  yellowFlags: string;
  commonQuestions: string;
  medicationGuidance: string;
  conversationStyle: string;
  active: boolean;
}

const FIELDS = [
  { key: "monitoringProtocol", label: "Monitoring Protocol", icon: "📋" },
  { key: "redFlags", label: "Red Flags (911)", icon: "🔴" },
  { key: "yellowFlags", label: "Yellow Flags (Escalate)", icon: "🟡" },
  { key: "commonQuestions", label: "Common Patient Questions", icon: "❓" },
  { key: "medicationGuidance", label: "Medication Guidance", icon: "💊" },
  { key: "conversationStyle", label: "Conversation Style", icon: "💬" },
] as const;

export default function ConditionTemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/condition-templates")
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function selectTemplate(id: string) {
    const t = templates.find((t) => t.id === id);
    if (t) {
      setSelected(id);
      setEditing({ ...t });
    }
  }

  async function save() {
    if (!editing || !selected) return;
    setSaving(true);
    try {
      let matchPatterns = editing.matchPatterns;
      // If it's a string, try to parse as JSON array; if not, keep as-is
      try {
        if (typeof matchPatterns === "string") JSON.parse(matchPatterns);
      } catch {
        matchPatterns = JSON.stringify(
          matchPatterns.split(",").map((s: string) => s.trim().toLowerCase())
        );
      }

      const res = await fetch(`/api/condition-templates/${selected}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditionName: editing.conditionName,
          matchPatterns: JSON.parse(matchPatterns),
          monitoringProtocol: editing.monitoringProtocol,
          redFlags: editing.redFlags,
          yellowFlags: editing.yellowFlags,
          commonQuestions: editing.commonQuestions,
          medicationGuidance: editing.medicationGuidance,
          conversationStyle: editing.conversationStyle,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTemplates((prev) =>
          prev.map((t) => (t.id === selected ? updated.template : t))
        );
      }
    } catch {
      alert("Failed to save");
    }
    setSaving(false);
  }

  if (!loaded) {
    return <div className="text-sm text-gray-400 p-4">Loading templates...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <span className="font-semibold text-sm text-gray-900">
          🧬 Disease-Specific AI Prompts
        </span>
        <p className="text-xs text-gray-400 mt-0.5 m-0">
          System-level templates applied to every patient with the matching condition
        </p>
      </div>

      <div className="flex divide-x divide-gray-100" style={{ minHeight: 400 }}>
        {/* Sidebar — template list */}
        <div className="w-56 flex-shrink-0 divide-y divide-gray-50">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t.id)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer border-none ${
                selected === t.id
                  ? "bg-blue-50 text-blue-800 font-semibold"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.conditionName}
              {!t.active && (
                <span className="ml-1 text-xs text-red-400">(disabled)</span>
              )}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          {!editing ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Select a condition template to edit
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Condition name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Condition Name
                </label>
                <input
                  value={editing.conditionName}
                  onChange={(e) =>
                    setEditing({ ...editing, conditionName: e.target.value })
                  }
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Match patterns */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Match Patterns
                </label>
                <p className="text-xs text-gray-400 m-0 mb-1">
                  Comma-separated terms matched against patient conditions
                </p>
                <input
                  value={(() => {
                    try {
                      const arr = JSON.parse(editing.matchPatterns);
                      return Array.isArray(arr) ? arr.join(", ") : editing.matchPatterns;
                    } catch {
                      return editing.matchPatterns;
                    }
                  })()}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      matchPatterns: JSON.stringify(
                        e.target.value.split(",").map((s) => s.trim().toLowerCase())
                      ),
                    })
                  }
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Clinical fields */}
              {FIELDS.map(({ key, label, icon }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {icon} {label}
                  </label>
                  <textarea
                    value={(editing as unknown as Record<string, string>)[key] || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, [key]: e.target.value })
                    }
                    rows={6}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                </div>
              ))}

              {/* Save button */}
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-[#212070] text-white hover:bg-[#191860] transition-colors cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
