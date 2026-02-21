export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SidebarNav } from "./SidebarNav";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/patients", label: "Patients", icon: "👥" },
  { href: "/dashboard/patients/onboard", label: "Onboard Patient", icon: "📋" },
  { href: "/dashboard/alerts", label: "Alerts", icon: "🔔" },
  { href: "/dashboard/care-plans", label: "Care Plans", icon: "📋" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 bg-[var(--primary)] text-white flex-col flex-shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--cta)] flex items-center justify-center text-xl">
              🏥
            </div>
            <div>
              <div className="font-bold text-base text-white">ClawHealth</div>
              <div className="text-[0.6875rem] text-white/50">Physician Portal</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <SidebarNav links={navLinks} />

        {/* Compliance */}
        <div className="p-4 border-t border-white/10">
          <div className="text-[0.625rem] text-white/40 text-center leading-relaxed">
            ✓ HIPAA Compliant · ✓ SOC 2
            <br />
            All PHI AES-256 encrypted
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-[var(--surface)] border-b border-[var(--border)] px-6 h-[60px] flex items-center justify-between flex-shrink-0">
          {/* Mobile menu button */}
          <div className="lg:hidden">
            <Link href="/dashboard" className="font-bold text-[var(--primary)]">
              🏥 ClawHealth
            </Link>
          </div>
          <div className="hidden lg:block text-sm text-[var(--text-muted)]">
            Mount Sinai West — Cardiology
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-[0.8125rem]">
              <div className="font-semibold text-[var(--text-primary)]">
                {user.firstName ?? ""} {user.lastName ?? ""}
              </div>
              <div className="text-[var(--text-muted)]">Attending Physician</div>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
