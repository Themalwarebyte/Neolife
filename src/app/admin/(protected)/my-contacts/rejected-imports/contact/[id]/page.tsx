import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope, isContactUuid } from "@/lib/contact-intake";
import { RejectedQueueContactCorrectionForm } from "@/components/admin/RejectedQueueContactCorrectionForm";

export const dynamic = "force-dynamic";
export default async function RejectedQueueContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmUser();
  const { id } = await params;
  if (!isContactUuid(id)) notFound();
  const contact = await prisma.contact.findFirst({
    where: { id, ...contactRecordScope(user.role, user.id), state: "ARCHIVED", origin: "IMPORT", queueReviewOutcome: "REJECTED" },
    include: { methods: { orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }], select: { type: true, value: true } },
      audit: { where: { action: "IMPORT_REJECTED" }, orderBy: [{ createdAt: "desc" }], take: 1, select: { actorSnapshot: true, reason: true, createdAt: true } },
      importBatch: { select: { filename: true } } },
  });
  if (!contact) notFound();
  return <div className="mx-auto max-w-4xl space-y-6">
    <header><Link href="/admin/my-contacts/rejected-imports" className="text-sm font-semibold text-mulberry-700 hover:underline">← Rejected Imports</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-red-700">Rejected import review</p>
      <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{contact.firstName} {contact.lastName || ""}</h1>
      <p className="mt-2 text-sm text-neutral-600">{contact.importBatch?.filename || contact.sourceDetail || "Original import source preserved"} · Current owner: {contact.ownerSnapshot}</p>
    </header>
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><strong>Previous rejection:</strong> {contact.queueReviewReason || "No reason was recorded."}<div className="mt-1 text-xs">Reviewed by {contact.queueReviewedBySnapshot || contact.audit[0]?.actorSnapshot || "Unknown"} on {contact.queueReviewedAt?.toLocaleString() || contact.audit[0]?.createdAt.toLocaleString() || "—"}</div></div>
    <RejectedQueueContactCorrectionForm contact={{ id: contact.id, version: contact.version, firstName: contact.firstName, lastName: contact.lastName,
      city: contact.city, sourceDetail: contact.sourceDetail, notes: contact.notes, consentStatus: contact.consentStatus,
      consentEvidence: contact.consentEvidence, doNotContact: contact.doNotContact,
      methods: contact.methods.map(method => ({ type: method.type, value: method.value })) }} />
  </div>;
}
