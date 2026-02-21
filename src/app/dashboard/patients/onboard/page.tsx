"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function OnboardPatientPage() {
  const router = useRouter();
  const [emrText, setEmrText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    patientId?: string;
    parsed?: {
      firstName: string;
      lastName: string;
      conditions: string[];
      medicationCount: number;
      riskLevel: string;
      primaryDx: string;
    };
    error?: string;
  } | null>(null);

  async function handleOnboard() {
    if (!emrText.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/patients/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emrText: emrText.trim(),
          physicianId: "auto", // Server resolves from auth
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to onboard patient");
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setResult({ success: false, error: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:opacity-80 no-underline"
      >
        ← Back to Patients
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          📋 Onboard Patient from EMR
        </h1>
        <p className="text-gray-500 mt-1">
          Paste the patient&apos;s clinical summary, medication list, or any EMR
          text below. AI will extract structured data automatically.
        </p>
      </div>

      {/* EMR paste area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">
            EMR / Clinical Text
          </span>
          <textarea
            value={emrText}
            onChange={(e) => setEmrText(e.target.value)}
            rows={12}
            placeholder={`Paste patient information here. Examples:\n\n• Problem list / diagnoses\n• Medication list\n• Clinical summary / H&P\n• Discharge summary\n• Any combination of the above\n\nThe AI will extract: name, DOB, conditions, medications, risk level, and generate a clinical summary.`}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent font-mono resize-y"
            disabled={loading}
          />
        </label>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {emrText.length > 0
              ? `${emrText.length} characters · ~${Math.ceil(emrText.split(/\s+/).length)} words`
              : "Waiting for input..."}
          </span>
          <button
            onClick={handleOnboard}
            disabled={loading || !emrText.trim()}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #212070, #06ABEB)",
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Parsing EMR...
              </span>
            ) : (
              "🧠 Parse & Onboard"
            )}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl border p-5 ${
            result.success
              ? "bg-emerald-50 border-emerald-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          {result.success && result.parsed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <h2 className="text-lg font-bold text-emerald-800">
                  Patient Onboarded Successfully
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-emerald-600 font-medium">Name:</span>{" "}
                  <span className="text-gray-800">
                    {result.parsed.firstName} {result.parsed.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-600 font-medium">
                    Risk Level:
                  </span>{" "}
                  <span
                    className={`font-semibold ${
                      result.parsed.riskLevel === "CRITICAL"
                        ? "text-red-600"
                        : result.parsed.riskLevel === "HIGH"
                        ? "text-orange-600"
                        : result.parsed.riskLevel === "MEDIUM"
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {result.parsed.riskLevel}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-600 font-medium">
                    Conditions:
                  </span>{" "}
                  <span className="text-gray-800">
                    {result.parsed.conditions.join(", ")}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-600 font-medium">
                    Medications:
                  </span>{" "}
                  <span className="text-gray-800">
                    {result.parsed.medicationCount} active
                  </span>
                </div>
                {result.parsed.primaryDx && (
                  <div>
                    <span className="text-emerald-600 font-medium">
                      Primary Dx:
                    </span>{" "}
                    <span className="text-gray-800">
                      {result.parsed.primaryDx}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() =>
                    router.push(
                      `/dashboard/patients/${result.patientId}`
                    )
                  }
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #212070, #06ABEB)",
                  }}
                >
                  View Patient →
                </button>
                <button
                  onClick={() => {
                    setEmrText("");
                    setResult(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
                >
                  Onboard Another
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-red-800 flex items-center gap-2">
                <span>❌</span> Onboarding Failed
              </h2>
              <p className="text-sm text-red-600 mt-1">{result.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">
          💡 Tips for Best Results
        </h3>
        <ul className="text-sm text-blue-700 space-y-1.5">
          <li>
            • Include the <strong>problem list</strong> with diagnoses
          </li>
          <li>
            • Include the <strong>medication list</strong> with doses and
            frequencies
          </li>
          <li>
            • Add <strong>patient demographics</strong> (name, DOB, phone)
          </li>
          <li>
            • Relevant <strong>procedures/surgeries</strong> help with risk
            assessment
          </li>
          <li>
            • <strong>Ejection fraction</strong> and key labs improve care plan
            generation
          </li>
          <li>• You can always add more information later via the patient detail page</li>
        </ul>
      </div>
    </div>
  );
}
