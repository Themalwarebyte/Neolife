import Link from "next/link";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { CompleteFollowUpButton } from "@/components/admin/CompleteFollowUpButton";
import { BulkCompleteFollowUpsForm } from "@/components/admin/BulkCompleteFollowUpsForm";
import { RescheduleFollowUpForm } from "@/components/admin/RescheduleFollowUpForm";
import { FOLLOW_UP_PAGE_SIZE, formatCrmStatus, parseFollowUpWindow } from "@/lib/crm-phase2";

export const dynamic = "force-dynamic";

type Query = { view?: string; page?: string };
export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  const { view: rawView, page: rawPage } = await searchParams;
  const view = parseFollowUpWindow(rawView);
  const requestPage = rawPage && /^[1-9]\d{0,4}$/.test(rawPage)
    ? Math.min(Number(rawPage), 10000) : 1;
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 86_400_000);
  const where: Prisma.FollowUpWhereInput = {
    completedAt: null,
    dueAt: view === "overdue"
      ? { lt: now }
      : view === "next7"
        ? { gte: now, lte: nextWeek }
        : { not: null },
    ...(user.role === "admin" ? {} : { lead: { assignedUserId: user.id } }),
  };

  const total = await prisma.followUp.count({ where });
  const pages = Math.max(1, Math.ceil(total / FOLLOW_UP_PAGE_SIZE));
  const page = Math.min(requestPage, pages);
  const tasks = await prisma.followUp.findMany({
    where,
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * FOLLOW_UP_PAGE_SIZE,
    take: FOLLOW_UP_PAGE_SIZE,
    select: {
      id: true, note: true, dueAt: true,
      lead: {
        select: {
          id: true, firstName: true, lastName: true, status: true,
          assignedUser: { select: { name: true } },
        },
      },
    },
  });

  const filters = [
    { id: "all", label: "All outstanding" },
    { id: "overdue", label: "Overdue" },
    { id: "next7", label: "Next 7 days" },
  ] as const;
  const href = (v: string, p = 1) => `/admin/follow-ups?view=${v}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">CRM workflow</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">Follow-up queue</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {user.role === "admin" ? "Scheduled tasks across the office." : "Tasks on contacts currently assigned to you."}
          {" "}Notes without a due date are kept on their contact records.
        </p>
      </header>
      <nav aria-label="Follow-up task filters" className="flex flex-wrap gap-2">
        {filters.map((f) => <Link key={f.id} href={href(f.id)} aria-current={view === f.id ? "page" : undefined}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${view === f.id ? "bg-mulberry-700 text-white" : "border border-mulberry-200 bg-white text-mulberry-800 hover:bg-mulberry-50"}`}>
          {f.label}
        </Link>)}
      </nav>
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4 text-sm text-neutral-600">
          <strong className="text-neutral-900">{total}</strong> outstanding task{total === 1 ? "" : "s"} in this view
          {tasks.length > 0 && <div className="mt-3"><BulkCompleteFollowUpsForm /></div>}
        </div>
        {tasks.length === 0 ? (
          <div className="px-6 py-12 text-center text-neutral-600">
            <p className="font-semibold text-neutral-800">No scheduled follow-ups in this view.</p>
            <p className="mt-1 text-sm">Open a contact and schedule its next follow-up.</p>
            <Link href="/admin/leads" className="mt-4 inline-block text-sm font-semibold text-mulberry-700 hover:underline">Go to contacts →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {tasks.map((task) => {
              const overdue = !!task.dueAt && task.dueAt.getTime() < now.getTime();
              return <li key={task.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                <input form="phase28-bulk-follow-ups" type="checkbox" name="followUpIds" value={task.id}
                  aria-label={`Select follow-up for ${task.lead.firstName} ${task.lead.lastName ?? ""}`}
                  className="h-4 w-4 accent-mulberry-700" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/leads/${task.lead.id}`} className="font-semibold text-mulberry-800 hover:underline">
                      {task.lead.firstName} {task.lead.lastName ?? ""}
                    </Link>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{formatCrmStatus(task.lead.status)}</span>
                    {overdue && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">Overdue</span>}
                  </div>
                  <p className="mt-1 break-words text-sm text-neutral-700">{task.note}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Due {task.dueAt?.toLocaleString() ?? "—"}
                    {user.role === "admin" && task.lead.assignedUser ? ` · ${task.lead.assignedUser.name}` : ""}
                    {user.role === "admin" && !task.lead.assignedUser ? " · Unassigned" : ""}
                  </p>
                </div>
                <div className="col-start-2 flex flex-wrap items-center justify-between gap-3">
                  {task.dueAt && <RescheduleFollowUpForm id={task.id} dueAtIso={task.dueAt.toISOString()} />}
                  <CompleteFollowUpButton id={task.id} />
                </div>
              </li>;
            })}
          </ul>
        )}
      </section>
      {pages > 1 && <div className="flex items-center justify-between gap-4 text-sm">
        {page > 1 ? <Link className="font-semibold text-mulberry-800 hover:underline" href={href(view,page - 1)}>← Previous</Link> : <span />}
        <span className="text-neutral-500">Page {page} of {pages}</span>
        {page < pages ? <Link className="font-semibold text-mulberry-800 hover:underline" href={href(view,page + 1)}>Next →</Link> : <span />}
      </div>}
    </div>
  );
}
