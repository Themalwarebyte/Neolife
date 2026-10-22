import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactListScope } from "@/lib/contact-intake";
import { ContactIntakeTabs } from "@/components/admin/ContactIntakeTabs";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;
const PAGE_SIZE = 25;
function single(q: Query, key: string) { return typeof q[key] === "string" ? q[key] : ""; }
function listUrl(view: string, q: string, all: boolean, page: number) {
  const params = new URLSearchParams({ view });
  if (q) params.set("q", q);
  if (all) params.set("scope", "all");
  if (page > 1) params.set("page", String(page));
  return `/admin/my-contacts?${params.toString()}`;
}

export default async function MyContactsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  const query = await searchParams;
  const view = ["main", "archived", "queue", "duplicates", "history"].includes(single(query, "view"))
    ? single(query, "view") as "main" | "archived" | "queue" | "duplicates" | "history"
    : "main";
  const all = user.role === "admin" && single(query, "scope") === "all";
  const q = single(query, "q").trim().slice(0, 100);
  const requestedPage = Number(single(query, "page"));
  const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;

  const future: Record<string, { title: string; description: string }> = {
    queue: { title: "Imported Queue — coming in Batch B", description: "CSV/XLSX uploads, row validation and the separate unreviewed queue will be implemented next. No spreadsheets are accepted in Batch A." },
    duplicates: { title: "Duplicate Issues — coming in Batch C", description: "Possible shared names, phone numbers and email addresses will require your review. Batch A never automatically merges entries." },
    history: { title: "Import History — coming in Batch B", description: "Per-upload histories, failures and file provenance will appear here after the import engine is implemented." },
  };

  const scope = contactListScope(user.role, user.id, all);
  const state = view === "archived" ? "ARCHIVED" : "MAIN";
  const where: Prisma.ContactWhereInput = {
    ...scope,
    state,
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
  const total = future[view] ? 0 : await prisma.contact.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  const contacts = future[view] ? [] : await prisma.contact.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, firstName: true, lastName: true, city: true, origin: true,
      consentStatus: true, doNotContact: true, ownerSnapshot: true, createdAt: true,
      methods: { orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }], select: { type: true, value: true, isPrimary: true } },
    },
  });

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-mulberry-600">Contact intake · Batch A</p>
        <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">My Contacts</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">A private address book separate from CRM leads. Manual contacts are not assigned sales statuses and no emails are sent.</p>
      </div>
      <Link href="/admin/my-contacts/new" className="rounded-full bg-mulberry-700 px-5 py-3 text-sm font-semibold text-white hover:bg-mulberry-800">+ Add contact</Link>
    </header>
    <ContactIntakeTabs view={view} scopeAll={all} />
    {user.role === "admin" ? <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-neutral-700">Owner scope:</span>
      <Link href={listUrl(view, q, false, 1)} className={`rounded-full px-4 py-2 ${!all ? "bg-mulberry-100 font-semibold text-mulberry-900" : "border border-neutral-200 bg-white text-neutral-700"}`}>My records</Link>
      <Link href={listUrl(view, q, true, 1)} className={`rounded-full px-4 py-2 ${all ? "bg-mulberry-100 font-semibold text-mulberry-900" : "border border-neutral-200 bg-white text-neutral-700"}`}>Team oversight</Link>
      {all ? <span className="text-xs text-neutral-500">Includes staff records and contacts preserved after user removal.</span> : null}
    </div> : null}

    {future[view] ? <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-9" aria-live="polite">
      <h2 className="text-lg font-bold text-neutral-900">{future[view].title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{future[view].description}</p>
      <Link href="/admin/my-contacts?view=main" className="mt-4 inline-block text-sm font-semibold text-mulberry-700 hover:underline">Return to Main Contacts</Link>
    </section> : <>
      <form method="GET" action="/admin/my-contacts" role="search" className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <input type="hidden" name="view" value={view} />
        {all ? <input type="hidden" name="scope" value="all" /> : null}
        <label htmlFor="contact-search" className="min-w-[180px] flex-1 text-xs font-semibold text-neutral-700">Search name, phone, email or city
          <input id="contact-search" type="search" name="q" defaultValue={q} maxLength={100} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm focus:border-mulberry-600 focus:outline-none" />
        </label>
        <button type="submit" className="rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white">Search</button>
        <Link href={listUrl(view, "", all, 1)} className="py-2 text-sm font-semibold text-mulberry-700 hover:underline">Clear</Link>
      </form>
      <p className="text-sm text-neutral-600">{total} {view === "archived" ? "archived" : "main"} contact{total === 1 ? "" : "s"} found.</p>
      {contacts.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-9 text-center">
        <p className="font-semibold text-neutral-800">No matching {view === "archived" ? "archived contacts" : "contacts"}</p>
        <p className="mt-2 text-sm text-neutral-600">{view === "archived" ? "Archived entries appear here and can be restored." : "Create a manual contact to get started."}</p>
      </div> : <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600"><tr>
            <th scope="col" className="px-4 py-3">Contact</th>
            <th scope="col" className="px-4 py-3">Phone / email</th>
            <th scope="col" className="px-4 py-3">Consent</th>
            {all ? <th scope="col" className="px-4 py-3">Record owner</th> : null}
            <th scope="col" className="px-4 py-3">Source / date</th>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">{contacts.map(c => <tr key={c.id} className="hover:bg-neutral-50">
            <td className="px-4 py-4"><Link href={`/admin/my-contacts/${c.id}`} className="font-semibold text-mulberry-800 hover:underline">{c.firstName} {c.lastName || ""}</Link><div className="text-xs text-neutral-500">{c.city || "—"}</div></td>
            <td className="px-4 py-4 text-neutral-700">
              {c.methods.filter(m => m.isPrimary).map(m => <div key={`${m.type}-${m.value}`}>{m.value}</div>)}
              {c.methods.length > c.methods.filter(m => m.isPrimary).length ? <div className="text-xs text-neutral-500">+{c.methods.length - c.methods.filter(m => m.isPrimary).length} additional methods</div> : null}
            </td>
            <td className="px-4 py-4">{c.doNotContact ? <span className="font-semibold text-red-700">Do Not Contact</span> : <span className="text-neutral-600">{c.consentStatus === "GRANTED" ? "Permission granted" : c.consentStatus === "DENIED" ? "Permission denied" : "Unknown"}</span>}</td>
            {all ? <td className="px-4 py-4 text-neutral-600">{c.ownerSnapshot}</td> : null}
            <td className="px-4 py-4 text-neutral-600"><span className="rounded-full bg-mulberry-50 px-2 py-0.5 text-xs text-mulberry-800">{c.origin === "MANUAL" ? "Manual" : "Imported"}</span><div className="mt-1 text-xs">{c.createdAt.toLocaleDateString()}</div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {pages > 1 ? <nav aria-label="Contact pages" className="flex items-center justify-between text-sm">
        {page > 1 ? <Link href={listUrl(view, q, all, page - 1)} className="font-semibold text-mulberry-800 hover:underline">← Previous</Link> : <span />}
        <span className="text-neutral-600">Page {page} of {pages}</span>
        {page < pages ? <Link href={listUrl(view, q, all, page + 1)} className="font-semibold text-mulberry-800 hover:underline">Next →</Link> : <span />}
      </nav> : null}
    </>}
  </div>;
}
