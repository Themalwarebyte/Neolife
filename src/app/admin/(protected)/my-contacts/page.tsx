import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactListScope } from "@/lib/contact-intake";
import { ContactIntakeTabs, type ContactView } from "@/components/admin/ContactIntakeTabs";
import { ContactBulkForm } from "@/components/admin/ContactBulkForm";
import { ContactTransferDecisionForm } from "@/components/admin/ContactTransferDecisionForm";
import { ContactTransferAdminResolutionForm } from "@/components/admin/ContactTransferAdminResolutionForm";
import { ContactDuplicateScanForm } from "@/components/admin/ContactDuplicateScanForm";
import { displayDuplicateSignals, duplicateReviewPriority } from "@/lib/contact-duplicates";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;
type View = "main" | "archived" | "queue" | "duplicates" | "history" | "pool" | "transfers";
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
  const view: View = ["main", "archived", "queue", "duplicates", "history", "pool", "transfers"].includes(single(query, "view"))
    ? single(query, "view") as View : "main";
  if ((view === "pool" || view === "transfers") && user.role !== "admin") notFound();
  const all = user.role === "admin" && single(query, "scope") === "all";
  const q = single(query, "q").trim().slice(0, 100);
  const requestedPage = Number(single(query, "page"));
  const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const scope = contactListScope(user.role, user.id, all);
  const isHistory = view === "history";
  const isDuplicates = view === "duplicates";
  const isTransfers = view === "transfers";
  const isPool = view === "pool";
  const reviewed = isDuplicates && single(query, "reviewed") === "1";
  const state = view === "queue" ? "IMPORTED_QUEUE" : view === "archived" ? "ARCHIVED" : isPool ? "CONTACT_POOL" : "MAIN";
  const contactWhere: Prisma.ContactWhereInput = {
    ...(isPool ? { ownerUserId: null } : scope), state,
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
  const transferWhere: Prisma.ContactTransferWhereInput = {
    ...(user.role === "admin" ? {} : { requestedByUserId: user.id }),
    ...(q ? { OR: [
      { contact: { is: { firstName: { contains: q, mode: "insensitive" } } } },
      { contact: { is: { lastName: { contains: q, mode: "insensitive" } } } },
      { recipientSnapshot: { contains: q, mode: "insensitive" } },
      { sourceOwnerSnapshot: { contains: q, mode: "insensitive" } },
    ] } : {}),
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
    : isTransfers ? await prisma.contactTransfer.count({ where: transferWhere })
    : await prisma.contact.count({ where: contactWhere });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  const contacts = isDuplicates || isHistory || isTransfers ? [] : await prisma.contact.findMany({
    where: contactWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: {
      id: true, firstName: true, lastName: true, city: true, origin: true, state: true, version: true,
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
  const transfers = !isTransfers ? [] : await prisma.contactTransfer.findMany({
    where: transferWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: { id: true, status: true, sourceOwnerSnapshot: true, recipientSnapshot: true,
      recipientUserId: true, recipient: { select: { isActive: true } },
      requestedBySnapshot: true, rejectionReason: true, decisionReason: true, createdAt: true, decidedAt: true,
      contact: { select: { id: true, firstName: true, lastName: true, state: true } } },
  });
  const incomingTransfers = view !== "queue" ? [] : await prisma.contactTransfer.findMany({
    where: { recipientUserId: user.id, status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    select: { id: true, sourceOwnerSnapshot: true, sourceState: true, createdAt: true,
      contact: { select: { id: true, firstName: true, lastName: true, origin: true } } },
  });
  const bulkUsers = user.role !== "admin" ? [] : await prisma.user.findMany({
    where: { isActive: true, role: { in: ["admin", "staff"] }, id: { not: user.id } },
    orderBy: [{ name: "asc" }, { email: "asc" }], take: 200,
    select: { id: true, name: true, email: true, phone: true },
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
    <ContactIntakeTabs view={view as ContactView} scopeAll={all} role={user.role} />
    {!["history", "duplicates", "pool", "transfers"].includes(view) && <div className="flex flex-wrap gap-3 text-xs font-semibold">
      <Link href={`/admin/my-contacts/export/authorize?view=${view}${all ? "&scope=all" : ""}`} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-mulberry-800">Export {view} (PIN protected)</Link>
      <Link href="/admin/my-contacts/follow-ups" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-mulberry-800">Manage contact follow-ups →</Link>
    </div>}
    {user.role === "admin" && !["pool", "transfers"].includes(view) ? <div className="flex flex-wrap items-center gap-2 text-sm">
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
      {isTransfers ? <section className="space-y-4">
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">Transfer history is retained after approval, rejection or administrator cancellation. The Owner can cancel a pending transfer when the recipient is unavailable or reassignment is needed; if the contact is still pending, its original owner and state are restored.</p>
        <form method="GET" action="/admin/my-contacts" role="search" className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <input type="hidden" name="view" value="transfers" />
          <label htmlFor="transfer-search" className="min-w-[180px] flex-1 text-xs font-semibold text-neutral-700">Search contact, source owner or recipient
            <input id="transfer-search" type="search" name="q" defaultValue={q} maxLength={100} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm" />
          </label>
          <button type="submit" className="rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white">Search</button>
          <Link href={listUrl("transfers", "", false, 1)} className="py-2 text-sm font-semibold text-mulberry-700 hover:underline">Clear</Link>
        </form>
        <p className="text-sm text-neutral-600">{total} transfer records found.</p>
        {transfers.length === 0 ? <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600">No transfers found.</p> : <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white"><table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600"><tr><th className="px-4 py-3">Contact</th><th className="px-4 py-3">From</th><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Decision / reason</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Admin resolution</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">{transfers.map(transfer => <tr key={transfer.id}>
            <td className="px-4 py-4"><Link href={`/admin/my-contacts/${transfer.contact.id}`} className="font-semibold text-mulberry-800 hover:underline">{transfer.contact.firstName} {transfer.contact.lastName || ""}</Link><div className="text-xs text-neutral-500">Current state: {transfer.contact.state}</div></td>
            <td className="px-4 py-4">{transfer.sourceOwnerSnapshot}</td>
            <td className="px-4 py-4">{transfer.recipientSnapshot}{(!transfer.recipientUserId || !transfer.recipient?.isActive) ? <div className="mt-1 text-xs font-semibold text-red-700">Account unavailable</div> : null}</td>
            <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${transfer.status === "REJECTED" ? "bg-red-50 text-red-800" : transfer.status === "APPROVED" ? "bg-emerald-50 text-emerald-800" : transfer.status === "CANCELLED" ? "bg-neutral-100 text-neutral-700" : "bg-amber-50 text-amber-900"}`}>{transfer.status}</span></td>
            <td className="max-w-[260px] break-words px-4 py-4 text-neutral-700">{transfer.rejectionReason || transfer.decisionReason || "—"}</td>
            <td className="px-4 py-4 text-neutral-600">{transfer.createdAt.toLocaleString()}</td>
            <td className="px-4 py-4">{transfer.status === "PENDING" ? <ContactTransferAdminResolutionForm transferId={transfer.id} recipientUnavailable={!transfer.recipientUserId || !transfer.recipient?.isActive} /> : <span className="text-xs text-neutral-500">No action needed</span>}</td>
          </tr>)}</tbody></table></div>}
        {pages > 1 ? <nav aria-label="Transfer history pages" className="flex items-center justify-between text-sm"><span>{page > 1 ? <Link href={listUrl("transfers", q, false, page - 1)} className="font-semibold underline">← Previous</Link> : null}</span><span>Page {page} of {pages}</span><span>{page < pages ? <Link href={listUrl("transfers", q, false, page + 1)} className="font-semibold underline">Next →</Link> : null}</span></nav> : null}
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
      <p className="text-sm text-neutral-600">{total} {view === "history" ? "import batches" : view === "queue" ? "unreviewed imported contacts" : view === "archived" ? "archived contacts" : view === "pool" ? "contacts in the shared pool" : "main contacts"} found.</p>
      {view === "queue" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Imported contacts must be reviewed individually. Open a contact to approve or reject it; potential duplicate matches must be resolved first. Review never grants consent or creates a Lead. Incoming contact transfers appear below and must be accepted or rejected separately.</p> : null}
      {view === "queue" && incomingTransfers.length > 0 ? <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <div><h2 className="font-bold text-sky-950">Incoming contact transfers</h2><p className="mt-1 text-sm text-sky-900">Accepting a transfer from Main or the Contact Pool moves it to Main Contacts. Accepting an unreviewed imported contact keeps it in this queue for its separate import review. Rejections return the contact to the sender or Contact Pool and are visible to the administrator.</p></div>
        <div className="space-y-3">{incomingTransfers.map(transfer => <div key={transfer.id} className="rounded-xl border border-sky-100 bg-white p-4">
          <div className="font-semibold text-neutral-900"><span>{transfer.contact.firstName} {transfer.contact.lastName || ""}</span></div>
          <p className="mt-1 text-xs text-neutral-600">From {transfer.sourceOwnerSnapshot} · Original state {transfer.sourceState} · Requested {transfer.createdAt.toLocaleString()}</p>
          <div className="mt-3"><ContactTransferDecisionForm transferId={transfer.id}/></div>
        </div>)}</div>
      </section> : null}
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
          <p className="mt-2 text-sm text-neutral-600">{view === "queue" ? "Upload a spreadsheet to fill the unreviewed queue." : view === "archived" ? "Archived contacts appear here." : view === "pool" ? "No contacts are in the shared Contact Pool." : "Create a manual contact to get started."}</p>
        </div> : <ContactBulkForm view={view} role={user.role} scopeAll={all} users={bulkUsers}>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600"><tr>
            <th className="px-4 py-3">Select</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Phone / email</th><th className="px-4 py-3">Consent</th>
            {all && !isPool ? <th className="px-4 py-3">Owner</th> : null}<th className="px-4 py-3">Source / date</th>
          </tr></thead><tbody className="divide-y divide-neutral-100">{contacts.map(c => <tr key={c.id} className="hover:bg-neutral-50">
            <td className="px-4 py-4"><input type="checkbox" name="contactIds" value={c.id} aria-label={`Select ${c.firstName} ${c.lastName || ""}`} className="h-4 w-4 rounded border-neutral-300" /></td>
            <td className="px-4 py-4"><Link href={`/admin/my-contacts/${c.id}`} className="font-semibold text-mulberry-800 hover:underline">{c.firstName} {c.lastName || ""}</Link><div className="text-xs text-neutral-500">{c.city || "—"}</div></td>
            <td className="px-4 py-4 text-neutral-700">{c.methods.filter(m => m.isPrimary).map(m => <div key={`${m.type}-${m.value}`}>{m.value}</div>)}
              {c.methods.length > c.methods.filter(m => m.isPrimary).length ? <div className="text-xs text-neutral-500">+{c.methods.length - c.methods.filter(m => m.isPrimary).length} additional methods</div> : null}
            </td>
            <td className="px-4 py-4">{c.doNotContact ? <span className="font-semibold text-red-700">Do Not Contact</span> : <span className="text-neutral-600">{c.consentStatus === "GRANTED" ? "Permission granted" : c.consentStatus === "DENIED" ? "Permission denied" : "Unknown"}</span>}</td>
            {all && !isPool ? <td className="px-4 py-4 text-neutral-600">{c.ownerSnapshot}</td> : null}
            <td className="px-4 py-4 text-neutral-600"><span className="rounded-full bg-mulberry-50 px-2 py-0.5 text-xs text-mulberry-800">{c.origin === "MANUAL" ? "Manual" : "Imported"}</span>
              {c.importBatch ? <div className="mt-1 max-w-[180px] break-words text-xs"><Link href={`/admin/my-contacts/import/${c.importBatch.id}`} className="font-semibold text-mulberry-800 hover:underline">{c.importBatch.filename}</Link> · row {c.importRowNumber}</div> : null}
              <div className="mt-1 text-xs">{c.createdAt.toLocaleDateString()}</div></td>
          </tr>)}</tbody></table></div>
        </ContactBulkForm>)}
      {pages > 1 ? <nav aria-label="Contact pages" className="flex items-center justify-between text-sm">
        {page > 1 ? <Link href={listUrl(view, q, all, page - 1)} className="font-semibold text-mulberry-800 hover:underline">← Previous</Link> : <span />}
        <span className="text-neutral-600">Page {page} of {pages}</span>
        {page < pages ? <Link href={listUrl(view, q, all, page + 1)} className="font-semibold text-mulberry-800 hover:underline">Next →</Link> : <span />}
      </nav> : null}
      </>}
    </>}
  </div>;
}
