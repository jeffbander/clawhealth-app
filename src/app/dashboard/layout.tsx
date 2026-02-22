export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SidebarNav } from "./SidebarNav";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/patients", label: "Patients", icon: "patients" },
  { href: "/dashboard/inbox", label: "Inbox", icon: "inbox" },
  { href: "/dashboard/patients/onboard", label: "Onboard", icon: "onboard" },
  { href: "/dashboard/alerts", label: "Alerts", icon: "alerts" },
  { href: "/dashboard/care-plans", label: "Care Plans", icon: "careplans" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      {/* ─── Light Sidebar ─── */}
      <aside className="hidden lg:flex w-[220px] flex-col flex-shrink-0 bg-white border-r border-gray-200/80">
        {/* Brand */}
        <div className="px-5 pt-5 pb-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a5e] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <span className="font-semibold text-[0.9375rem] text-gray-900 tracking-tight">ClawHealth</span>
          </Link>
        </div>

        {/* Nav */}
        <SidebarNav links={navLinks} />

        {/* Bottom */}
        <div className="mt-auto border-t border-gray-100">
          <div className="px-4 py-3 flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <div className="flex-1 min-w-0">
              <div className="text-[0.8125rem] font-medium text-gray-900 truncate">
                Dr. {user.lastName ?? user.firstName ?? ""}
              </div>
              <div className="text-[0.6875rem] text-gray-400 truncate">
                Cardiology
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — minimal */}
        <header className="bg-white border-b border-gray-200/80 px-6 h-[52px] flex items-center justify-between flex-shrink-0">
          <div className="lg:hidden">
            <Link href="/dashboard" className="font-semibold text-gray-900 no-underline text-sm">
              ClawHealth
            </Link>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>Mount Sinai West</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
