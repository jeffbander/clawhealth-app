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
  { href: "/dashboard/care-plans", label: "Care Plans", icon: "📝" },
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
    <div className="flex min-h-screen bg-[#f1f5f9]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[240px] flex-col flex-shrink-0 bg-gradient-to-b from-[#1a1a5e] to-[#141442] border-r border-white/5">
        {/* Brand */}
        <div className="px-5 py-5">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#06ABEB] to-[#0284c7] flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-[0.9375rem] text-white tracking-tight">ClawHealth</div>
              <div className="text-[0.625rem] text-white/40 font-medium tracking-wide uppercase">Physician Portal</div>
            </div>
          </Link>
        </div>

        <div className="px-4 mb-2">
          <div className="h-px bg-white/[0.08]" />
        </div>

        {/* Nav */}
        <SidebarNav links={navLinks} />

        {/* Bottom section */}
        <div className="mt-auto">
          <div className="px-4 mb-3">
            <div className="h-px bg-white/[0.08]" />
          </div>

          {/* User */}
          <div className="px-4 pb-3 flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <div className="flex-1 min-w-0">
              <div className="text-[0.8125rem] font-semibold text-white/90 truncate">
                {user.firstName ?? ""} {user.lastName ?? ""}
              </div>
              <div className="text-[0.625rem] text-white/40 truncate">
                Attending Physician
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="px-5 py-3 bg-white/[0.03]">
            <div className="text-[0.5625rem] text-white/30 text-center leading-relaxed font-medium tracking-wide">
              HIPAA Compliant · SOC 2 · AES-256
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 h-[56px] flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
          {/* Mobile menu button */}
          <div className="lg:hidden">
            <Link href="/dashboard" className="font-bold text-[#212070] no-underline flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              ClawHealth
            </Link>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-400">
            <span className="text-gray-300">🏥</span>
            <span>Mount Sinai West</span>
            <span className="text-gray-300">·</span>
            <span>Cardiology</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-[0.8125rem] font-semibold text-gray-900">
                Dr. {user.lastName ?? user.firstName ?? ""}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
