import Link from "next/link";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { loadTriageQueue } from "@/lib/crm-triage-server";
import {
  parseTriagePage, parseTriageView, parseTriageWindow,
  TRIAGE_WINDOWS, type TriageView, type TriageReason,
} from "@/lib/crm-triage";
import { formatCrmStatus } from "@/lib/crm-phase2";

export const dynamic = "force-dynamic";

type Query = { view?: string | string[]; days?: string | string[]; page?: string | string[] };

const LABELS: Record<TriageView, string> = {
  overdue: "Overdue tasks",
  review: "Qualification review",
  upcoming: "Upcoming tasks",
  unassigned: "Unassigned",
  all: "All attention",
};
const SIGNALS: Record<TriageReason, { label: string; style: string }> = {
  overdue: { label: "Overdue follow-up", style: "border-rose-200 bg-rose-50 text-rose-800" },
  review: { label: "Review pending", style: "border-amber-200 bg-amber-50 text-amber-900" },
  upcoming: { label: "Follow-up scheduled", style: "border-mulberry-200 bg-mulberry-50 text-mulberry-800" },
  unassigned: { label: "Owner assignment needed", style: "border-neutral-200 bg-neutral-100 text-neutral-800" },
};
const displayTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC", dateStyle: "medium", timeStyle: "short",
});
function href(view: TriageView, days: number, page = 1) {
  return `/admin/triage?view=${view}&days=${days}${page > 1 ? `&page=${page}` : ""}`;
}

export default async function TriagePage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  const params = await searchParams;
  const view = parseTriageView(params.view);
  const days = parseTriageWindow(params.days);
  const page = parseTriagePage(params.page);
  const isOwner = user.role === "admin";
  const now = new Date();
  const queue = await loadTriageQueue(user, view, days, page, now);
  const tabs: TriageView[] = isOwner ? ["overdue", "review", "upcoming", "unassigned", "all"] : ["overdue", "review", "upcoming", "all"];

  return <main className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">Phase 28 · Operations</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">Attention queue</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Clear, factual signals from current CRM records—overdue follow-ups, pending qualification reviews, upcoming tasks and unassigned contacts.
          {isOwner ? " Office-wide workload." : " Only your assigned contacts."}
          {" "}These are suggestions for human action, not qualification scores or automatic status changes.
        </p>
      </div>
      <Link href={`/admin/triage/export?days=${days}`}
        className="rounded-full border border-mulberry-200 bg-white px-4 py-2 text-sm font-semibold text-mulberry-800 hover:bg-mulberry-50">
        Export aggregate CSV
      </Link>
    </header>

    <section aria-label="Triage filters" className="space-y-3">
      <nav aria-label="Attention categories" className="flex flex-wrap gap-2">
        {tabs.map(tab => <Link key={tab} href={href(tab, days)} aria-current={view === tab ? "page" : undefined}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${view === tab ? "bg-mulberry-700 text-white" : "border border-mulberry-200 bg-white text-mulberry-800 hover:bg-mulberry-50"}`}>
          {LABELS[tab]} <span className="tabular-nums">({queue.totals[tab]})</span>
        </Link>)}
      </nav>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-neutral-700">Upcoming task window:</span>
        {TRIAGE_WINDOWS.map(window => <Link key={window} href={href(view, window)} aria-current={window === days ? "page" : undefined}
          className={`rounded-lg border px-3 py-1.5 font-semibold ${window === days ? "border-mulberry-500 bg-mulberry-50 text-mulberry-900" : "border-neutral-200 bg-white text-neutral-600 hover:border-mulberry-300"}`}>
          {window} days
        </Link>)}
      </div>
      <p className="text-xs text-neutral-500">Categories can overlap; “All attention” counts each contact once. Upcoming dates and report timestamps are displayed in UTC.</p>
    </section>

    {queue.leads.length === 0 ? <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
      <h2 className="font-semibold text-neutral-900">No contacts in this queue</h2>
      <p className="mt-2 text-sm text-neutral-600">Choose a different category or reporting window.</p>
    </section> : <section className="space-y-3" aria-label="Attention contacts">
      {queue.leads.map(lead => <article key={lead.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-neutral-900">
              <Link href={`/admin/leads/${lead.id}`} className="hover:text-mulberry-700 hover:underline">{lead.firstName} {lead.lastName ?? ""}</Link>
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              {formatCrmStatus(lead.status)} · {formatCrmStatus(lead.interestType)} · {lead.assignedUser?.name ?? "Unassigned"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {lead.reasons.map(reason => <span key={reason} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${SIGNALS[reason].style}`}>{SIGNALS[reason].label}</span>)}
            </div>
            {lead.overdueAt && <p className="mt-2 text-xs text-rose-800">Earliest overdue follow-up: {displayTime.format(lead.overdueAt)} UTC</p>}
            {lead.upcomingAt && <p className="mt-1 text-xs text-mulberry-800">Next scheduled follow-up: {displayTime.format(lead.upcomingAt)} UTC</p>}
            <p className="mt-2 text-sm text-neutral-700"><strong>Suggested office action:</strong> {lead.suggestedAction}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Link href={`/admin/leads/${lead.id}`} className="text-sm font-semibold text-mulberry-700 hover:underline">Open contact →</Link>
            {lead.reasons.includes("review") && <Link href="/admin/qualification?view=needs-review" className="text-xs font-semibold text-mulberry-700 hover:underline">Qualification queue</Link>}
            {lead.reasons.includes("overdue") && <Link href="/admin/follow-ups?view=overdue" className="text-xs font-semibold text-mulberry-700 hover:underline">Overdue tasks</Link>}
            {isOwner && lead.reasons.includes("unassigned") && <Link href="/admin/workflows#unassigned" className="text-xs font-semibold text-mulberry-700 hover:underline">Assignment workspace</Link>}
          </div>
        </div>
      </article>)}
    </section>}

    <nav aria-label="Attention queue pages" className="flex justify-between gap-4 text-sm">
      {queue.page > 1 ? <Link href={href(view, days, queue.page - 1)} className="font-semibold text-mulberry-700 hover:underline">← Previous</Link> : <span />}
      <span className="text-neutral-600">Page {queue.page} of {queue.pages} · {queue.total} contact(s)</span>
      {queue.page < queue.pages ? <Link href={href(view, days, queue.page + 1)} className="font-semibold text-mulberry-700 hover:underline">Next →</Link> : <span />}
    </nav>
  </main>;
}
