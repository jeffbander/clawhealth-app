"use client";

import { useState } from "react";

interface VitalsFormProps {
  patientId: string;
}

export default function VitalsForm({ patientId }: VitalsFormProps) {
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [weight, setWeight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const vitals: Array<{ patientId: string; type: string; value: string; unit: string }> = [];

    if (systolic)
      vitals.push({ patientId, type: "BLOOD_PRESSURE_SYSTOLIC", value: systolic, unit: "mmHg" });
    if (diastolic)
      vitals.push({ patientId, type: "BLOOD_PRESSURE_DIASTOLIC", value: diastolic, unit: "mmHg" });
    if (heartRate)
      vitals.push({ patientId, type: "HEART_RATE", value: heartRate, unit: "bpm" });
    if (weight)
      vitals.push({ patientId, type: "WEIGHT", value: weight, unit: "lbs" });

    if (vitals.length === 0) {
      setError("Please enter at least one vital.");
      setSubmitting(false);
      return;
    }

    try {
      // Submit each vital
      await Promise.all(
        vitals.map((v) =>
          fetch("/api/vitals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(v),
          })
        )
      );
      setSuccess(true);
      setSystolic("");
      setDiastolic("");
      setHeartRate("");
      setWeight("");
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to submit vitals. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.75rem",
    border: "1px solid #e2e8f0",
    borderRadius: "0.5rem",
    fontSize: "0.9375rem",
    color: "#1e293b",
    background: "white",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "0.375rem",
  };

  return (
    <form onSubmit={handleSubmit}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.875rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <label style={labelStyle}>
            BP Systolic (mmHg)
          </label>
          <input
            type="number"
            value={systolic}
            onChange={(e) => setSystolic(e.target.value)}
            placeholder="e.g. 120"
            min="60"
            max="250"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>
            BP Diastolic (mmHg)
          </label>
          <input
            type="number"
            value={diastolic}
            onChange={(e) => setDiastolic(e.target.value)}
            placeholder="e.g. 80"
            min="40"
            max="150"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Heart Rate (bpm)</label>
          <input
            type="number"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
            placeholder="e.g. 72"
            min="30"
            max="250"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Weight (lbs)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 165"
            min="50"
            max="600"
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "0.625rem 0.875rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.5rem",
            color: "#dc2626",
            fontSize: "0.8125rem",
            marginBottom: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "0.625rem 0.875rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "0.5rem",
            color: "#16a34a",
            fontSize: "0.8125rem",
            fontWeight: 600,
            marginBottom: "0.875rem",
          }}
        >
          ✅ Vitals logged successfully!
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "0.75rem 1.5rem",
          background: submitting ? "#e2e8f0" : "#212070",
          color: submitting ? "#94a3b8" : "white",
          border: "none",
          borderRadius: "0.5rem",
          fontWeight: 600,
          fontSize: "0.9375rem",
          cursor: submitting ? "not-allowed" : "pointer",
          width: "100%",
        }}
      >
        {submitting ? "Saving…" : "Log Vitals"}
      </button>
    </form>
  );
}
