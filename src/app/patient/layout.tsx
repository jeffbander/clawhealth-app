import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { decryptPHI } from "@/lib/encryption";

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
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Top nav */}
      <nav
        style={{
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 1.5rem",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
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
                width: "32px",
                height: "32px",
                borderRadius: "0.5rem",
                background: "linear-gradient(135deg, #212070, #06ABEB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
              }}
            >
              🏥
            </div>
            <span style={{ fontWeight: 700, color: "#212070", fontSize: "1rem" }}>
              ClawHealth
            </span>
          </Link>

          <Link
            href="/patient/chat"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#64748b",
              textDecoration: "none",
            }}
          >
            💬 Chat
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>
            Hi, {patientName}
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <main style={{ maxWidth: "768px", margin: "0 auto", padding: "1.5rem" }}>
        {children}
      </main>
    </div>
  );
}
