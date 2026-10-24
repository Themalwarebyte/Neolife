import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { ContactIntakeTabs } from "@/components/admin/ContactIntakeTabs";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;
function one(query: Query, key: string) { return typeof query[key] === "string" ? query[key] as string : ""; }

export default async function RejectedImportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  const query = await searchParams;
  const all = user.role === "admin" && one(query, "scope") === "all";
  const q = one(query, "q").trim().slice(0, 100);
  const pageRaw = Number(one(query, "page"));
  const page = Number.isSafeInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 100000) : 1;
  const contactPageRaw = Number(one(query, "contactsPage"));
  const contactsPageRequested = Number.isSafeInteger(contactPageRaw) && contactPageRaw > 0 ? Math.min(contactPageRaw, 100000) : 1;
  const scope = user.role === "admin" && all ? {} : { ownerUserId: user.id };
  const where: Prisma.ContactImportRowWhereInput = {
    status: { in: ["INVALID", "REJECTED"] },
    batch: { is: { ...scope, ...(q ? { filename: { contains: q, mode: "insensitive" } } : {}) } },
  };
  const rejectedContactWhere: Prisma.ContactWhereInput = {
    ...scope, state: "ARCHIVED", origin: "IMPORT", queueReviewOutcome: "REJECTED",
    ...(q ? { OR: [
      { firstName: { contains: q, mode: "insensitive" as const } },
      { lastName: { contains: q, mode: "insensitive" as const } },
      { city: { contains: q, mode: "insensitive" as const } },
      { queueReviewReason: { contains: q, mode: "insensitive" as const } },
      { importBatch: { is: { filename: { contains: q, mode: "insensitive" as const } } } },
    ] } : {}),
  };
  const pageSize = 25;
  const [total, rejectedContactTotal] = await Promise.all([
    prisma.contactImportRow.count({ where }),
    prisma.contact.count({ where: rejectedContactWhere }),
  ] as const);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);
  const rejectedContactPages = Math.max(1, Math.ceil(rejectedContactTotal / pageSize));
  const contactsPage = Math.min(contactsPageRequested, rejectedContactPages);
  const [rows, rejectedContacts] = await Promise.all([
    prisma.contactImportRow.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (currentPage - 1) * pageSize, take: pageSize,
      select: { id: true, rowNumber: true, status: true, error: true, correctionCount: true, lastCorrectedAt: true,
        batch: { select: { id: true, filename: true, ownerSnapshot: true, createdAt: true } } },
    }),
    prisma.contact.findMany({
      where: rejectedContactWhere, orderBy: [{ queueReviewedAt: "desc" }, { id: "desc" }],
      skip: (contactsPage - 1) * pageSize, take: pageSize,
      select: { id: true, firstName: true, lastName: true, city: true, queueReviewReason: true,
        queueReviewedAt: true, queueReviewedBySnapshot: true, ownerSnapshot: true, importBatch: { select: { filename: true } } },
    }),
  ] as const);
  const url = (target: number, contactTarget = contactsPage) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (all) params.set("scope", "all");
    if (target > 1) params.set("page", String(target));
    if (contactTarget > 1) params.set("contactsPage", String(contactTarget));
    return `/admin/my-contacts/rejected-imports?${params.toString()}`;
  };
  const scopeUrl = (team: boolean) => {
    const params = new URLSearchParams();
    if (team) params.set("scope", "all");
    if (q) params.set("q", q);
    return `/admin/my-contacts/rejected-imports?${params.toString()}`;
  };
  return <div className="space-y-6">
    <header><Link href="/admin/my-contacts?view=history" className="text-sm font-semibold text-mulberry-700 hover:underline">← Import History</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-mulberry-600">Contact intake · Corrections</p>
      <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Rejected Imports</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600">Two kinds of rejected import records stay accessible here: spreadsheet rows that failed validation, and imported contacts rejected during queue review. Correct validation failures and revalidate them; correct a rejected contact and return it to Imported Queue for a fresh review. Neither workflow erases the original source or decision history.</p>
    </header>
    <ContactIntakeTabs view="rejected-imports" scopeAll={all} role={user.role}/>
    {user.role === "admin" ? <div className="flex flex-wrap gap-2 text-sm"><Link href={scopeUrl(false)} className={!all ? "rounded-full bg-mulberry-100 px-4 py-2 font-semibold text-mulberry-900" : "rounded-full border px-4 py-2"}>My records</Link><Link href={scopeUrl(true)} className={all ? "rounded-full bg-mulberry-100 px-4 py-2 font-semibold text-mulberry-900" : "rounded-full border px-4 py-2"}>Team oversight</Link></div> : null}
    <form method="GET" action="/admin/my-contacts/rejected-imports" className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      {all ? <input type="hidden" name="scope" value="all"/> : null}
      <label className="min-w-[200px] flex-1 text-xs font-semibold">Search filename, contact or rejection reason<input type="search" name="q" maxLength={100} defaultValue={q} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-normal"/></label>
      <button className="rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white">Search</button>
    </form>
    <section className="space-y-3"><div><h2 className="text-lg font-bold text-neutral-900">Rejected spreadsheet rows</h2><p className="text-sm text-neutral-600">{total} invalid or rejected rows need validation or correction.</p></div>
      {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600">No rejected spreadsheet rows need correction.</p> : <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600"><tr><th className="px-4 py-3">Source file</th><th className="px-4 py-3">Row</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Validation reason</th>{all ? <th className="px-4 py-3">Uploader</th> : null}<th className="px-4 py-3">Corrections</th><th className="px-4 py-3">Action</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">{rows.map(row => <tr key={row.id}>
          <td className="max-w-[200px] break-words px-4 py-4"><Link href={`/admin/my-contacts/import/${row.batch.id}`} className="font-semibold text-mulberry-800 hover:underline">{row.batch.filename}</Link></td>
          <td className="px-4 py-4">{row.rowNumber}</td><td className="px-4 py-4"><span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">Rejected during import</span></td>
          <td className="max-w-[280px] break-words px-4 py-4 text-neutral-700">{row.error || "Correction required"}</td>{all ? <td className="px-4 py-4">{row.batch.ownerSnapshot}</td> : null}
          <td className="px-4 py-4">{row.correctionCount}{row.lastCorrectedAt ? <div className="text-xs text-neutral-500">Last edited {row.lastCorrectedAt.toLocaleString()}</div> : null}</td>
          <td className="px-4 py-4"><Link href={`/admin/my-contacts/rejected-imports/${row.id}`} className="font-semibold text-mulberry-800 underline">Correct row</Link></td>
        </tr>)}</tbody></table></div>}
      {pages > 1 ? <nav className="flex items-center justify-between text-sm"><span>{currentPage > 1 ? <Link className="font-semibold underline" href={url(currentPage - 1)}>← Previous</Link> : null}</span><span>Page {currentPage} of {pages}</span><span>{currentPage < pages ? <Link className="font-semibold underline" href={url(currentPage + 1)}>Next →</Link> : null}</span></nav> : null}
    </section>
    <section className="space-y-3"><div><h2 className="text-lg font-bold text-neutral-900">Rejected imported contacts</h2><p className="text-sm text-neutral-600">{rejectedContactTotal} contacts were rejected during queue review. Correct the record and send it back for a fresh decision.</p></div>
      {rejectedContacts.length === 0 ? <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600">No rejected imported contacts need correction.</p> : <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600"><tr><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Rejection reason</th><th className="px-4 py-3">Reviewed by</th>{all ? <th className="px-4 py-3">Owner</th> : null}<th className="px-4 py-3">Action</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">{rejectedContacts.map(contact => <tr key={contact.id}>
          <td className="px-4 py-4"><div className="font-semibold text-neutral-900">{contact.firstName} {contact.lastName || ""}</div><div className="text-xs text-neutral-500">{contact.city || "—"}</div></td>
          <td className="max-w-[180px] break-words px-4 py-4 text-neutral-700">{contact.importBatch?.filename || "Original import"}</td>
          <td className="max-w-[280px] break-words px-4 py-4 text-neutral-700">{contact.queueReviewReason || "No reason recorded"}<div className="mt-1 text-xs text-neutral-500">{contact.queueReviewedAt?.toLocaleString() || "—"}</div></td>
          <td className="px-4 py-4">{contact.queueReviewedBySnapshot || "Unknown"}</td>{all ? <td className="px-4 py-4">{contact.ownerSnapshot}</td> : null}
          <td className="px-4 py-4"><Link href={`/admin/my-contacts/rejected-imports/contact/${contact.id}`} className="font-semibold text-mulberry-800 underline">Correct and requeue</Link></td>
        </tr>)}</tbody></table></div>}
      {rejectedContactPages > 1 ? <nav className="flex items-center justify-between text-sm"><span>{contactsPage > 1 ? <Link className="font-semibold underline" href={url(page, contactsPage - 1)}>← Previous</Link> : null}</span><span>Page {contactsPage} of {rejectedContactPages}</span><span>{contactsPage < rejectedContactPages ? <Link className="font-semibold underline" href={url(page, contactsPage + 1)}>Next →</Link> : null}</span></nav> : null}
    </section>
  </div>;
}
