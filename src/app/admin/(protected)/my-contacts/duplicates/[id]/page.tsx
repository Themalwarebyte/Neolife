import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope, isContactUuid } from "@/lib/contact-intake";
import { displayDuplicateSignals, duplicateReviewPriority } from "@/lib/contact-duplicates";
import { ContactDuplicateReviewForm } from "@/components/admin/ContactDuplicateReviewForm";

export const dynamic = "force-dynamic";

export default async function ContactDuplicateDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmUser();
  const { id } = await params;
  if (!isContactUuid(id)) notFound();
  const issue = await prisma.contactDuplicateIssue.findFirst({
    where: { id, ...contactRecordScope(user.role, user.id) },
    include: {
      leftContact: { include: { methods: { orderBy: [{ type: "asc" }, { isPrimary: "desc" }] } } },
      rightContact: { include: { methods: { orderBy: [{ type: "asc" }, { isPrimary: "desc" }] } } },
    },
  });
  if (!issue) notFound();
  const sameOwner = !!issue.ownerUserId && issue.leftContact.ownerUserId === issue.ownerUserId &&
    issue.rightContact.ownerUserId === issue.ownerUserId;
  const orphaned = user.role === "admin" && issue.ownerUserId === null &&
    issue.leftContact.ownerUserId === null && issue.rightContact.ownerUserId === null;
  if (!sameOwner && !orphaned) notFound();
  const left = issue.leftContact, right = issue.rightContact;
  const stale = issue.leftVersion !== left.version || issue.rightVersion !== right.version;
  const Card = ({ contact }: { contact: typeof left }) => <section className="rounded-2xl border border-neutral-200 bg-white p-5">
    <p className="text-xs font-bold uppercase tracking-wide text-mulberry-700">{contact.origin} · {contact.state}</p>
    <h2 className="mt-1 text-lg font-bold text-neutral-900"><Link className="hover:underline" href={`/admin/my-contacts/${contact.id}`}>{contact.firstName} {contact.lastName || ""}</Link></h2>
    <p className="mt-1 text-xs text-neutral-500">Owner: {contact.ownerSnapshot} · Version {contact.version}</p>
    <dl className="mt-4 space-y-2 text-sm text-neutral-700">
      <div><dt className="font-semibold">City</dt><dd>{contact.city || "—"}</dd></div>
      <div><dt className="font-semibold">Source</dt><dd>{contact.sourceDetail || "—"}</dd></div>
      <div><dt className="font-semibold">Contact methods</dt><dd><ul>{contact.methods.map(m => <li key={m.id}>{m.type}: {m.value}</li>)}</ul></dd></div>
      <div><dt className="font-semibold">Consent</dt><dd>{contact.consentStatus}{contact.consentEvidence ? ` · ${contact.consentEvidence}` : ""}</dd></div>
      <div><dt className="font-semibold">Do Not Contact</dt><dd className={contact.doNotContact ? "font-bold text-red-700" : ""}>{contact.doNotContact ? "YES" : "No"}</dd></div>
      <div><dt className="font-semibold">Notes</dt><dd className="whitespace-pre-wrap break-words">{contact.notes || "—"}</dd></div>
    </dl>
  </section>;
  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <Link href="/admin/my-contacts?view=duplicates" className="text-sm font-semibold text-mulberry-700 hover:underline">← Duplicate Issues</Link>
      <h1 className="mt-3 text-2xl font-extrabold text-neutral-900">Review possible duplicate</h1>
      <p className="mt-2 text-sm text-neutral-600">Status: {issue.status}. These suggestions are not identity verification and are never automatically merged.</p>
    </header>
    <section className="rounded-2xl border border-mulberry-200 bg-mulberry-50 p-5">
      <h2 className="font-bold text-neutral-900">Why this pair was flagged · {duplicateReviewPriority(issue.signals)} review</h2>
      <ul className="mt-2 list-disc pl-5 text-sm text-neutral-800">{displayDuplicateSignals(issue.signals).map(text => <li key={text}>{text}</li>)}</ul>
      <p className="mt-2 text-xs text-neutral-600">A phone may be shared in a household. A matching full name and city are not proof of identity.</p>
    </section>
    <div className="grid gap-4 md:grid-cols-2"><Card contact={left} /><Card contact={right} /></div>
    {orphaned ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      The owning account has been removed. Owner oversight is read-only; this pair cannot be merged or dismissed until ownership is restored through an authorized process.
    </p> : null}
    {issue.status === "OPEN" && stale && !orphaned ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      A contact has changed since this match was scanned. Return to Duplicate Issues, scan again and reopen the refreshed issue before reviewing.
    </p> : null}
    {issue.status === "OPEN" && !stale && !orphaned ? <ContactDuplicateReviewForm issueId={issue.id}
      left={{ id: left.id, firstName: left.firstName, lastName: left.lastName, state: left.state, version: left.version }}
      right={{ id: right.id, firstName: right.firstName, lastName: right.lastName, state: right.state, version: right.version }} /> :
      issue.status !== "OPEN" ? <section className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm">
        <p className="font-semibold">Reviewed: {issue.status.toLowerCase()}</p>
        {issue.reviewedBySnapshot ? <p className="mt-2">By {issue.reviewedBySnapshot} on {issue.reviewedAt?.toLocaleString()}</p> : null}
        {issue.reviewReason ? <p className="mt-2 whitespace-pre-wrap">Reason: {issue.reviewReason}</p> : null}
        {issue.retainedContactId ? <Link className="mt-3 inline-block font-semibold text-mulberry-700 underline" href={`/admin/my-contacts/${issue.retainedContactId}`}>View retained contact</Link> : null}
      </section> : null}
  </div>;
}
