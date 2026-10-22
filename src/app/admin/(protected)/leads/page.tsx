import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { Prisma, LeadStatus, InterestType } from "@/generated/prisma/client";
import {
  CRM_PAGE_SIZE, CRM_INTERESTS, formatCrmStatus, leadQueryString,
  parseLeadFilters,
} from "@/lib/crm-phase2";
import { VALID_LEAD_STATUSES } from "@/lib/leadManagement";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const INTEREST_LABELS: Record<string, string> = {
  BUSINESS: "Business", PRODUCT: "Product", BOTH: "Business + Product", UNSURE: "Unsure",
};

function StatusPill({ status }: { status: string }) {
  const cls = status === "CONVERTED" ? "bg-emerald-100 text-emerald-800"
    : status === "DISQUALIFIED" || status === "NOT_INTERESTED" ? "bg-neutral-200 text-neutral-600"
      : "bg-mulberry-100 text-mulberry-800";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
    {formatCrmStatus(status)}
  </span>;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  const isOwner = user.role === "admin";
  const filters = parseLeadFilters(await searchParams, isOwner);
  const staff = isOwner ? await prisma.user.findMany({
    where: { role: "staff", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  }) : [];

  const conditions: Prisma.LeadWhereInput[] = [];
  // Authorization is enforced by the database predicate, not merely the UI.
  if (!isOwner) conditions.push({ assignedUserId: user.id });
  if (isOwner && filters.assignment === "unassigned") conditions.push({ assignedUserId: null });
  if (isOwner && staff.some(s => s.id === filters.assignment)) {
    conditions.push({ assignedUserId: filters.assignment });
  }
  if (filters.status) conditions.push({ status: filters.status as LeadStatus });
  if (filters.interest) conditions.push({ interestType: filters.interest as InterestType });
  if (filters.q) conditions.push({ OR: [
    { firstName: { contains: filters.q, mode: "insensitive" } },
    { lastName: { contains: filters.q, mode: "insensitive" } },
    { phone: { contains: filters.q, mode: "insensitive" } },
    { email: { contains: filters.q, mode: "insensitive" } },
    { city: { contains: filters.q, mode: "insensitive" } },
  ] });
  const where: Prisma.LeadWhereInput = conditions.length ? { AND: conditions } : {};

  const total = await prisma.lead.count({ where });
  const pages = Math.max(1, Math.ceil(total / CRM_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const leads = await prisma.lead.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: CRM_PAGE_SIZE,
    skip: (page - 1) * CRM_PAGE_SIZE,
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      email: true, city: true, interestType: true, status: true,
      assignedUserId: true, assignedUser: { select: { name: true } },
      referredByName: true, referredBySnapshot: true,
      createdAt: true, utmSource: true, utmCampaign: true,
      _count: { select: { meetings: true, followUps: true } },
    },
  });

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">Lead management</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">{isOwner ? "Office lead pipeline" : "My assigned leads"}</h1>
        <p className="mt-1 text-sm text-neutral-500">{total} matching lead{total === 1 ? "" : "s"}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/admin/follow-ups" className="rounded-full border border-mulberry-200 bg-white px-4 py-2 text-sm font-semibold text-mulberry-800 hover:bg-mulberry-50">Follow-ups</Link>
        <Link href="/admin/analytics" className="rounded-full border border-mulberry-200 bg-white px-4 py-2 text-sm font-semibold text-mulberry-800 hover:bg-mulberry-50">Insights</Link>
        <NotificationBell />
      </div>
    </header>

    <form action="/admin/leads" method="GET" role="search" className="grid gap-3 rounded-2xl border border-mulberry-100 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
      <div className="sm:col-span-2 xl:col-span-2">
        <label htmlFor="lead-search" className="block text-xs font-semibold text-neutral-700">Search contacts</label>
        <input id="lead-search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Name, phone, email or city"
          className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:border-mulberry-600 focus:outline-none focus:ring-2 focus:ring-mulberry-200" />
      </div>
      <div>
        <label htmlFor="lead-status" className="block text-xs font-semibold text-neutral-700">Status</label>
        <select id="lead-status" name="status" defaultValue={filters.status} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm">
          <option value="">All stages</option>
          {VALID_LEAD_STATUSES.map(status => <option key={status} value={status}>{formatCrmStatus(status)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="lead-interest" className="block text-xs font-semibold text-neutral-700">Interest</label>
        <select id="lead-interest" name="interest" defaultValue={filters.interest} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm">
          <option value="">All interests</option>
          {CRM_INTERESTS.map(value => <option key={value} value={value}>{INTEREST_LABELS[value]}</option>)}
        </select>
      </div>
      {isOwner && <div>
        <label htmlFor="lead-assignment" className="block text-xs font-semibold text-neutral-700">Assigned to</label>
        <select id="lead-assignment" name="assignment" defaultValue={filters.assignment} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm">
          <option value="all">All contacts</option>
          <option value="unassigned">Unassigned</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>}
      <div className="flex items-end gap-3 xl:col-span-5">
        <button type="submit" className="rounded-full bg-mulberry-700 px-5 py-2 text-sm font-semibold text-white hover:bg-mulberry-800">Apply filters</button>
        <Link href="/admin/leads" className="px-2 py-2 text-sm font-semibold text-neutral-600 hover:underline">Clear filters</Link>
      </div>
    </form>

    {leads.length === 0 ? <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
      <p className="font-semibold text-neutral-800">No matching contacts</p>
      <p className="mt-1 text-sm text-neutral-500">Try different filters or wait for new registrations.</p>
    </div> : <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr>
            <th scope="col" className="px-4 py-3">Name</th><th scope="col" className="px-4 py-3">Contact</th>
            <th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Interest</th>
            <th scope="col" className="px-4 py-3">Assignee</th><th scope="col" className="px-4 py-3">Source</th>
            {isOwner && <th scope="col" className="px-4 py-3">Original referrer</th>}
            <th scope="col" className="px-4 py-3">Created</th><th scope="col" className="px-4 py-3">Activity</th>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">{leads.map(lead => <tr key={lead.id} className="hover:bg-neutral-50">
            <td className="px-4 py-3"><Link href={`/admin/leads/${lead.id}`} className="font-semibold text-neutral-900 hover:text-mulberry-700">{lead.firstName} {lead.lastName ?? ""}</Link></td>
            <td className="px-4 py-3 text-neutral-700"><div>{lead.phone}</div>{lead.email && <div className="text-xs text-neutral-500">{lead.email}</div>}</td>
            <td className="px-4 py-3"><StatusPill status={lead.status}/></td>
            <td className="px-4 py-3 text-neutral-700">{INTEREST_LABELS[lead.interestType]}{lead.city && <div className="text-xs text-neutral-500">{lead.city}</div>}</td>
            <td className="px-4 py-3 text-neutral-700">{lead.assignedUser?.name ?? (isOwner ? "Unassigned" : "You")}</td>
            <td className="px-4 py-3 text-neutral-700">{lead.utmSource ?? "—"}{lead.utmCampaign && <div className="text-xs text-neutral-500">{lead.utmCampaign}</div>}</td>
            {isOwner && <td className="px-4 py-3 text-neutral-700">{lead.referredByName ?? lead.referredBySnapshot ?? "—"}</td>}
            <td className="px-4 py-3 text-neutral-600">{lead.createdAt.toLocaleDateString()}</td>
            <td className="px-4 py-3 text-neutral-600">{lead._count.meetings} meeting(s)<br/>{lead._count.followUps} follow-up(s)</td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="divide-y divide-neutral-100 lg:hidden">{leads.map(lead => <li key={lead.id} className="p-4">
        <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-mulberry-800 hover:underline">{lead.firstName} {lead.lastName ?? ""}</Link>
        <p className="mt-1 text-sm text-neutral-600">{lead.phone}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2"><StatusPill status={lead.status}/><span className="text-xs text-neutral-500">{lead.utmSource ?? "Source unknown"}</span></div>
        <p className="mt-2 text-xs text-neutral-500">{lead.assignedUser?.name ?? "Unassigned"} · {lead.createdAt.toLocaleDateString()}</p>
      </li>)}</ul>
    </div>}

    {pages > 1 && <nav aria-label="Contact pages" className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? <Link href={leadQueryString(filters,page-1)} className="font-semibold text-mulberry-800 hover:underline">← Previous</Link> : <span/>}
      <span className="text-neutral-500">Page {page} of {pages}</span>
      {page < pages ? <Link href={leadQueryString(filters,page+1)} className="font-semibold text-mulberry-800 hover:underline">Next →</Link> : <span/>}
    </nav>}
  </div>;
}
