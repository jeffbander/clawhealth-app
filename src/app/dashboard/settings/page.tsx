export const dynamic = "force-dynamic";
import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

export default async function SettingsPage() {
  const { userId, orgId } = await auth();
  const user = await currentUser();
  if (!userId) return null;

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#212070", margin: 0 }}>
          ⚙️ Settings
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.25rem", fontSize: "0.875rem" }}>
          Account and organization configuration
        </p>
      </div>

      {/* Account */}
      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", marginBottom: "1.25rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#374151" }}>👤 Account</span>
        </div>
        <div style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <UserButton afterSignOutUrl="/" />
          <div>
            <div style={{ fontWeight: 600, color: "#1e293b" }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
              {user?.emailAddresses?.[0]?.emailAddress}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
              Clerk ID: {userId}
            </div>
          </div>
        </div>
      </div>

      {/* HIPAA & Compliance */}
      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", marginBottom: "1.25rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #e2e8f0", background: "#f0fdf4" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#16a34a" }}>🔒 HIPAA Compliance Status</span>
        </div>
        <div style={{ padding: "1.25rem" }}>
          {[
            { label: "PHI Encryption", detail: "AES-256-GCM at rest", status: "✅" },
            { label: "Audit Logging", detail: "All PHI access logged, 6-year retention", status: "✅" },
            { label: "Authentication", detail: "Clerk HIPAA BAA signed", status: "⚠️ Pending BAA" },
            { label: "Database", detail: "Neon PostgreSQL with SSL", status: "⚠️ Pending setup" },
            { label: "Transport Security", detail: "TLS 1.3 enforced", status: "✅" },
            { label: "Access Control", detail: "Role-based via Clerk Organizations", status: "✅" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b" }}>{item.label}</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{item.detail}</div>
              </div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{item.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Org Info */}
      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#374151" }}>🏥 Organization</span>
        </div>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
            <strong>Org ID:</strong> {orgId ?? "No organization — join or create one in Clerk Dashboard"}
          </div>
          <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#64748b" }}>
            Mount Sinai West · Cardiology Program
          </div>
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#fffbeb", borderRadius: "0.5rem", border: "1px solid #fde68a", fontSize: "0.8125rem", color: "#92400e" }}>
            💡 To enable multi-physician access, configure a Clerk Organization and invite your team.
          </div>
        </div>
      </div>
    </div>
  );
}
