import Link from "next/link";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";
import { formatCrmStatus, percentOf } from "@/lib/crm-phase2";

export const dynamic = "force-dynamic";

function Metric({ label, value, detail }: {label:string; value:string | number; detail:string}) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
    <dt className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</dt>
    <dd className="mt-2 text-3xl font-bold tabular-nums text-mulberry-800">{value}</dd>
    <p className="mt-1 text-xs text-neutral-500">{detail}</p>
  </div>;
}

export default async function AnalyticsPage() {
  const user = await requireCrmUser();
  // Staff analytics must NEVER include leads owned by another user, even in groupBy.
  const scope = user.role === "admin" ? {} : { assignedUserId: user.id };
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const [total, last30, stages, sources, attendedMeetings, outstandingFollowUps, overdueFollowUps] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: since30 } } }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["firstTouchSource"], where: scope, _count: { _all: true } }),
    prisma.meeting.count({ where: { status: "ATTENDED", lead: scope } }),
    prisma.followUp.count({ where: { dueAt: { not: null }, completedAt: null, lead: scope } }),
    prisma.followUp.count({ where: { dueAt: { lt: now }, completedAt: null, lead: scope } }),
  ]);
  const rows = stages.map(s => ({ label: formatCrmStatus(s.status), count: s._count._all }))
    .sort((a,b) => b.count-a.count);
  const sourcesSorted = sources.map(s => ({ label: s.firstTouchSource || "Direct / unknown", count: s._count._all }))
    .sort((a,b)=>b.count-a.count).slice(0,10);
  const converted = stages.find(s => s.status === "CONVERTED")?._count._all ?? 0;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">CRM performance</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">Pipeline insights</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {user.role === "admin" ? "Office-wide contact outcomes." : "Only contacts assigned to you."}
          {" "}All metrics are current CRM snapshots, not ad-platform attribution or sales revenue.
        </p>
      </div>
      <Link href="/admin/leads" className="text-sm font-semibold text-mulberry-700 hover:underline">Explore contacts →</Link>
    </header>
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Contacts" value={total} detail="All contact records in your authorized scope" />
      <Metric label="New in 30 days" value={last30} detail="Created within the rolling last 30 days" />
      <Metric label="Converted" value={percentOf(converted,total)} detail={`${converted} currently in Converted status out of ${total}`} />
      <Metric label="Overdue follow-ups" value={overdueFollowUps} detail={`${outstandingFollowUps} scheduled tasks remain outstanding`} />
    </dl>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-neutral-900">Current pipeline status</h2>
        <p className="mt-1 text-xs text-neutral-500">Each contact counts once in its current status; these are not sequential conversion events.</p>
        {rows.length === 0 ? <p className="mt-6 text-sm text-neutral-500">No CRM contacts yet.</p> : <ul className="mt-5 space-y-3">
          {rows.map(row => <li key={row.label}>
            <div className="mb-1 flex justify-between gap-2 text-sm"><span className="text-neutral-700">{row.label}</span><span className="font-semibold tabular-nums text-neutral-800">{row.count} · {percentOf(row.count,total)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-mulberry-600" style={{width:`${total ? row.count/total*100 : 0}%`}} /></div>
          </li>)}
        </ul>}
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-neutral-900">First-touch lead sources</h2>
        <p className="mt-1 text-xs text-neutral-500">Lead counts grouped by captured first-touch source. Blank sources are unknown.</p>
        {sourcesSorted.length === 0 ? <p className="mt-6 text-sm text-neutral-500">No source data yet.</p> : <ul className="mt-5 divide-y divide-neutral-100">
          {sourcesSorted.map((source,index) => <li key={`${source.label}-${index}`} className="flex justify-between gap-3 py-2.5 text-sm">
            <span className="min-w-0 break-words text-neutral-700">{source.label}</span>
            <strong className="shrink-0 tabular-nums text-mulberry-800">{source.count}</strong>
          </li>)}
        </ul>}
      </section>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mulberry-100 bg-mulberry-50 p-5">
      <div><p className="font-semibold text-neutral-900">Meeting outcomes</p>
        <p className="mt-1 text-sm text-neutral-600">{attendedMeetings} meetings currently marked attended. This is a meeting count; a contact may attend more than once.</p></div>
      <Link className="rounded-full bg-mulberry-700 px-4 py-2 text-sm font-semibold text-white hover:bg-mulberry-800" href="/admin/follow-ups">Review follow-ups</Link>
    </div>
  </div>;
}
