import Link from "next/link";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";
import { BulkUnassignedLeadForm } from "@/components/admin/BulkUnassignedLeadForm";
import { formatCrmStatus, CRM_PAGE_SIZE } from "@/lib/crm-phase2";
import { MAX_WORKFLOW_BATCH } from "@/lib/crm-workflows";
import { buildTriageWhere } from "@/lib/crm-triage";
import { LeadStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type Query = { page?: string };

export default async function WorkflowsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  const isOwner = user.role === "admin";
  const params = await searchParams;
  const requestedPage = params.page && /^[1-9]\d{0,4}$/.test(params.page)
    ? Math.min(Number(params.page), 10000) : 1;
  const now = new Date();
  const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const leadScope: Prisma.LeadWhereInput = isOwner ? {} : { assignedUserId: user.id };
  const taskScope: Prisma.FollowUpWhereInput = isOwner ? {} : { lead: { assignedUserId: user.id } };

  // Derived from current records, with no new business eligibility thresholds or
  // automatic status changes. Staff never see another Staff user's records.
  const [visibleContacts, overdue, dueSoon, pendingReview, unassignedCount, attentionCount] = await Promise.all([
    prisma.lead.count({ where: leadScope }),
    prisma.followUp.count({ where: { ...taskScope, completedAt: null, dueAt: { lt: now } } }),
    prisma.followUp.count({ where: { ...taskScope, completedAt: null, dueAt: { gte: now, lte: next7 } } }),
    prisma.lead.count({ where: {
      ...leadScope, status: LeadStatus.QUALIFIED,
      events: { none: { type: "qualification_reviewed" } },
    } }),
    isOwner ? prisma.lead.count({ where: { assignedUserId: null } }) : Promise.resolve(0),
    prisma.lead.count({ where: buildTriageWhere(user, "all", 7, now) }),
  ]);

  const pages = Math.max(1, Math.ceil(unassignedCount / CRM_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  type UnassignedContact = {
    id: string; firstName: string; lastName: string | null;
    status: LeadStatus; createdAt: Date;
  };
  let unassigned: UnassignedContact[] = [];
  let staff: { id: string; name: string }[] = [];
  if (isOwner) {
    [unassigned, staff] = await Promise.all([
      prisma.lead.findMany({
        where: { assignedUserId: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * CRM_PAGE_SIZE,
        take: Math.min(CRM_PAGE_SIZE, MAX_WORKFLOW_BATCH),
        select: { id: true, firstName: true, lastName: true, status: true, createdAt: true },
      }),
      prisma.user.findMany({
        where: { role: "staff", isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
  }

  const figures = [
    { label: "Needs office attention", value: attentionCount, href: "/admin/triage?view=all&days=7", note: "Unique contacts with operational attention signals" },
    { label: isOwner ? "Office contacts" : "My assigned contacts", value: visibleContacts, href: "/admin/leads", note: "Currently visible to you" },
    { label: "Overdue follow-ups", value: overdue, href: "/admin/follow-ups?view=overdue", note: "Open scheduled tasks past due" },
    { label: "Due within 7 days", value: dueSoon, href: "/admin/follow-ups?view=next7", note: "Open scheduled tasks due soon" },
    { label: "Qualification reviews", value: pendingReview, href: "/admin/qualification?view=needs-review", note: "Qualified leads without a review event" },
    ...(isOwner ? [{ label: "Unassigned contacts", value: unassignedCount, href: "#unassigned", note: "Waiting for manual Owner assignment" }] : []),
  ];

  return <div className="space-y-7">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">Phase 28 · Office operations</p>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">Workflow workspace</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600">
        Live CRM workload from assigned contacts, qualification reviews and scheduled tasks.
        No prospects are automatically reassigned and no emails are sent by this workspace.
        Visit the <Link href="/admin/triage" className="font-semibold text-mulberry-700 hover:underline">attention queue</Link> for fact-based next-action suggestions.
      </p>
    </header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {figures.map(item => <Link key={item.label} href={item.href}
        className="rounded-2xl border border-mulberry-100 bg-white p-5 shadow-sm transition hover:border-mulberry-300 hover:shadow-md">
        <p className="text-sm font-semibold text-neutral-700">{item.label}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-mulberry-800">{item.value}</p>
        <p className="mt-2 text-xs text-neutral-500">{item.note}</p>
      </Link>)}
    </div>

    {isOwner ? <section id="unassigned" aria-labelledby="unassigned-heading"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="space-y-1 border-b border-neutral-100 px-5 py-5">
        <h2 id="unassigned-heading" className="text-lg font-bold text-neutral-900">Unassigned contact queue</h2>
        <p className="text-sm text-neutral-600">
          {unassignedCount} unassigned contact(s). Select up to {MAX_WORKFLOW_BATCH} contacts on this page, then explicitly assign them to an active Staff member.
          Existing assignments are protected from accidental replacement.
        </p>
      </header>
      {unassigned.length ? <>
        <div className="divide-y divide-neutral-100">
          {unassigned.map(lead => <div key={lead.id} className="flex items-start gap-3 px-5 py-3 hover:bg-mulberry-50/40">
            <input form="phase28-bulk-assign" type="checkbox" id={`phase28-select-${lead.id}`} name="leadIds" value={lead.id}
              aria-label={`Select ${lead.firstName} ${lead.lastName ?? ""}`}
              className="mt-1 h-4 w-4 accent-mulberry-700" />
            <span className="min-w-0 flex-1">
              <label htmlFor={`phase28-select-${lead.id}`} className="cursor-pointer font-semibold text-neutral-900">{lead.firstName} {lead.lastName ?? ""}</label>
              <span className="ml-2 text-xs text-neutral-500">{formatCrmStatus(lead.status)}</span>
              <span className="block text-xs text-neutral-500">Created {lead.createdAt.toLocaleDateString()}</span>
              <Link href={`/admin/leads/${lead.id}`} className="text-xs font-semibold text-mulberry-700 hover:underline">View contact record</Link>
            </span>
          </div>)}
        </div>
        <div className="border-t border-neutral-100 p-5">
          <BulkUnassignedLeadForm staff={staff} />
        </div>
      </> : <p className="px-5 py-8 text-sm text-neutral-600">No unassigned contacts in this queue.</p>}
      {pages > 1 && <nav aria-label="Unassigned contact pages" className="flex justify-between border-t border-neutral-100 px-5 py-4 text-sm">
        {page > 1 ? <Link className="font-semibold text-mulberry-700 hover:underline" href={`?page=${page - 1}#unassigned`}>← Previous</Link> : <span />}
        <span className="text-neutral-500">Page {page} of {pages}</span>
        {page < pages ? <Link className="font-semibold text-mulberry-700 hover:underline" href={`?page=${page + 1}#unassigned`}>Next →</Link> : <span />}
      </nav>}
    </section> : <p className="rounded-2xl border border-mulberry-100 bg-mulberry-50 px-5 py-4 text-sm text-mulberry-900">
      Contact assignment is Owner-managed. This workspace shows only contacts and tasks assigned to you.
    </p>}
  </div>;
}
