import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactListScope } from "@/lib/contact-intake";
import { mayScheduleOutreach } from "@/lib/contact-processing";
import { ContactIntakeTabs } from "@/components/admin/ContactIntakeTabs";
import { ContactFollowUpUpdateForms } from "@/components/admin/ContactFollowUpUpdateForms";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
type Search = Record<string, string | string[] | undefined>;
const single = (q: Search, key: string) => typeof q[key] === "string" ? q[key] as string : "";

export default async function ContactFollowUpsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireCrmUser();
  const query = await searchParams;
  const all = user.role === "admin" && single(query, "scope") === "all";
  const filter = ["open", "overdue", "next7", "completed"].includes(single(query, "view")) ? single(query, "view") : "open";
  const requestedPage = Number(single(query, "page"));
  const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86_400_000);
  const where: Prisma.ContactFollowUpWhereInput = {
    contact: { is: contactListScope(user.role, user.id, all) },
    status: filter === "completed" ? { in: ["COMPLETED", "CANCELLED"] } : "OPEN",
    ...(filter === "overdue" ? { dueAt: { lt: now } } : filter === "next7" ? { dueAt: { gte: now, lte: week } } : {}),
  };
  const total = await prisma.contactFollowUp.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  const tasks = await prisma.contactFollowUp.findMany({
    where, orderBy: filter === "completed" ? [{ resolvedAt: "desc" }, { id: "desc" }] : [{ dueAt: "asc" }, { id: "asc" }],
    take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE,
    include: { contact: { select: {
      id: true, firstName: true, lastName: true, state: true, ownerSnapshot: true,
      consentStatus: true, consentEvidence: true, consentUpdatedAt: true, doNotContact: true,
    } } },
  });
  const href = (v: string, p = 1, scopeAll = all) => `/admin/my-contacts/follow-ups?view=${v}${scopeAll ? "&scope=all" : ""}${p > 1 ? `&page=${p}` : ""}`;
  const filters = [
    { key: "open", label: "All outstanding" }, { key: "overdue", label: "Overdue" },
    { key: "next7", label: "Next 7 days" }, { key: "completed", label: "Completed / cancelled" },
  ];
  return <div className="space-y-6">
    <header>
      <Link href="/admin/my-contacts" className="text-sm font-semibold text-mulberry-700 hover:underline">← My Contacts</Link>
      <h1 className="mt-2 text-2xl font-extrabold text-neutral-900">Contact follow-ups</h1>
      <p className="mt-1 text-sm text-neutral-600">Personal-contact tasks are separate from CRM Lead follow-ups. Scheduling never sends messages.</p>
    </header>
    <ContactIntakeTabs view="follow-ups" scopeAll={all} role={user.role} />
    {user.role === "admin" && <nav aria-label="Owner scope" className="flex gap-4 text-sm">
      <Link href={href(filter, 1, false)} className={!all ? "font-bold text-mulberry-800 underline" : "text-neutral-700"}>My tasks</Link>
      <Link href={href(filter, 1, true)} className={all ? "font-bold text-mulberry-800 underline" : "text-neutral-700"}>Team oversight</Link>
    </nav>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Task filters" className="flex flex-wrap gap-2">{filters.map(f => <Link key={f.key} href={href(f.key)} aria-current={filter === f.key ? "page" : undefined}
        className={`rounded-full px-4 py-2 text-xs font-semibold ${filter === f.key ? "bg-mulberry-700 text-white" : "border border-neutral-200 text-mulberry-800"}`}>{f.label}</Link>)}</nav>
      <a href={`/admin/my-contacts/export?view=followups${all ? "&scope=all" : ""}`} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-mulberry-800">Export task history (max 1,000)</a>
    </div>
    <p className="text-sm text-neutral-600">{total} matching tasks</p>
    {tasks.length === 0 ? <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600">No tasks in this view. Open a Main Contact to schedule one.</p> :
      <ul className="space-y-4">{tasks.map(task => {
        const canUpdate = task.kind === "INTERNAL" ? task.contact.state === "MAIN" : mayScheduleOutreach(task.contact);
        return <li key={task.id} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap justify-between gap-3 text-sm">
            <div><Link href={`/admin/my-contacts/${task.contact.id}`} className="font-bold text-mulberry-800 hover:underline">{task.contact.firstName} {task.contact.lastName || ""}</Link>
              <p className="mt-1 text-xs text-neutral-500">{task.kind} · {task.status} · Due {task.dueAt.toLocaleString()}{all ? ` · Owner: ${task.contact.ownerSnapshot}` : ""}</p></div>
            {task.status === "OPEN" && task.dueAt < now && <span className="text-xs font-semibold text-rose-700">Overdue</span>}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-neutral-700">{task.note}</p>
          {task.resolutionNote && <p className="text-xs text-neutral-600">Outcome: {task.resolutionNote}</p>}
          {task.status === "OPEN" && <ContactFollowUpUpdateForms taskId={task.id} version={task.version} allowOutreachUpdate={canUpdate} />}
        </li>;
      })}</ul>}
    {pages > 1 && <nav aria-label="Follow-up pages" className="flex justify-between text-sm">
      {page > 1 ? <Link href={href(filter, page - 1)} className="font-semibold text-mulberry-800">← Previous</Link> : <span />}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={href(filter, page + 1)} className="font-semibold text-mulberry-800">Next →</Link> : <span />}
    </nav>}
  </div>;
}
