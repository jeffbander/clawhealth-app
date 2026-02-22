"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  icon: string;
}

export function SidebarNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 py-4 px-3 space-y-0.5">
      {links.map((link) => {
        const isActive =
          link.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`
              relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.8125rem] font-medium
              transition-all duration-200 no-underline group
              ${
                isActive
                  ? "bg-white/[0.12] text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  : "text-white/60 hover:bg-white/[0.07] hover:text-white/90"
              }
            `}
          >
            {/* Active indicator bar */}
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#06ABEB]" />
            )}
            <span className="text-base w-5 text-center opacity-90 group-hover:opacity-100 transition-opacity">
              {link.icon}
            </span>
            <span className="tracking-[-0.01em]">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
