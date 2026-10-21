import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";
import { formatCrmStatus, percentOf } from "@/lib/crm-phase2";
import { crmAnalyticsRangeStart, parseCrmAnalyticsRange } from "@/lib/qualification-review";
import { formatCohortRate } from "@/lib/cohort-analytics";
import { loadCohortAnalytics } from "@/lib/cohort-analytics-server";

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
  const now = new Date();
  const since = crmAnalyticsRangeStart(range, now);
  const scope: Prisma.LeadWhereInput = user.role === "admin" ? {} : { assignedUserId: user.id };
  const windowScope: Prisma.LeadWhereInput = { ...scope, createdAt: { gte: since, lte: now } };

  const [total, stages, attendedMeetings, outstandingFollowUps, overdueFollowUps, funnelEvents, cohort] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.groupBy({ by: ["status"], where: windowScope, _count: { _all: true } }),
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
    loadCohortAnalytics(user, range, since, now),
  ]);

  const newInRange = cohort.overall.leadsCaptured;
  const convertedInRange = cohort.overall.currentlyConverted;
  const rows = stages.map((s) => ({ label: formatCrmStatus(s.status), count: s._count._all }))
    .sort((a, b) => b.count - a.count);
  const sourceRows = cohort.sourceRows.slice(0, 20);
  const funnelLabels: Record<string, string> = {
    lead_created: "Lead created",
    lead_qualified: "Lead qualified",
    registration_complete: "Product interest submitted",
  };
  const funnelRows = funnelEvents
    .map((event) => ({ label: funnelLabels[event.type] ?? event.type, count: event._count._all }))
    .sort((a, b) => ["Lead created", "Lead qualified", "Product interest submitted"].indexOf(a.label) - ["Lead created", "Lead qualified", "Product interest submitted"].indexOf(b.label));

  const progressionRows = [
    { label: "Leads captured", count: cohort.overall.leadsCaptured, rate: cohort.overall.leadsCaptured > 0 ? 100 : 0 },
    { label: "Qualified (unique leads)", count: cohort.overall.qualifiedLeads, rate: cohort.overall.qualifiedRate },
    { label: "Product interest submitted", count: cohort.overall.productInterestLeads, rate: cohort.overall.productInterestRate },
    { label: "Currently converted", count: cohort.overall.currentlyConverted, rate: cohort.overall.convertedRate },
  ];

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">CRM performance</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">Pipeline insights</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {user.role === "admin" ? "Office-wide contact outcomes." : "Only contacts assigned to you."}
          {" "}Range: {RANGE_LABELS[range]}. Counts reflect recorded CRM state and first-party events, not ad-platform attribution or sales revenue.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/qualification" className="text-sm font-semibold text-mulberry-700 hover:underline">Qualification queue →</Link>
        <Link href="/admin/leads" className="text-sm font-semibold text-mulberry-700 hover:underline">Explore contacts →</Link>
        <Link href={`/admin/analytics/export?range=${range}`} className="rounded-full bg-mulberry-700 px-4 py-2 text-sm font-semibold text-white hover:bg-mulberry-800">Download cohort CSV</Link>
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

    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Total contacts" value={total} detail="All contact records in your authorized scope" />
      <Metric label="New contacts" value={newInRange} detail={`Created during ${RANGE_LABELS[range].toLowerCase()}`} />
      <Metric label="Qualified cohort rate" value={formatCohortRate(cohort.overall.qualifiedRate)} detail={`${cohort.overall.qualifiedLeads} distinct cohort leads have a recorded qualification event`} />
      <Metric label="Product-interest rate" value={formatCohortRate(cohort.overall.productInterestRate)} detail={`${cohort.overall.productInterestLeads} distinct cohort leads submitted product-category or product interest`} />
      <Metric label="Currently converted" value={formatCohortRate(cohort.overall.convertedRate)} detail={`${convertedInRange} cohort leads are currently in Converted status`} />
      <Metric label="Overdue follow-ups" value={overdueFollowUps} detail={`${outstandingFollowUps} scheduled tasks remain outstanding`} />
    </dl>

    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-neutral-900">Lead cohort progression</h2>
      <p className="mt-1 text-xs text-neutral-500">The cohort contains leads created during {RANGE_LABELS[range].toLowerCase()}. Each progression stage counts distinct leads with a recorded event through report time. Product-interest submission is not official distributor registration.</p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {progressionRows.map((row) => <li key={row.label} className="rounded-xl bg-neutral-50 p-4">
          <div className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-neutral-700">{row.label}</span><strong className="tabular-nums text-mulberry-800">{row.count}</strong></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200"><div className="h-full rounded-full bg-mulberry-600" style={{ width: `${Math.min(100, row.rate)}%` }} /></div>
          <p className="mt-2 text-xs text-neutral-500">{formatCohortRate(row.rate)} of captured leads</p>
        </li>)}
      </ul>
    </section>

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
        <h2 className="font-bold text-neutral-900">Source and campaign progression</h2>
        <p className="mt-1 text-xs text-neutral-500">Unique leads grouped by first-touch source and captured campaign. Rates use leads in each source/campaign cohort as the denominator.</p>
        {sourceRows.length === 0 ? <p className="mt-6 text-sm text-neutral-500">No cohort data in this window.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500"><tr>
            <th scope="col" className="py-2 pr-3">Source / campaign</th><th scope="col" className="px-2 py-2 text-right">Leads</th><th scope="col" className="px-2 py-2 text-right">Qualified</th><th scope="col" className="px-2 py-2 text-right">Interest</th><th scope="col" className="pl-2 py-2 text-right">Converted</th>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">{sourceRows.map((source, index) => <tr key={`${source.source}-${source.campaign}-${index}`}>
            <td className="py-3 pr-3"><div className="font-medium text-neutral-800">{source.source}</div><div className="max-w-52 break-words text-xs text-neutral-500">{source.campaign}</div></td>
            <td className="px-2 py-3 text-right tabular-nums">{source.leadsCaptured}</td>
            <td className="px-2 py-3 text-right tabular-nums"><div>{source.qualifiedLeads}</div><div className="text-xs text-neutral-500">{formatCohortRate(source.qualifiedRate)}</div></td>
            <td className="px-2 py-3 text-right tabular-nums"><div>{source.productInterestLeads}</div><div className="text-xs text-neutral-500">{formatCohortRate(source.productInterestRate)}</div></td>
            <td className="pl-2 py-3 text-right tabular-nums"><div>{source.currentlyConverted}</div><div className="text-xs text-neutral-500">{formatCohortRate(source.convertedRate)}</div></td>
          </tr>)}</tbody>
        </table></div>}
        {cohort.sourceRows.length > 20 && <p className="mt-3 text-xs text-neutral-500">Showing the 20 largest source/campaign cohorts. Download the CSV for all cohorts.</p>}
      </section>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-neutral-900">Scheduled follow-up performance</h2>
        <p className="mt-1 text-xs text-neutral-500">Tasks created in the selected window with a due date. Completion reflects their current state, not whether they were completed on time.</p>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-neutral-50 p-3"><dt className="text-xs text-neutral-500">Scheduled</dt><dd className="mt-1 text-xl font-bold text-mulberry-800">{cohort.followUps.scheduledDuringWindow}</dd></div>
          <div className="rounded-xl bg-neutral-50 p-3"><dt className="text-xs text-neutral-500">Completed</dt><dd className="mt-1 text-xl font-bold text-mulberry-800">{cohort.followUps.completedScheduledTasks}</dd></div>
          <div className="rounded-xl bg-neutral-50 p-3"><dt className="text-xs text-neutral-500">Completion</dt><dd className="mt-1 text-xl font-bold text-mulberry-800">{formatCohortRate(cohort.followUps.completionRate)}</dd></div>
        </dl>
        <Link className="mt-4 inline-flex rounded-full border border-mulberry-200 px-4 py-2 text-sm font-semibold text-mulberry-800 hover:bg-mulberry-50" href="/admin/follow-ups">Review follow-ups</Link>
      </section>

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
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mulberry-100 bg-mulberry-50 p-5">
      <div><p className="font-semibold text-neutral-900">Meeting outcomes</p>
        <p className="mt-1 text-sm text-neutral-600">{attendedMeetings} meetings marked attended during the selected window. A contact may attend more than once.</p></div>
      <Link className="rounded-full bg-mulberry-700 px-4 py-2 text-sm font-semibold text-white hover:bg-mulberry-800" href="/admin/follow-ups">Review follow-ups</Link>
    </div>
  </div>;
}
