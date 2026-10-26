"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Mulberry sidebar navigation (Phase 5). Owner sees Users + Referrals;
 * Staff see their own private contacts and assigned CRM leads. Active route is highlighted.
 */
export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();

  const links = [
    { href: "/admin/my-contacts", label: "My Contacts", show: true },
    { href: "/admin/leads", label: "Lead pipeline", show: true },
    { href: "/admin/workflows", label: "Workspace", show: true },
    { href: "/admin/triage", label: "Attention", show: true },
    { href: "/admin/qualification", label: "Qualification", show: true },
    { href: "/admin/follow-ups", label: "Follow-ups", show: true },
    { href: "/admin/analytics", label: "Insights", show: true },
    { href: "/admin/notifications", label: "Notifications", show: true },
    { href: "/admin/referrals", label: "Referral links", show: role === "admin" },
    { href: "/admin/users", label: "Users", show: role === "admin" },
    { href: "/admin/activity-audit", label: "Activity Audit", show: role === "admin" },
  ].filter((link) => link.show);

  return (
    <nav
      aria-label="CRM navigation"
      className="flex shrink-0 gap-1 overflow-x-auto px-5 py-4 sm:w-56 sm:flex-col sm:gap-1.5 sm:py-8 sm:pl-0"
    >
      {links.map((link) => {
        const active =
          link.href === "/admin/leads"
            ? pathname.startsWith("/admin/leads")
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-mulberry-700 text-white shadow-sm"
                : "text-mulberry-800 hover:bg-mulberry-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
