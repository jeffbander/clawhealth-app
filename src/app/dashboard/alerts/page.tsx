"use client";

import { useEffect, useState, useCallback } from "react";

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#16a34a",
};

interface Alert {
  id: string;
  patientId: string;
  severity: string;
  category: string;
  message: string;
  firstName: string;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error("Failed to load alerts");
      const data = await res.json();
      const sorted = [...data].sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
      );
      setAlerts(sorted);
    } catch {
      setError("Failed to load alerts. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    setResolving(alertId);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      });
      if (!res.ok) throw new Error("Failed to resolve");
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      alert("Failed to resolve alert. Please try again.");
    } finally {
      setResolving(null);
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#212070", margin: 0 }}>
          🔔 Active Alerts
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          All unresolved alerts sorted by severity
        </p>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            Loading alerts…
          </div>
        ) : error ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#dc2626" }}>{error}</div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>✅</div>
            <div style={{ fontWeight: 600, color: "#1e293b" }}>All clear!</div>
            <div style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              No active alerts for your patients.
            </div>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 1fr 120px 100px",
                gap: "1rem",
                padding: "0.75rem 1.25rem",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span>Severity</span>
              <span>Patient</span>
              <span>Alert</span>
              <span>Time</span>
              <span>Action</span>
            </div>

            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 1fr 120px 100px",
                  gap: "1rem",
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid #f1f5f9",
                  alignItems: "center",
                  borderLeft: `4px solid ${SEVERITY_COLORS[alert.severity] ?? "#e2e8f0"}`,
                }}
              >
                {/* Severity */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: SEVERITY_COLORS[alert.severity],
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: SEVERITY_COLORS[alert.severity],
                      flexShrink: 0,
                    }}
                  />
                  {alert.severity}
                </span>

                {/* Patient */}
                <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b" }}>
                  {alert.firstName}
                </span>

                {/* Message */}
                <div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#475569",
                      marginBottom: "0.125rem",
                    }}
                  >
                    [{alert.category}]
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {alert.message}
                  </div>
                </div>

                {/* Time */}
                <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                  {timeAgo(alert.createdAt)}
                </span>

                {/* Resolve button */}
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolving === alert.id}
                  style={{
                    padding: "0.4rem 0.875rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    background: resolving === alert.id ? "#e2e8f0" : "#212070",
                    color: resolving === alert.id ? "#94a3b8" : "white",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: resolving === alert.id ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {resolving === alert.id ? "…" : "Resolve"}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
