import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope, isContactUuid } from "@/lib/contact-intake";
import { ManualContactForm } from "@/components/admin/ManualContactForm";
import { ContactStateForm } from "@/components/admin/ContactStateForm";
import { ContactQueueReviewForm } from "@/components/admin/ContactQueueReviewForm";
import { ContactFollowUpScheduleForm } from "@/components/admin/ContactFollowUpScheduleForm";
import { ContactFollowUpUpdateForms } from "@/components/admin/ContactFollowUpUpdateForms";
import { mayScheduleOutreach } from "@/lib/contact-processing";

export const dynamic = "force-dynamic";
export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmUser();
  const { id } = await params;
  if (!isContactUuid(id)) notFound();
  const contact = await prisma.contact.findFirst({
    where: { id, ...contactRecordScope(user.role, user.id) },
    include: {
      methods: { orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }] },
      importBatch: { select: { id: true, filename: true, ownerUserId: true } },
      mergedFrom: { select: { id: true, firstName: true, lastName: true, mergedAt: true }, orderBy: { mergedAt: "desc" } },
      followUps: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20 },
      audit: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30,
        select: { id: true, action: true, actorSnapshot: true, createdAt: true },
      },
    },
  });
  if (!contact) notFound();
  const imported = contact.state === "IMPORTED_QUEUE";
  const merged = contact.state === "MERGED";
  const archived = contact.state === "ARCHIVED";
  const inPool = contact.state === "CONTACT_POOL";
  const transferPending = contact.state === "TRANSFER_PENDING";
  const inMain = contact.state === "MAIN";
  const rejectedImport = contact.origin === "IMPORT" && contact.queueReviewOutcome === "REJECTED";
  const canContact = mayScheduleOutreach(contact);
  return <div className="mx-auto max-w-4xl space-y-6">
    <header>
      <Link href={`/admin/my-contacts?view=${imported ? "queue" : archived ? "archived" : inPool ? "pool" : transferPending ? "transfers" : merged ? "duplicates" : "main"}`} className="text-sm font-semibold text-mulberry-700 hover:underline">← My Contacts</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-mulberry-600">Personal contact · {contact.origin === "MANUAL" ? "Manual" : "Imported"}</p>
      <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{contact.firstName} {contact.lastName || ""}</h1>
      <p className="mt-2 text-sm text-neutral-600">Created {contact.createdAt.toLocaleString()} · Owner: {contact.ownerSnapshot}</p>
      {contact.doNotContact ? <p role="status" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">Do Not Contact — do not message or call this person.</p> : null}
    </header>
    {merged ? <section className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-800">
      <h2 className="text-lg font-bold text-neutral-900">Merged source — preserved history</h2>
      <p>This original record was retained for audit and recovery. Its contact methods, notes, source file and consent history remain available here, but this source cannot be edited or contacted as a separate active record.</p>
      {contact.mergedIntoContactId ? <Link className="font-semibold text-mulberry-700 underline" href={`/admin/my-contacts/${contact.mergedIntoContactId}`}>View retained contact</Link> : null}
      <p>Name: {contact.firstName} {contact.lastName || ""} · City: {contact.city || "—"}</p>
      <p>Source: {contact.sourceDetail || "—"} · Notes: {contact.notes || "—"}</p>
      <p>Consent: {contact.consentStatus} · Do Not Contact: {contact.doNotContact ? "Yes" : "No"}</p>
      <ul>{contact.methods.map(m => <li key={m.id}>{m.type}: {m.value}</li>)}</ul>
    </section> : null}
    {inPool ? <section className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950">
      <h2 className="font-bold">Shared Contact Pool</h2><p>This contact is in the administrator-managed shared pool and has no current owner. Use the Contact Pool list to send it to a user; the recipient must approve or reject the transfer.</p>
    </section> : null}
    {transferPending ? <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-bold">Transfer awaiting recipient decision</h2><p>This contact is temporarily unavailable for editing while its transfer is pending. The recipient can accept or reject it from their Imported Queue. A rejection returns the contact to its previous owner or the Contact Pool.</p>
      {user.role === "admin" ? <Link className="font-semibold underline" href="/admin/my-contacts?view=transfers">View transfer status</Link> : null}
    </section> : null}
    {imported ? <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-neutral-800">
      <h2 className="font-bold text-amber-900">Imported · awaiting review</h2>
      <p>Imported contacts remain separate until a reviewer makes a recorded decision. Resolve duplicate suggestions before approval. This review does not send messages or grant consent.</p>
      <p><strong>Source:</strong> {contact.sourceDetail || "Unknown"}{contact.importBatch ? <> · File: {contact.importBatch.filename}{(user.role === "admin" || contact.importBatch.ownerUserId === user.id) ? <> · <Link className="font-semibold text-mulberry-800 underline" href={`/admin/my-contacts/import/${contact.importBatch.id}`}>View import history</Link></> : null}</> : null}</p>
      <p><strong>City:</strong> {contact.city || "—"}</p><p><strong>Notes:</strong> {contact.notes || "—"}</p>
      <p><strong>Consent:</strong> {contact.consentStatus}{contact.consentEvidence ? ` · ${contact.consentEvidence}` : ""}</p>
      <ul className="space-y-1">{contact.methods.map(m => <li key={m.id}>{m.type === "PHONE" ? "Phone" : "Email"}: {m.value}</li>)}</ul>
    </section> : null}
    {imported && <ContactQueueReviewForm contactId={contact.id} version={contact.version} />}
    {rejectedImport && <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm">
      <h2 className="font-bold text-neutral-900">Rejected import — preserved, read-only</h2>
      <p className="mt-2">Reason: {contact.queueReviewReason || "—"}. Reviewed by {contact.queueReviewedBySnapshot || "Unknown"} on {contact.queueReviewedAt?.toLocaleString() || "—"}.</p>
      <p className="mt-2">Name: {contact.firstName} {contact.lastName || ""} · City: {contact.city || "—"}</p>
      <p className="mt-2">Source: {contact.sourceDetail || "—"} · Notes: {contact.notes || "—"}</p>
      <ul className="mt-2">{contact.methods.map(m => <li key={m.id}>{m.type}: {m.value}</li>)}</ul>
      <p className="mt-2">This imported rejection cannot use the generic restore-to-Main action.</p>
      <Link href={`/admin/my-contacts/rejected-imports/contact/${contact.id}`} className="mt-3 inline-flex rounded-full bg-mulberry-700 px-5 py-2.5 text-sm font-semibold text-white">Correct fields and return to Imported Queue</Link>
    </section>}
    {(inMain || archived) && !rejectedImport ? <ManualContactForm contact={{
      id: contact.id, version: contact.version, firstName: contact.firstName,
      lastName: contact.lastName, city: contact.city, sourceDetail: contact.sourceDetail,
      notes: contact.notes, consentStatus: contact.consentStatus, consentEvidence: contact.consentEvidence, doNotContact: contact.doNotContact,
      methods: contact.methods.map(m => ({ type: m.type, value: m.value })),
    }} /> : rejectedImport ? null : <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This record is not editable in its current state. Imported decisions and merged records retain a permanent audit trail.</p>}
    {(inMain || archived) && !rejectedImport ? <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-bold text-neutral-800">Contact list status</h2>
      <p className="mb-4 text-sm text-neutral-600">Archiving removes the record from Main Contacts without deleting its details or history.</p>
      <ContactStateForm id={id} version={contact.version} archived={archived} />
    </section> : null}
    {inMain && contact.ownerUserId && <ContactFollowUpScheduleForm contactId={contact.id} version={contact.version} outreachAllowed={canContact} />}
    {inMain && !contact.ownerUserId && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">This contact has no active owner. Follow-up scheduling is paused pending authorized ownership recovery.</p>}
    {(inMain || archived || merged) && <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-neutral-900">Contact follow-up history</h2>
        <Link href="/admin/my-contacts/follow-ups" className="text-sm font-semibold text-mulberry-700 hover:underline">All follow-ups →</Link>
      </div>
      {contact.followUps.length === 0 ? <p className="text-sm text-neutral-600">No follow-up tasks recorded.</p> :
        contact.followUps.map(task => <div key={task.id} className="space-y-3 rounded-xl border border-neutral-100 p-3">
          <p className="text-sm font-semibold">{task.kind} · {task.status} · Due {task.dueAt.toLocaleString()}</p>
          <p className="whitespace-pre-wrap break-words text-sm">{task.note}</p>
          {task.resolutionNote && <p className="text-xs text-neutral-600">Outcome: {task.resolutionNote}</p>}
          {task.status === "OPEN" && <ContactFollowUpUpdateForms taskId={task.id} version={task.version}
            allowOutreachUpdate={inMain && (task.kind === "INTERNAL" || canContact)} />}
        </div>)}
    </section>}
    {contact.mergedFrom.length ? <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-base font-bold text-neutral-900">Preserved merged sources</h2>
      <p className="mt-1 text-sm text-neutral-600">These records retain their original notes, methods, import attribution and audit histories.</p>
      <ul className="mt-3 space-y-2">{contact.mergedFrom.map(source => <li key={source.id} className="text-sm">
        <Link href={`/admin/my-contacts/${source.id}`} className="font-semibold text-mulberry-700 underline">{source.firstName} {source.lastName || ""}</Link>
        {source.mergedAt ? <span className="text-neutral-500"> · merged {source.mergedAt.toLocaleString()}</span> : null}
      </li>)}</ul>
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
