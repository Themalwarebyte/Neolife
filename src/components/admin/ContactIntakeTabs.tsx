import Link from "next/link";

export type ContactView = "main" | "archived" | "queue" | "duplicates" | "history" | "follow-ups" | "pool" | "transfers" | "rejected-imports";
const tabs: { key: ContactView; label: string; path?: string }[] = [
  { key: "main", label: "Main Contacts" },
  { key: "archived", label: "Archived" },
  { key: "queue", label: "Imported Queue" },
  { key: "rejected-imports", label: "Rejected Imports", path: "/admin/my-contacts/rejected-imports" },
  { key: "pool", label: "Contact Pool" },
  { key: "transfers", label: "Transfers" },
  { key: "duplicates", label: "Duplicate Issues" },
  { key: "history", label: "Import History" },
  { key: "follow-ups", label: "Contact Follow-ups", path: "/admin/my-contacts/follow-ups" },
];

export function ContactIntakeTabs({ view, scopeAll = false, role }: { view: ContactView; scopeAll?: boolean; role?: string }) {
  const visibleTabs = role === "admin" ? tabs : tabs.filter(tab => !["pool", "transfers"].includes(tab.key));
  return <nav aria-label="Contact intake sections" className="flex flex-wrap gap-2">
    {visibleTabs.map(tab => {
      const params = new URLSearchParams();
      if (tab.key !== "follow-ups" && tab.key !== "rejected-imports") params.set("view", tab.key);
      if (scopeAll) params.set("scope", "all");
      const href = tab.path
        ? `${tab.path}${scopeAll ? "?scope=all" : ""}`
        : `/admin/my-contacts?${params.toString()}`;
      return <Link key={tab.key} href={href}
        aria-current={view === tab.key ? "page" : undefined}
        className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${view === tab.key ? "bg-mulberry-700 text-white" : "border border-mulberry-200 bg-white text-mulberry-800 hover:bg-mulberry-50"}`}>
        {tab.label}
      </Link>;
    })}
  </nav>;
}
