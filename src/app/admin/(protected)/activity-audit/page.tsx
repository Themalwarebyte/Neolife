import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireAdmin } from "@/server/auth/requireCrmUser";
import { parseActivityAuditFilters, type AuditQuery } from "@/lib/activity-audit";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

function href(filters: ReturnType<typeof parseActivityAuditFilters>, page: number): string {
  const params = new URLSearchParams();
  if (filters.actorId) params.set("actor", filters.actorId);
  if (filters.action) params.set("action", filters.action);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/activity-audit${query ? `?${query}` : ""}`;
}

export default async function ActivityAuditPage({ searchParams }: { searchParams: Promise<AuditQuery> }) {
  await requireAdmin();
  const filters = parseActivityAuditFilters(await searchParams);
  const where = {
    ...(filters.actorId ? { actorUserId: filters.actorId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.outcome ? { outcome: filters.outcome } : {}),
    ...(filters.from || filters.to ? { createdAt: {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      ...(filters.to ? { lt: new Date(new Date(`${filters.to}T00:00:00.000Z`).getTime() + 86400000) } : {}),
    } } : {}),
  };
  const [total, events, users, actionRows] = await Promise.all([
    prisma.activityAuditEvent.count({ where }),
    prisma.activityAuditEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, actorUserId: true, actorSnapshot: true, action: true, entityType: true, entityId: true, entitySnapshot: true, outcome: true, details: true, createdAt: true },
    }),
    prisma.user.findMany({ orderBy: [{ name: "asc" }, { email: "asc" }], take: 500, select: { id: true, name: true, email: true, isActive: true } }),
    prisma.activityAuditEvent.findMany({ distinct: ["action"], orderBy: { action: "asc" }, take: 100, select: { action: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const safeDetails = (details: unknown) => {
    if (!details || typeof details !== "object" || Array.isArray(details)) return "—";
    const allowed = Object.entries(details as Record<string, unknown>).filter(([key, value]) =>
      /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key) && !/(password|pin|secret|token|email|phone|address|contactname|payload)/i.test(key) &&
      ["string", "number", "boolean"].includes(typeof value) && (typeof value !== "string" || value.length <= 120));
    return allowed.length ? JSON.stringify(Object.fromEntries(allowed)).slice(0, 240) : "—";
  };

  return <div className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">Owner oversight</p>
      <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Activity Audit</h1>
      <p className="mt-2 text-sm text-neutral-600">Chronological, read-only activity records for monitored contact workflows. Audit rows cannot be edited here.</p>
    </header>
    <form method="GET" action="/admin/activity-audit" className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-3">
      <label className="text-xs font-semibold text-neutral-700">User
        <select name="actor" defaultValue={filters.actorId} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm">
          <option value="">All users</option>{users.map(user => <option key={user.id} value={user.id}>{user.name} — {user.email}{user.isActive ? "" : " (inactive)"}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-neutral-700">Activity
        <select name="action" defaultValue={filters.action} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"><option value="">All activities</option>{actionRows.map(row => <option key={row.action} value={row.action}>{row.action}</option>)}</select>
      </label>
      <label className="text-xs font-semibold text-neutral-700">Outcome
        <select name="outcome" defaultValue={filters.outcome} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"><option value="">All outcomes</option><option value="SUCCESS">Success</option><option value="PARTIAL">Partial</option><option value="FAILURE">Failure</option></select>
      </label>
      <label className="text-xs font-semibold text-neutral-700">From date<input type="date" name="from" defaultValue={filters.from} className="mt-1 block w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-semibold text-neutral-700">To date<input type="date" name="to" defaultValue={filters.to} className="mt-1 block w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm" /></label>
      <div className="flex items-end gap-3"><button className="rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white">Filter</button><Link href="/admin/activity-audit" className="text-sm font-semibold text-mulberry-700 hover:underline">Clear</Link></div>
    </form>
    <p className="text-sm text-neutral-600">{total} activity records found. Page {page} of {pages}.</p>
    {events.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-600">No activity records match these filters. New monitored activities will appear here.</div> : <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white"><table className="w-full min-w-[1000px] text-left text-sm">
      <thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Safe details</th></tr></thead>
      <tbody className="divide-y divide-neutral-100">{events.map(event => <tr key={event.id}>
        <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{event.createdAt.toLocaleString()}</td>
        <td className="px-4 py-3"><div className="font-semibold text-neutral-900">{event.actorSnapshot}</div><div className="text-xs text-neutral-500">{event.actorUserId ? "Account linked" : "Historical account"}</div></td>
        <td className="px-4 py-3"><div className="font-semibold">{event.action}</div><div className="text-xs text-neutral-500">{event.entityType}</div></td>
        <td className="px-4 py-3 text-neutral-600">{event.entitySnapshot || event.entityType}{event.entityId ? <div className="text-xs text-neutral-400">Reference: {event.entityId.slice(0, 8)}</div> : null}</td>
        <td className="px-4 py-3"><span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold">{event.outcome}</span></td>
        <td className="max-w-[260px] break-words px-4 py-3 text-xs text-neutral-600">{safeDetails(event.details)}</td>
      </tr>)}</tbody></table></div>}
    {pages > 1 ? <nav aria-label="Activity audit pages" className="flex items-center justify-between text-sm"><span>Page {page} of {pages}</span><div className="flex gap-4">{page > 1 ? <Link href={href(filters, page - 1)} className="font-semibold text-mulberry-700 underline">Previous</Link> : <span className="text-neutral-400">Previous</span>}{page < pages ? <Link href={href(filters, page + 1)} className="font-semibold text-mulberry-700 underline">Next</Link> : <span className="text-neutral-400">Next</span>}</div></nav> : null}
  </div>;
}
