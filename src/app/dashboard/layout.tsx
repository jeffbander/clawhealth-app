import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/patients", label: "Patients", icon: "👥" },
  { href: "/dashboard/alerts", label: "Alerts", icon: "🔔" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "240px",
          background: "#212070",
          color: "white",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "0.5rem",
                background: "linear-gradient(135deg, #06ABEB, #DC298D)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              🏥
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "white" }}>
                ClawHealth
              </div>
              <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.6)" }}>
                Physician Portal
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "1rem 0.75rem" }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.625rem 0.75rem",
                borderRadius: "0.5rem",
                color: "rgba(255,255,255,0.8)",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
                marginBottom: "0.25rem",
                transition: "all 0.15s ease",
              }}
              className="nav-link"
            >
              <span style={{ fontSize: "1.1rem" }}>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Compliance badges */}
        <div
          style={{
            padding: "1rem",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              fontSize: "0.625rem",
              color: "rgba(255,255,255,0.5)",
              textAlign: "center",
              lineHeight: 1.8,
            }}
          >
            ✓ HIPAA Compliant &nbsp;·&nbsp; ✓ SOC 2
            <br />
            All PHI AES-256 encrypted
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header
          style={{
            background: "white",
            borderBottom: "1px solid #e2e8f0",
            padding: "0 1.5rem",
            height: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Mount Sinai West — Cardiology
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ textAlign: "right", fontSize: "0.8125rem" }}>
              <div style={{ fontWeight: 600, color: "#1e293b" }}>
                {user.firstName ?? ""} {user.lastName ?? ""}
              </div>
              <div style={{ color: "#64748b" }}>Attending Physician</div>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
          {children}
        </main>
      </div>

      <style>{`
        .nav-link:hover {
          background: rgba(255,255,255,0.1) !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
}
