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
    <nav className="flex-1 py-3 px-3 space-y-1">
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
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200 no-underline
              ${
                isActive
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }
            `}
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
