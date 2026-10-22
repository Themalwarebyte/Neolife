import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope, isContactUuid } from "@/lib/contact-intake";
import { ManualContactForm } from "@/components/admin/ManualContactForm";
import { ContactStateForm } from "@/components/admin/ContactStateForm";

export const dynamic = "force-dynamic";
export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmUser();
  const { id } = await params;
  if (!isContactUuid(id)) notFound();
  const contact = await prisma.contact.findFirst({
    where: { id, ...contactRecordScope(user.role, user.id) },
    include: {
      methods: { orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }] },
      audit: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30,
        select: { id: true, action: true, actorSnapshot: true, createdAt: true },
      },
    },
  });
  if (!contact) notFound();
  const imported = contact.state === "IMPORTED_QUEUE";
  const archived = contact.state === "ARCHIVED";
  const inMain = contact.state === "MAIN";
  return <div className="mx-auto max-w-4xl space-y-6">
    <header>
      <Link href={`/admin/my-contacts?view=${imported ? "queue" : archived ? "archived" : "main"}`} className="text-sm font-semibold text-mulberry-700 hover:underline">← My Contacts</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-mulberry-600">Personal contact · {contact.origin === "MANUAL" ? "Manual" : "Imported"}</p>
      <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{contact.firstName} {contact.lastName || ""}</h1>
      <p className="mt-2 text-sm text-neutral-600">Created {contact.createdAt.toLocaleString()} · Owner: {contact.ownerSnapshot}</p>
      {contact.doNotContact ? <p role="status" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">Do Not Contact — do not message or call this person.</p> : null}
    </header>
    {imported ? <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-neutral-800">
      <h2 className="font-bold text-amber-900">Imported · awaiting review</h2>
      <p>Imported contacts remain in a separate unreviewed queue. Duplicate review and processing are not yet available. Do not contact people without recorded permission.</p>
      <p><strong>Source:</strong> {contact.sourceDetail || "Unknown"}{contact.importBatchId ? <> · <Link className="font-semibold text-mulberry-800 underline" href={`/admin/my-contacts/import/${contact.importBatchId}`}>View import history</Link></> : null}</p>
      <p><strong>City:</strong> {contact.city || "—"}</p><p><strong>Notes:</strong> {contact.notes || "—"}</p>
      <p><strong>Consent:</strong> {contact.consentStatus}{contact.consentEvidence ? ` · ${contact.consentEvidence}` : ""}</p>
      <ul className="space-y-1">{contact.methods.map(m => <li key={m.id}>{m.type === "PHONE" ? "Phone" : "Email"}: {m.value}</li>)}</ul>
    </section> : null}
    {inMain || archived ? <ManualContactForm contact={{
      id: contact.id, version: contact.version, firstName: contact.firstName,
      lastName: contact.lastName, city: contact.city, sourceDetail: contact.sourceDetail,
      notes: contact.notes, consentStatus: contact.consentStatus, consentEvidence: contact.consentEvidence, doNotContact: contact.doNotContact,
      methods: contact.methods.map(m => ({ type: m.type, value: m.value })),
    }} /> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This imported record is awaiting Batch C/D review. Editing is not available until review is complete.</p>}
    {inMain || archived ? <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-bold text-neutral-800">Contact list status</h2>
      <p className="mb-4 text-sm text-neutral-600">Archiving removes the record from Main Contacts without deleting its details or history.</p>
      <ContactStateForm id={id} version={contact.version} archived={archived} />
    </section> : null}
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-base font-bold text-neutral-900">Change history</h2>
      <p className="mt-1 text-xs text-neutral-500">The last 30 audit events. Previous values are retained securely for recovery and future review.</p>
      {contact.audit.length ? <ol className="mt-4 divide-y divide-neutral-100">{contact.audit.map(event => <li key={event.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
        <span><strong className="text-neutral-900">{event.action.toLowerCase()}</strong> <span className="text-neutral-600">by {event.actorSnapshot}</span></span>
        <time className="text-xs text-neutral-500" dateTime={event.createdAt.toISOString()}>{event.createdAt.toLocaleString()}</time>
      </li>)}</ol> : <p className="mt-3 text-sm text-neutral-500">No recorded changes.</p>}
    </section>
  </div>;
}
