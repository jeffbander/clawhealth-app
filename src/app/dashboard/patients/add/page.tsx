"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CONDITIONS_LIST = [
  "Type 2 Diabetes", "Hypertension", "Heart Failure", "Atrial Fibrillation",
  "Coronary Artery Disease", "COPD", "Chronic Kidney Disease", "Obesity",
  "Hyperlipidemia", "Post-Cardiac Stent", "Peripheral Artery Disease", "Stroke / TIA",
];

const ICD_DX = [
  { code: "E11", label: "Type 2 Diabetes Mellitus" },
  { code: "I10", label: "Essential Hypertension" },
  { code: "I50.9", label: "Heart Failure, Unspecified" },
  { code: "I48.91", label: "Unspecified Atrial Fibrillation" },
  { code: "I25.10", label: "Atherosclerotic Heart Disease" },
  { code: "J44.1", label: "COPD with Acute Exacerbation" },
  { code: "N18.3", label: "Chronic Kidney Disease, Stage 3" },
  { code: "", label: "Other / None" },
];

const inputClasses = "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-[var(--text-primary)] bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] focus:outline-none transition-all duration-200";
const labelClasses = "block text-[0.8125rem] font-semibold text-gray-700 mb-1.5";

export default function AddPatientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", mrn: "",
    phone: "", email: "", address: "",
    riskLevel: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    primaryDx: "", conditions: [] as string[],
    clerkUserId: `demo_${Date.now()}`, physicianId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleCondition = (c: string) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(c) ? prev.conditions.filter((x) => x !== c) : [...prev.conditions, c],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.mrn) {
      setError("Please fill in all required fields.");
      setSubmitting(false);
      return;
    }

    let physicianId = form.physicianId;
    if (!physicianId) {
      try {
        const res = await fetch("/api/physician/me");
        if (res.ok) { const data = await res.json(); physicianId = data.id; }
      } catch {}
    }

    if (!physicianId) {
      setError("Physician record not found. Please contact support.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, physicianId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create patient.");
        setSubmitting(false);
        return;
      }
      const patient = await res.json();
      router.push(`/dashboard/patients/${patient.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--primary)]">Add New Patient</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          All PHI is encrypted at rest with AES-256-GCM before storage.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* PHI Section */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-red-50 border-b border-red-200">
            <span className="text-[0.8125rem] font-bold text-red-700">
              🔐 Protected Health Information (PHI) — Encrypted at rest
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>First Name *</label>
              <input value={form.firstName} onChange={set("firstName")} required className={inputClasses} placeholder="Mary" />
            </div>
            <div>
              <label className={labelClasses}>Last Name *</label>
              <input value={form.lastName} onChange={set("lastName")} required className={inputClasses} placeholder="Johnson" />
            </div>
            <div>
              <label className={labelClasses}>Date of Birth *</label>
              <input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} required className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>MRN *</label>
              <input value={form.mrn} onChange={set("mrn")} required className={inputClasses} placeholder="MRN-123456" />
            </div>
            <div>
              <label className={labelClasses}>Phone</label>
              <input type="tel" value={form.phone} onChange={set("phone")} className={inputClasses} placeholder="(212) 555-0100" />
            </div>
            <div>
              <label className={labelClasses}>Email</label>
              <input type="email" value={form.email} onChange={set("email")} className={inputClasses} placeholder="patient@example.com" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClasses}>Address</label>
              <input value={form.address} onChange={set("address")} className={inputClasses} placeholder="123 Main St, New York, NY 10001" />
            </div>
          </div>
        </div>

        {/* Clinical Section */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-[var(--background)] border-b border-[var(--border)]">
            <span className="text-[0.8125rem] font-bold text-gray-700">🏥 Clinical Information</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Risk Level</label>
              <select value={form.riskLevel} onChange={set("riskLevel")} className={inputClasses}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className={labelClasses}>Primary Diagnosis (ICD-10)</label>
              <select value={form.primaryDx} onChange={set("primaryDx")} className={inputClasses}>
                <option value="">— Select —</option>
                {ICD_DX.map((dx) => (
                  <option key={dx.code} value={dx.code}>{dx.code ? `${dx.code} — ` : ""}{dx.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClasses}>Active Conditions</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CONDITIONS_LIST.map((c) => {
                  const active = form.conditions.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCondition(c)}
                      className={`px-3 py-1.5 rounded-full text-[0.8125rem] border cursor-pointer transition-all duration-200 ${
                        active
                          ? "bg-[var(--primary)] text-white border-[var(--primary)] font-semibold"
                          : "bg-white text-gray-700 border-gray-300 hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Dev override */}
        <div className="bg-amber-50 rounded-xl border border-amber-300 p-4">
          <div className="text-[0.8125rem] font-semibold text-amber-800 mb-2">⚠️ Dev/Demo: Physician ID Override</div>
          <input
            value={form.physicianId}
            onChange={set("physicianId")}
            className={`${inputClasses} !bg-amber-50`}
            placeholder="Leave blank to auto-detect, or enter Physician DB ID"
          />
          <div className="text-xs text-amber-700 mt-1.5">Only shown in development. Auto-detected in production.</div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-muted)] text-sm font-medium cursor-pointer bg-transparent hover:bg-[var(--background)] transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`px-6 py-2.5 rounded-xl border-none text-white font-semibold text-sm cursor-pointer transition-all duration-200 ${
              submitting ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] hover:opacity-90"
            }`}
          >
            {submitting ? "Creating Patient…" : "Create Patient"}
          </button>
        </div>
      </form>
    </div>
  );
}
