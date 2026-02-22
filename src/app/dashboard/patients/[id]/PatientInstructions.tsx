"use client";
import { useState, useEffect } from "react";

export default function PatientInstructions({ patientId }: { patientId: string }) {
  const [instructions, setInstructions] = useState("");
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/patients/${patientId}/instructions`)
      .then((r) => r.json())
      .then((d) => {
        setInstructions(d.instructions || "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [patientId]);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/patients/${patientId}/instructions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions }),
      });
      setSaved(true);
    } catch {
      alert("Failed to save");
    }
    setSaving(false);
  }

  if (!loaded) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900 text-sm">
          🧠 AI Instructions
        </div>
        <div className="p-4 text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <span className="font-semibold text-gray-900 text-sm">🧠 AI Instructions</span>
        {!saved && (
          <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>
        )}
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-400 m-0">
          Patient-specific context for the AI agent. Overrides general disease templates when they conflict.
          Examples: dietary restrictions, allergies, communication preferences, unique clinical considerations.
        </p>
        <textarea
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Patient keeps kosher — do not recommend non-kosher foods. Allergic to penicillin. Prefers evening check-ins. Lives alone, no caregiver. Speaks primarily Spanish — keep language simple."
          className="w-full h-32 text-sm border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-gray-300"
        />
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saved || saving}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              saved
                ? "bg-gray-100 text-gray-400 cursor-default"
                : "bg-[#212070] text-white hover:bg-[#191860] cursor-pointer"
            }`}
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Instructions"}
          </button>
        </div>
      </div>
    </div>
  );
}
