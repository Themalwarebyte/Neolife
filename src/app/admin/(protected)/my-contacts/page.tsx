import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactListScope } from "@/lib/contact-intake";
import { ContactIntakeTabs } from "@/components/admin/ContactIntakeTabs";
import { ContactDuplicateScanForm } from "@/components/admin/ContactDuplicateScanForm";
import { displayDuplicateSignals, duplicateReviewPriority } from "@/lib/contact-duplicates";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;
type View = "main" | "archived" | "queue" | "duplicates" | "history";
const PAGE_SIZE = 25;
function single(q: Query, key: string) { return typeof q[key] === "string" ? q[key] : ""; }
function listUrl(view: View, q: string, all: boolean, page: number, reviewed = false) {
  const params = new URLSearchParams({ view });
  if (q) params.set("q", q);
  if (all) params.set("scope", "all");
  if (view === "duplicates" && reviewed) params.set("reviewed", "1");
  if (page > 1) params.set("page", String(page));
  return `/admin/my-contacts?${params.toString()}`;
}

export default async function MyContactsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  const query = await searchParams;
  const view: View = ["main", "archived", "queue", "duplicates", "history"].includes(single(query, "view"))
    ? single(query, "view") as View : "main";
  const all = user.role === "admin" && single(query, "scope") === "all";
  const q = single(query, "q").trim().slice(0, 100);
  const requestedPage = Number(single(query, "page"));
  const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const scope = contactListScope(user.role, user.id, all);
  const isHistory = view === "history";
  const isDuplicates = view === "duplicates";
  const reviewed = isDuplicates && single(query, "reviewed") === "1";
  const state = view === "queue" ? "IMPORTED_QUEUE" : view === "archived" ? "ARCHIVED" : "MAIN";
  const contactWhere: Prisma.ContactWhereInput = {
    ...scope, state,
    ...(q ? { OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { sourceDetail: { contains: q, mode: "insensitive" } },
      { methods: { some: { OR: [
        { value: { contains: q, mode: "insensitive" } },
        { normalizedValue: { contains: q, mode: "insensitive" } },
      ] } } },
    ] } : {}),
  };
  const importWhere: Prisma.ContactImportBatchWhereInput = {
    ...scope,
    ...(q ? { filename: { contains: q, mode: "insensitive" } } : {}),
  };
  const duplicateWhere: Prisma.ContactDuplicateIssueWhereInput = {
    ...scope,
    status: reviewed ? { not: "OPEN" } : "OPEN",
    ...(q ? { OR: [
      { leftContact: { is: { firstName: { contains: q, mode: "insensitive" } } } },
      { leftContact: { is: { lastName: { contains: q, mode: "insensitive" } } } },
      { rightContact: { is: { firstName: { contains: q, mode: "insensitive" } } } },
      { rightContact: { is: { lastName: { contains: q, mode: "insensitive" } } } },
    ] } : {}),
  };
  const total = isDuplicates ? await prisma.contactDuplicateIssue.count({ where: duplicateWhere }) : isHistory
    ? await prisma.contactImportBatch.count({ where: importWhere })
    : await prisma.contact.count({ where: contactWhere });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  const contacts = isDuplicates || isHistory ? [] : await prisma.contact.findMany({
    where: contactWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: {
      id: true, firstName: true, lastName: true, city: true, origin: true,
      consentStatus: true, doNotContact: true, ownerSnapshot: true, createdAt: true,
      importRowNumber: true,
      importBatch: { select: { id: true, filename: true, createdAt: true } },
      methods: { orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }],
        select: { type: true, value: true, isPrimary: true } },
    },
  });
  const issues = !isDuplicates ? [] : await prisma.contactDuplicateIssue.findMany({
    where: duplicateWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    include: {
      leftContact: { select: { firstName: true, lastName: true, state: true, id: true } },
      rightContact: { select: { firstName: true, lastName: true, state: true, id: true } },
    },
  });
  const imports = !isHistory ? [] : await prisma.contactImportBatch.findMany({
    where: importWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: { id: true, filename: true, createdAt: true, completedAt: true, status: true,
      totalRows: true, importedRows: true, invalidRows: true, ownerSnapshot: true },
  });
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">Contact intake · Batch D</p>
        <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">My Contacts</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">Personal contacts are separate from CRM leads. Spreadsheet rows enter a review queue. Approved contacts enter Main only after duplicate checks; no import or review creates a Lead or sends a message.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/my-contacts/import" className="rounded-full border border-mulberry-300 bg-white px-5 py-3 text-sm font-semibold text-mulberry-800 hover:bg-mulberry-50">Import spreadsheet</Link>
        <Link href="/admin/my-contacts/new" className="rounded-full bg-mulberry-700 px-5 py-3 text-sm font-semibold text-white hover:bg-mulberry-800">+ Add contact</Link>
      </div>
    </header>
    <ContactIntakeTabs view={view} scopeAll={all} />
    {!["history", "duplicates"].includes(view) && <div className="flex flex-wrap gap-3 text-xs font-semibold">
      <a href={`/admin/my-contacts/export?view=${view}${all ? "&scope=all" : ""}`} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-mulberry-800">Export {view} (max 1,000)</a>
      <Link href="/admin/my-contacts/follow-ups" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-mulberry-800">Manage contact follow-ups →</Link>
    </div>}
    {user.role === "admin" ? <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-neutral-700">Owner scope:</span>
      <Link href={listUrl(view, q, false, 1, reviewed)} className={`rounded-full px-4 py-2 ${!all ? "bg-mulberry-100 font-semibold text-mulberry-900" : "border border-neutral-200 bg-white text-neutral-700"}`}>My records</Link>
      <Link href={listUrl(view, q, true, 1, reviewed)} className={`rounded-full px-4 py-2 ${all ? "bg-mulberry-100 font-semibold text-mulberry-900" : "border border-neutral-200 bg-white text-neutral-700"}`}>Team oversight</Link>
      {all ? <span className="text-xs text-neutral-500">Team records include imports preserved when accounts are removed.</span> : null}
    </div> : null}

    {isDuplicates ? <section className="space-y-5">
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-bold text-neutral-900">Duplicate Issues — human review</h2>
        <p className="max-w-3xl text-sm leading-6 text-neutral-600">Run a scan to suggest possible matches within each owner’s contacts. Shared phone numbers and matching names are not proof that two records belong to the same person. No automatic merging, queue promotion, Lead creation or messaging occurs.</p>
        <ContactDuplicateScanForm scopeAll={all} />
        <nav className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href={listUrl("duplicates", "", all, 1, false)} className={!reviewed ? "text-mulberry-800 underline" : "text-neutral-600"}>Open issues</Link>
          <Link href={listUrl("duplicates", "", all, 1, true)} className={reviewed ? "text-mulberry-800 underline" : "text-neutral-600"}>Decision history</Link>
        </nav>
      </div>
      <form method="GET" action="/admin/my-contacts" role="search" className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <input type="hidden" name="view" value="duplicates" />
        {all ? <input type="hidden" name="scope" value="all" /> : null}
        {reviewed ? <input type="hidden" name="reviewed" value="1" /> : null}
        <label htmlFor="duplicate-search" className="min-w-[180px] flex-1 text-xs font-semibold text-neutral-700">Search contact names
          <input id="duplicate-search" type="search" name="q" maxLength={100} defaultValue={q} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mulberry-200" />
        </label>
        <button type="submit" className="rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white">Search</button>
        <Link href={listUrl("duplicates", "", all, 1, reviewed)} className="text-sm font-semibold text-mulberry-700 hover:underline">Clear</Link>
      </form>
      <p className="text-sm text-neutral-600">{total} {reviewed ? "reviewed or closed issues" : "open issues"} found.</p>
      {issues.length === 0 ? <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600">No issues found for this view. Scanning identifies possible matches; no record is merged automatically.</p> :
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white"><table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-4 py-3">Contacts</th><th className="px-4 py-3">Signals</th><th className="px-4 py-3">Status</th>{all ? <th className="px-4 py-3">Owner</th> : null}<th className="px-4 py-3">Action</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">{issues.map(issue => <tr key={issue.id}>
            <td className="px-4 py-4 font-semibold text-neutral-900">{issue.leftContact.firstName} {issue.leftContact.lastName || ""} / {issue.rightContact.firstName} {issue.rightContact.lastName || ""}</td>
            <td className="px-4 py-4 text-neutral-700"><div className="font-semibold">{duplicateReviewPriority(issue.signals)} review</div>{displayDuplicateSignals(issue.signals).join("; ") || "Review required"}</td>
            <td className="px-4 py-4 text-neutral-600">{issue.status}</td>
            {all ? <td className="px-4 py-4 text-neutral-600">{issue.ownerSnapshot}</td> : null}
            <td className="px-4 py-4"><Link href={`/admin/my-contacts/duplicates/${issue.id}`} className="font-semibold text-mulberry-700 hover:underline">{issue.status === "OPEN" ? "Review pair" : "View decision"}</Link></td>
          </tr>)}</tbody>
        </table></div>}
      {pages > 1 ? <nav aria-label="Duplicate issue pages" className="flex justify-between text-sm">
        {page > 1 ? <Link href={listUrl("duplicates", q, all, page - 1, reviewed)} className="font-semibold text-mulberry-700 underline">← Previous</Link> : <span />}
        <span>Page {page} of {pages}</span>
        {page < pages ? <Link href={listUrl("duplicates", q, all, page + 1, reviewed)} className="font-semibold text-mulberry-700 underline">Next →</Link> : <span />}
      </nav> : null}
    </section> : <>
      <form method="GET" action="/admin/my-contacts" role="search" className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <input type="hidden" name="view" value={view} />
        {all ? <input type="hidden" name="scope" value="all" /> : null}
        <label htmlFor="contact-search" className="min-w-[180px] flex-1 text-xs font-semibold text-neutral-700">{isHistory ? "Search filename" : "Search name, phone, email or city"}
          <input id="contact-search" type="search" name="q" defaultValue={q} maxLength={100} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm focus:border-mulberry-600 focus:outline-none" />
        </label>
        <button type="submit" className="rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white">Search</button>
        <Link href={listUrl(view, "", all, 1)} className="py-2 text-sm font-semibold text-mulberry-700 hover:underline">Clear</Link>
      </form>
      <p className="text-sm text-neutral-600">{total} {view === "history" ? "import batches" : view === "queue" ? "unreviewed imported contacts" : view === "archived" ? "archived contacts" : "main contacts"} found.</p>
      {view === "queue" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Imported contacts must be reviewed individually. Open a contact to approve or reject it; potential duplicate matches must be resolved first. Review never grants consent or creates a Lead.</p> : null}
      {isHistory ? (imports.length === 0 ? <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-9 text-center text-sm text-neutral-600">No imports found. <Link href="/admin/my-contacts/import" className="font-semibold text-mulberry-800 underline">Import a spreadsheet</Link>.</p> :
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm"><table className="w-full min-w-[660px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600"><tr>
            <th className="px-4 py-3">Source file</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Results</th>{all ? <th className="px-4 py-3">Owner</th> : null}<th className="px-4 py-3">Uploaded</th>
          </tr></thead><tbody className="divide-y divide-neutral-100">{imports.map(batch => <tr key={batch.id}>
            <td className="max-w-[220px] break-words px-4 py-4"><Link href={`/admin/my-contacts/import/${batch.id}`} className="font-semibold text-mulberry-800 hover:underline">{batch.filename}</Link></td>
            <td className="px-4 py-4">{batch.status === "COMPLETE" ? "Imported" : "Awaiting mapping"}</td>
            <td className="px-4 py-4 text-neutral-600">{batch.status === "PREVIEW" ? `${batch.totalRows} rows ready for review` : `${batch.importedRows} imported · ${batch.invalidRows} invalid`}</td>
            {all ? <td className="px-4 py-4 text-neutral-600">{batch.ownerSnapshot}</td> : null}
            <td className="px-4 py-4 text-neutral-600">{batch.createdAt.toLocaleString()}</td>
          </tr>)}</tbody></table></div>) : (contacts.length === 0 ?
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-9 text-center">
          <p className="font-semibold text-neutral-800">No matching contacts</p>
          <p className="mt-2 text-sm text-neutral-600">{view === "queue" ? "Upload a spreadsheet to fill the unreviewed queue." : view === "archived" ? "Archived contacts appear here." : "Create a manual contact to get started."}</p>
        </div> : <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600"><tr>
            <th className="px-4 py-3">Contact</th><th className="px-4 py-3">Phone / email</th><th className="px-4 py-3">Consent</th>
            {all ? <th className="px-4 py-3">Owner</th> : null}<th className="px-4 py-3">Source / date</th>
          </tr></thead><tbody className="divide-y divide-neutral-100">{contacts.map(c => <tr key={c.id} className="hover:bg-neutral-50">
            <td className="px-4 py-4"><Link href={`/admin/my-contacts/${c.id}`} className="font-semibold text-mulberry-800 hover:underline">{c.firstName} {c.lastName || ""}</Link><div className="text-xs text-neutral-500">{c.city || "—"}</div></td>
            <td className="px-4 py-4 text-neutral-700">{c.methods.filter(m => m.isPrimary).map(m => <div key={`${m.type}-${m.value}`}>{m.value}</div>)}
              {c.methods.length > c.methods.filter(m => m.isPrimary).length ? <div className="text-xs text-neutral-500">+{c.methods.length - c.methods.filter(m => m.isPrimary).length} additional methods</div> : null}
            </td>
            <td className="px-4 py-4">{c.doNotContact ? <span className="font-semibold text-red-700">Do Not Contact</span> : <span className="text-neutral-600">{c.consentStatus === "GRANTED" ? "Permission granted" : c.consentStatus === "DENIED" ? "Permission denied" : "Unknown"}</span>}</td>
            {all ? <td className="px-4 py-4 text-neutral-600">{c.ownerSnapshot}</td> : null}
            <td className="px-4 py-4 text-neutral-600"><span className="rounded-full bg-mulberry-50 px-2 py-0.5 text-xs text-mulberry-800">{c.origin === "MANUAL" ? "Manual" : "Imported"}</span>
              {c.importBatch ? <div className="mt-1 max-w-[180px] break-words text-xs"><Link href={`/admin/my-contacts/import/${c.importBatch.id}`} className="font-semibold text-mulberry-800 hover:underline">{c.importBatch.filename}</Link> · row {c.importRowNumber}</div> : null}
              <div className="mt-1 text-xs">{c.createdAt.toLocaleDateString()}</div></td>
          </tr>)}</tbody></table></div>)}
      {pages > 1 ? <nav aria-label="Contact pages" className="flex items-center justify-between text-sm">
        {page > 1 ? <Link href={listUrl(view, q, all, page - 1)} className="font-semibold text-mulberry-800 hover:underline">← Previous</Link> : <span />}
        <span className="text-neutral-600">Page {page} of {pages}</span>
        {page < pages ? <Link href={listUrl(view, q, all, page + 1)} className="font-semibold text-mulberry-800 hover:underline">Next →</Link> : <span />}
      </nav> : null}
    </>}
  </div>;
}
