import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { formatCrmStatus } from "@/lib/crm-phase2";
import { parseCrmPage, parseQualificationQueueView } from "@/lib/qualification-review";
import { MarkQualificationReviewedButton } from "@/components/admin/MarkQualificationReviewedButton";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

type Query = { view?: string | string[]; page?: string | string[] };

function tabHref(view: string): string {
  return `/admin/qualification?view=${encodeURIComponent(view)}`;
}

export default async function QualificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const user = await requireCrmUser();
  const params = await searchParams;
  const view = parseQualificationQueueView(params.view);
  const requestedPage = parseCrmPage(params.page);

  const baseWhere: Prisma.LeadWhereInput = {
    status: "QUALIFIED",
    ...(user.role === "admin" ? {} : { assignedUserId: user.id }),
  };
  const viewWhere: Prisma.LeadWhereInput = view === "needs-review"
    ? { events: { none: { type: "qualification_reviewed" } } }
    : view === "reviewed"
      ? { events: { some: { type: "qualification_reviewed" } } }
      : {};
  const where: Prisma.LeadWhereInput = { AND: [baseWhere, viewWhere] };

  const [allCount, needsReviewCount, reviewedCount, total] = await Promise.all([
    prisma.lead.count({ where: baseWhere }),
    prisma.lead.count({ where: { AND: [baseWhere, { events: { none: { type: "qualification_reviewed" } } }] } }),
    prisma.lead.count({ where: { AND: [baseWhere, { events: { some: { type: "qualification_reviewed" } } }] } }),
    prisma.lead.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const leads = await prisma.lead.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      city: true,
      interestType: true,
      qualificationNotes: true,
      assignedUser: { select: { name: true } },
      createdAt: true,
      events: {
        where: { type: "qualification_reviewed" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, user: { select: { name: true } } },
      },
    },
  });

  const tabs = [
    { value: "needs-review", label: "Needs review", count: needsReviewCount },
    { value: "reviewed", label: "Reviewed", count: reviewedCount },
    { value: "all", label: "All qualified", count: allCount },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">Conversion workflow</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">Qualification review</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Review prospects who completed qualification, record that the office has reviewed their answers, and open the contact record for the next action.
            {user.role === "admin" ? " You are viewing office-wide qualified contacts." : " You are viewing only contacts assigned to you."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/triage?view=review" className="rounded-full border border-mulberry-200 bg-white px-4 py-2 text-sm font-semibold text-mulberry-800 hover:bg-mulberry-50">Attention queue</Link>
          <Link href="/admin/leads" className="rounded-full border border-mulberry-200 bg-white px-4 py-2 text-sm font-semibold text-mulberry-800 hover:bg-mulberry-50">All contacts</Link>
        </div>
      </header>

      <nav aria-label="Qualification review filters" className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={tabHref(tab.value)}
            aria-current={view === tab.value ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${view === tab.value ? "bg-mulberry-700 text-white" : "border border-mulberry-200 bg-white text-mulberry-800 hover:bg-mulberry-50"}`}
          >
            {tab.label} <span className={view === tab.value ? "text-mulberry-100" : "text-neutral-500"}>({tab.count})</span>
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-neutral-900">Nothing to review here</h2>
          <p className="mt-2 text-sm text-neutral-600">Qualified contacts will appear here after they submit the qualification form.</p>
        </section>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const review = lead.events[0];
            return (
              <article key={lead.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-neutral-900">{lead.firstName} {lead.lastName ?? ""}</h2>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{formatCrmStatus("QUALIFIED")}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{lead.phone}{lead.email ? ` · ${lead.email}` : ""}</p>
                    <p className="mt-1 text-xs text-neutral-500">{lead.city || "Area not provided"} · Interest: {formatCrmStatus(lead.interestType)} · Assigned to: {lead.assignedUser?.name ?? "Unassigned"}</p>
                    {lead.qualificationNotes ? (
                      <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Prospect's answers</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-700">{lead.qualificationNotes}</p>
                      </div>
                    ) : <p className="mt-3 text-sm italic text-neutral-500">No qualification notes provided.</p>}
                    {review ? <p className="mt-3 text-xs text-emerald-700">Reviewed {review.createdAt.toLocaleString("en-GB")} by {review.user?.name ?? "an office user"}.</p> : null}
                  </div>
                  <div className="flex min-w-36 flex-col items-start gap-3 sm:items-end">
                    <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-mulberry-800 hover:underline">Open contact →</Link>
                    {!review ? <MarkQualificationReviewedButton leadId={lead.id} /> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Qualification queue pages" className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? <Link href={`${tabHref(view)}&page=${page - 1}`} className="font-semibold text-mulberry-800 hover:underline">← Previous</Link> : <span />}
          <span className="text-neutral-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={`${tabHref(view)}&page=${page + 1}`} className="font-semibold text-mulberry-800 hover:underline">Next →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
