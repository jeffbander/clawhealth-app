"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CarePlan {
  id: string;
  patientId: string;
  patientName: string;
  version: number;
  active: boolean;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function CarePlansPage() {
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<CarePlan | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // New plan form state
  const [newPatientId, setNewPatientId] = useState("");
  const [newContent, setNewContent] = useState("");
  const [patients, setPatients] = useState<{ id: string; firstName: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/care-plans").then((r) => r.json()),
      fetch("/api/patients").then((r) => r.json()),
    ]).then(([plansData, patientsData]) => {
      setPlans(Array.isArray(plansData) ? plansData : []);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const openPlan = (plan: CarePlan) => {
    setSelected(plan);
    setEditContent(plan.content);
    setShowCreate(false);
    setSaveMsg("");
  };

  const savePlan = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/care-plans/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlans((prev) => prev.map((p) => (p.id === updated.id ? { ...p, content: updated.content, version: updated.version, updatedAt: updated.updatedAt } : p)));
        setSelected((prev) => prev ? { ...prev, content: updated.content, version: updated.version, updatedAt: updated.updatedAt } : null);
        setSaveMsg("✅ Saved successfully");
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        setSaveMsg("❌ Save failed");
      }
    } catch {
      setSaveMsg("❌ Network error");
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async () => {
    if (!newPatientId || !newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/care-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: newPatientId, content: newContent }),
      });
      if (res.ok) {
        const created = await res.json();
        setPlans((prev) => [created, ...prev]);
        setShowCreate(false);
        setNewPatientId("");
        setNewContent("");
        setSelected(created);
        setEditContent(created.content);
      }
    } catch {}
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#212070", margin: 0 }}>
            📋 Care Plans
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
            {plans.length} active care plans
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelected(null); setSaveMsg(""); }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "linear-gradient(135deg, #212070, #06ABEB)",
            color: "white",
            padding: "0.625rem 1.25rem",
            borderRadius: "0.75rem",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          + New Care Plan
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.5rem" }}>
        {/* Left: plan list */}
        <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", height: "fit-content" }}>
          <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569" }}>Active Plans</span>
          </div>

          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Loading…</div>
          ) : plans.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📋</div>
              <div>No care plans yet</div>
            </div>
          ) : (
            plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => openPlan(plan)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.875rem 1.25rem",
                  borderBottom: "1px solid #f1f5f9",
                  border: "none",
                  background: selected?.id === plan.id ? "#e8f7fd" : "white",
                  cursor: "pointer",
                  borderLeft: selected?.id === plan.id ? "3px solid #06ABEB" : "3px solid transparent",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b", marginBottom: "0.25rem" }}>
                  {plan.patientName || "Patient"}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.6875rem", background: "#e8f7fd", color: "#0369a1", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 600 }}>
                    v{plan.version}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Updated {timeAgo(plan.updatedAt)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right: editor / create form */}
        <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {showCreate ? (
            <div style={{ padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#212070", marginTop: 0, marginBottom: "1.25rem" }}>
                Create New Care Plan
              </h2>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.375rem" }}>
                  Patient *
                </label>
                <select
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  style={{ width: "100%", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", fontSize: "0.875rem", color: "#1e293b" }}
                >
                  <option value="">Select a patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.375rem" }}>
                  Care Plan Content *
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter care plan details including goals, interventions, monitoring schedule, medications, follow-up appointments, and patient education..."
                  style={{
                    width: "100%",
                    minHeight: "300px",
                    padding: "0.875rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #d1d5db",
                    fontSize: "0.875rem",
                    fontFamily: "inherit",
                    lineHeight: 1.6,
                    resize: "vertical",
                    color: "#1e293b",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={createPlan}
                  disabled={saving || !newPatientId || !newContent.trim()}
                  style={{
                    background: saving ? "#94a3b8" : "linear-gradient(135deg, #212070, #06ABEB)",
                    color: "white",
                    padding: "0.625rem 1.5rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    cursor: saving ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                  }}
                >
                  {saving ? "Creating…" : "Create Care Plan"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{ background: "transparent", color: "#64748b", padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", cursor: "pointer", fontSize: "0.875rem" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selected ? (
            <div>
              {/* Plan header */}
              <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                    {selected.patientName}
                  </h2>
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.6875rem", background: "#e8f7fd", color: "#0369a1", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>
                      Version {selected.version}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Last updated {timeAgo(selected.updatedAt)}
                    </span>
                    <Link href={`/dashboard/patients/${selected.patientId}`} style={{ fontSize: "0.75rem", color: "#06ABEB", textDecoration: "none", fontWeight: 500 }}>
                      View patient →
                    </Link>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {saveMsg && <span style={{ fontSize: "0.8125rem", color: saveMsg.startsWith("✅") ? "#10b981" : "#dc2626" }}>{saveMsg}</span>}
                  <button
                    onClick={savePlan}
                    disabled={saving}
                    style={{
                      background: saving ? "#94a3b8" : "#212070",
                      color: "white",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.5rem",
                      border: "none",
                      cursor: saving ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                    }}
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Editor */}
              <div style={{ padding: "1.25rem 1.5rem" }}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "420px",
                    padding: "0.875rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.875rem",
                    fontFamily: "inherit",
                    lineHeight: 1.7,
                    resize: "vertical",
                    color: "#1e293b",
                    background: "#fafafa",
                  }}
                />

                {/* Version history hint */}
                <div style={{ marginTop: "1rem", padding: "0.875rem 1rem", background: "#f8fafc", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                    📜 Version History
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Current: v{selected.version} · Saving creates a new version automatically.
                    Previous versions are retained in the database for clinical audit purposes.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</div>
              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.5rem" }}>
                Select a care plan to view or edit
              </div>
              <div style={{ fontSize: "0.875rem" }}>
                Or create a new care plan for a patient
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
