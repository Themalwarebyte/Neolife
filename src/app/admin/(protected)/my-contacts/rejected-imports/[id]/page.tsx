import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { isContactUuid } from "@/lib/contact-intake";
import { RejectedImportCorrectionForm } from "@/components/admin/RejectedImportCorrectionForm";

export const dynamic = "force-dynamic";
export default async function RejectedImportCorrectionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmUser();
  const { id } = await params;
  if (!isContactUuid(id)) notFound();
  const row = await prisma.contactImportRow.findUnique({ where: { id }, include: { batch: true, corrections: { orderBy: { createdAt: "desc" }, take: 10 } } });
  if (!row || (user.role !== "admin" && row.batch.ownerUserId !== user.id) || row.batch.status !== "COMPLETE" ||
      !["INVALID", "REJECTED"].includes(row.status) || row.contactId) notFound();
  if (!Array.isArray(row.batch.headers) || !row.batch.headers.every(h => typeof h === "string")) notFound();
  const headers = row.batch.headers as string[];
  const saved = row.correctedValues ?? row.values;
  if (!Array.isArray(saved) || !saved.every(v => typeof v === "string") || saved.length > 28) notFound();
  const values = saved as string[];
  return <div className="mx-auto max-w-5xl space-y-6">
    <header><Link href="/admin/my-contacts/rejected-imports" className="text-sm font-semibold text-mulberry-700 hover:underline">← Rejected Imports</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-red-700">Rejected spreadsheet row</p>
      <h1 className="mt-1 break-words text-2xl font-extrabold text-neutral-900">{row.batch.filename} · row {row.rowNumber}</h1>
      <p className="mt-2 text-sm text-neutral-600">Uploaded by {row.batch.ownerSnapshot} on {row.batch.createdAt.toLocaleString()}. The original row is retained and cannot create a Lead or send a message.</p>
    </header>
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><strong>Latest validation reason:</strong> {row.error || "This row needs correction."}</div>
    <RejectedImportCorrectionForm rowId={row.id} headers={headers} values={values} correctionCount={row.correctionCount}/>
    <section className="rounded-2xl border border-neutral-200 bg-white p-5"><h2 className="font-bold text-neutral-900">Correction history</h2>
      {row.corrections.length ? <ol className="mt-3 space-y-3">{row.corrections.map(correction => <li key={correction.id} className="border-b border-neutral-100 pb-3 text-sm"><div className="font-semibold">{correction.validationPassed ? "Validation passed" : "Validation failed"} · {correction.actorSnapshot}</div><div className="text-xs text-neutral-500">{correction.createdAt.toLocaleString()}</div>{correction.validationError ? <p className="mt-1 text-neutral-700">{correction.validationError}</p> : null}</li>)}</ol> : <p className="mt-2 text-sm text-neutral-600">No corrections have been attempted.</p>}
    </section>
  </div>;
}
