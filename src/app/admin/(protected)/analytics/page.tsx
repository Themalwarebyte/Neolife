import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";
import { formatCrmStatus, percentOf } from "@/lib/crm-phase2";
import { crmAnalyticsRangeStart, parseCrmAnalyticsRange } from "@/lib/qualification-review";

export const dynamic = "force-dynamic";

type Query = { range?: string | string[] };

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
    <dt className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</dt>
    <dd className="mt-2 text-3xl font-bold tabular-nums text-mulberry-800">{value}</dd>
    <p className="mt-1 text-xs text-neutral-500">{detail}</p>
  </div>;
}

const RANGE_LABELS = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "365d": "Last 365 days" } as const;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  const params = await searchParams;
  const range = parseCrmAnalyticsRange(params.range);
  const since = crmAnalyticsRangeStart(range);
  const scope: Prisma.LeadWhereInput = user.role === "admin" ? {} : { assignedUserId: user.id };
  const windowScope: Prisma.LeadWhereInput = { ...scope, createdAt: { gte: since } };

  const [total, newInRange, stages, sources, convertedInRange, attendedMeetings, outstandingFollowUps, overdueFollowUps, funnelEvents] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: windowScope }),
    prisma.lead.groupBy({ by: ["status"], where: windowScope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["firstTouchSource"], where: windowScope, _count: { _all: true } }),
    prisma.lead.count({ where: { ...windowScope, status: "CONVERTED" } }),
    prisma.meeting.count({ where: { status: "ATTENDED", updatedAt: { gte: since }, lead: scope } }),
    prisma.followUp.count({ where: { dueAt: { not: null }, completedAt: null, lead: scope } }),
    prisma.followUp.count({ where: { dueAt: { lt: new Date() }, completedAt: null, lead: scope } }),
    prisma.funnelEvent.groupBy({
      by: ["type"],
      where: {
        createdAt: { gte: since },
        type: { in: ["lead_created", "lead_qualified", "registration_complete"] },
        ...(user.role === "admin" ? {} : { lead: { is: { assignedUserId: user.id } } }),
      },
      _count: { _all: true },
    }),
  ]);

  const rows = stages.map((s) => ({ label: formatCrmStatus(s.status), count: s._count._all }))
    .sort((a, b) => b.count - a.count);
  const sourcesSorted = sources.map((s) => ({ label: s.firstTouchSource || "Direct / unknown", count: s._count._all }))
    .sort((a, b) => b.count - a.count).slice(0, 10);
  const funnelLabels: Record<string, string> = {
    lead_created: "Lead created",
    lead_qualified: "Lead qualified",
    registration_complete: "Product interest registered",
  };
  const funnelRows = funnelEvents
    .map((event) => ({ label: funnelLabels[event.type] ?? event.type, count: event._count._all }))
    .sort((a, b) => ["Lead created", "Lead qualified", "Product interest registered"].indexOf(a.label) - ["Lead created", "Lead qualified", "Product interest registered"].indexOf(b.label));

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">CRM performance</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">Pipeline insights</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {user.role === "admin" ? "Office-wide contact outcomes." : "Only contacts assigned to you."}
          {" "}Range: {RANGE_LABELS[range]}. Counts reflect recorded CRM state and events, not ad-platform attribution or sales revenue.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/qualification" className="text-sm font-semibold text-mulberry-700 hover:underline">Qualification queue →</Link>
        <Link href="/admin/leads" className="text-sm font-semibold text-mulberry-700 hover:underline">Explore contacts →</Link>
      </div>
    </header>

    <form method="GET" action="/admin/analytics" className="flex flex-wrap items-end gap-3 rounded-2xl border border-mulberry-100 bg-white p-4">
      <div>
        <label htmlFor="analytics-range" className="block text-xs font-semibold text-neutral-700">Reporting window</label>
        <select id="analytics-range" name="range" defaultValue={range} className="mt-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="365d">Last 365 days</option>
        </select>
      </div>
      <button type="submit" className="rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-mulberry-800">Apply window</button>
    </form>

    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Total contacts" value={total} detail="All contact records in your authorized scope" />
      <Metric label="New contacts" value={newInRange} detail={`Created during ${RANGE_LABELS[range].toLowerCase()}`} />
      <Metric label="Currently converted" value={percentOf(convertedInRange, newInRange)} detail={`${convertedInRange} contacts created in this window are currently in Converted status`} />
      <Metric label="Overdue follow-ups" value={overdueFollowUps} detail={`${outstandingFollowUps} scheduled tasks remain outstanding`} />
    </dl>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-neutral-900">Current pipeline status</h2>
        <p className="mt-1 text-xs text-neutral-500">Current statuses for contacts created during {RANGE_LABELS[range].toLowerCase()}; these are not sequential conversion events.</p>
        {rows.length === 0 ? <p className="mt-6 text-sm text-neutral-500">No CRM contacts in this window.</p> : <ul className="mt-5 space-y-3">
          {rows.map((row) => <li key={row.label}>
            <div className="mb-1 flex justify-between gap-2 text-sm"><span className="text-neutral-700">{row.label}</span><span className="font-semibold tabular-nums text-neutral-800">{row.count} · {percentOf(row.count, newInRange)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-mulberry-600" style={{ width: `${newInRange ? row.count / newInRange * 100 : 0}%` }} /></div>
          </li>)}
        </ul>}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-neutral-900">First-touch lead sources</h2>
        <p className="mt-1 text-xs text-neutral-500">Contacts created in the selected window, grouped by captured first-touch source. Blank sources are unknown.</p>
        {sourcesSorted.length === 0 ? <p className="mt-6 text-sm text-neutral-500">No source data in this window.</p> : <ul className="mt-5 divide-y divide-neutral-100">
          {sourcesSorted.map((source, index) => <li key={`${source.label}-${index}`} className="flex justify-between gap-3 py-2.5 text-sm">
            <span className="min-w-0 break-words text-neutral-700">{source.label}</span>
            <strong className="shrink-0 tabular-nums text-mulberry-800">{source.count}</strong>
          </li>)}
        </ul>}
      </section>
    </div>

    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-neutral-900">First-party funnel activity</h2>
      <p className="mt-1 text-xs text-neutral-500">Event counts recorded during the selected window. A lead can generate more than one event; these counts are not cohort conversion rates.</p>
      {funnelRows.length === 0 ? <p className="mt-5 text-sm text-neutral-500">No linked funnel events in this window.</p> : <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        {funnelRows.map((row) => <div key={row.label} className="rounded-xl bg-neutral-50 p-4">
          <dt className="text-sm text-neutral-600">{row.label}</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-mulberry-800">{row.count}</dd>
        </div>)}
      </dl>}
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mulberry-100 bg-mulberry-50 p-5">
      <div><p className="font-semibold text-neutral-900">Meeting outcomes</p>
        <p className="mt-1 text-sm text-neutral-600">{attendedMeetings} meetings marked attended during the selected window. A contact may attend more than once.</p></div>
      <Link className="rounded-full bg-mulberry-700 px-4 py-2 text-sm font-semibold text-white hover:bg-mulberry-800" href="/admin/follow-ups">Review follow-ups</Link>
    </div>
  </div>;
}
