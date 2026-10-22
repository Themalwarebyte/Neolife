import Link from "next/link";

type ContactView = "main" | "archived" | "queue" | "duplicates" | "history" | "follow-ups";
const tabs: { key: ContactView; label: string; future?: string }[] = [
  { key: "main", label: "Main Contacts" },
  { key: "archived", label: "Archived" },
  { key: "queue", label: "Imported Queue" },
  { key: "duplicates", label: "Duplicate Issues" },
  { key: "history", label: "Import History" },
  { key: "follow-ups", label: "Contact Follow-ups" },
];

export function ContactIntakeTabs({ view, scopeAll = false }: { view: ContactView; scopeAll?: boolean }) {
  return <nav aria-label="Contact intake sections" className="flex flex-wrap gap-2">
    {tabs.map(tab => {
      const params = new URLSearchParams({ view: tab.key });
      if (scopeAll) params.set("scope", "all");
      return <Link key={tab.key} href={tab.key === "follow-ups" ? "/admin/my-contacts/follow-ups" + (scopeAll ? "?scope=all" : "") : `/admin/my-contacts?${params.toString()}`}
        aria-current={view === tab.key ? "page" : undefined}
        className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${view === tab.key ? "bg-mulberry-700 text-white" : "border border-mulberry-200 bg-white text-mulberry-800 hover:bg-mulberry-50"}`}>
        {tab.label}{tab.future ? <span className="ml-1 font-normal opacity-75">· {tab.future}</span> : null}
      </Link>;
    })}
  </nav>;
}
