export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { decryptPHI } from "@/lib/encryption";

const navItems = [
  { href: "/patient", label: "Home", icon: "🏠" },
  { href: "/patient/chat", label: "Chat", icon: "💬" },
  { href: "/patient/medications", label: "Meds", icon: "💊" },
  { href: "/patient/vitals", label: "Vitals", icon: "📊" },
];

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Look up patient record for display name
  let patientName = user.firstName ?? "Patient";
  try {
    const patient = await prisma.patient.findFirst({
      where: { clerkUserId: user.id },
      select: { encFirstName: true },
    });
    if (patient?.encFirstName) {
      patientName = decryptPHI(patient.encFirstName);
    }
  } catch {}

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: "64px" }}>
      {/* Top nav */}
      <nav
        style={{
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 1.25rem",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Brand */}
        <Link
          href="/patient"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #212070, #06ABEB)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
            }}
          >
            🏥
          </div>
          <span style={{ fontWeight: 700, color: "#212070", fontSize: "0.9375rem" }}>
            ClawHealth
          </span>
        </Link>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 500 }}>
            {patientName}
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* HIPAA notice bar */}
      <div
        style={{
          background: "#f0fdf4",
          borderBottom: "1px solid #bbf7d0",
          padding: "0.375rem 1.25rem",
          fontSize: "0.6875rem",
          color: "#15803d",
          textAlign: "center",
          fontWeight: 500,
        }}
      >
        🔒 HIPAA Compliant · All health data encrypted
      </div>

      {/* Main content */}
      <main
        className="patient-content"
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          padding: "1.25rem 1rem",
        }}
      >
        {children}
      </main>

      {/* Bottom navigation bar (mobile-first) */}
      <nav className="patient-bottom-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="patient-bottom-nav-item"
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
