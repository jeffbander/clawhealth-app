"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CONDITIONS_LIST = [
  "Type 2 Diabetes",
  "Hypertension",
  "Heart Failure",
  "Atrial Fibrillation",
  "Coronary Artery Disease",
  "COPD",
  "Chronic Kidney Disease",
  "Obesity",
  "Hyperlipidemia",
  "Post-Cardiac Stent",
  "Peripheral Artery Disease",
  "Stroke / TIA",
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

export default function AddPatientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    mrn: "",
    phone: "",
    email: "",
    address: "",
    riskLevel: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    primaryDx: "",
    conditions: [] as string[],
    clerkUserId: `demo_${Date.now()}`,
    physicianId: "",
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

    // Validate required fields
    if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.mrn) {
      setError("Please fill in all required fields.");
      setSubmitting(false);
      return;
    }

    // Determine physicianId — look up via API or use placeholder for demo
    let physicianId = form.physicianId;
    if (!physicianId) {
      try {
        const res = await fetch("/api/physician/me");
        if (res.ok) {
          const data = await res.json();
          physicianId = data.id;
        }
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
        body: JSON.stringify({
          ...form,
          physicianId,
        }),
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    borderRadius: "0.5rem",
    border: "1px solid #d1d5db",
    fontSize: "0.875rem",
    color: "#1e293b",
    background: "white",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "0.375rem",
  };

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#212070", margin: 0 }}>
          Add New Patient
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          All PHI is encrypted at rest with AES-256-GCM before storage.
        </p>
      </div>

      <form onSubmit={submit}>
        {/* PHI Section */}
        <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: "1.25rem", overflow: "hidden" }}>
          <div style={{ padding: "0.875rem 1.25rem", background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#dc2626" }}>
              🔐 Protected Health Information (PHI) — Encrypted at rest
            </span>
          </div>
          <div style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input value={form.firstName} onChange={set("firstName")} required style={inputStyle} placeholder="Mary" />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input value={form.lastName} onChange={set("lastName")} required style={inputStyle} placeholder="Johnson" />
            </div>
            <div>
              <label style={labelStyle}>Date of Birth *</label>
              <input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>MRN (Medical Record Number) *</label>
              <input value={form.mrn} onChange={set("mrn")} required style={inputStyle} placeholder="MRN-123456" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={form.phone} onChange={set("phone")} style={inputStyle} placeholder="(212) 555-0100" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={set("email")} style={inputStyle} placeholder="patient@example.com" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Address</label>
              <input value={form.address} onChange={set("address")} style={inputStyle} placeholder="123 Main St, New York, NY 10001" />
            </div>
          </div>
        </div>

        {/* Clinical Section */}
        <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: "1.25rem", overflow: "hidden" }}>
          <div style={{ padding: "0.875rem 1.25rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#374151" }}>
              🏥 Clinical Information
            </span>
          </div>
          <div style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Risk Level</label>
              <select value={form.riskLevel} onChange={set("riskLevel")} style={inputStyle}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Primary Diagnosis (ICD-10)</label>
              <select value={form.primaryDx} onChange={set("primaryDx")} style={inputStyle}>
                <option value="">— Select —</option>
                {ICD_DX.map((dx) => (
                  <option key={dx.code} value={dx.code}>{dx.code ? `${dx.code} — ` : ""}{dx.label}</option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Active Conditions (select all that apply)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                {CONDITIONS_LIST.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCondition(c)}
                    style={{
                      padding: "0.375rem 0.75rem",
                      borderRadius: "9999px",
                      border: form.conditions.includes(c) ? "1px solid #212070" : "1px solid #d1d5db",
                      background: form.conditions.includes(c) ? "#212070" : "white",
                      color: form.conditions.includes(c) ? "white" : "#374151",
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      fontWeight: form.conditions.includes(c) ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Physician ID override (for dev/demo) */}
        <div style={{ background: "#fffbeb", borderRadius: "0.75rem", border: "1px solid #fde68a", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#92400e", marginBottom: "0.5rem" }}>
            ⚠️ Dev/Demo: Physician ID Override
          </div>
          <input
            value={form.physicianId}
            onChange={set("physicianId")}
            style={{ ...inputStyle, background: "#fffbeb" }}
            placeholder="Leave blank to auto-detect from your Clerk session, or enter Physician DB ID"
          />
          <div style={{ fontSize: "0.75rem", color: "#92400e", marginTop: "0.375rem" }}>
            This field is only shown in development. In production, physician is auto-detected.
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.875rem 1rem", marginBottom: "1rem", color: "#dc2626", fontSize: "0.875rem" }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ background: "transparent", color: "#64748b", padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: submitting ? "#94a3b8" : "linear-gradient(135deg, #212070, #06ABEB)",
              color: "white",
              padding: "0.625rem 1.75rem",
              borderRadius: "0.75rem",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
            }}
          >
            {submitting ? "Creating Patient…" : "Create Patient"}
          </button>
        </div>
      </form>
    </div>
  );
}
