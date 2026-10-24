import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { contactRecordScope, isContactUuid } from "@/lib/contact-intake";
import { guessMapping } from "@/lib/contact-import-fields";
import { ContactImportMapping } from "@/components/admin/ContactImportMapping";

export const dynamic = "force-dynamic";
export default async function ContactImportDetails({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmUser();
  const { id } = await params;
  if (!isContactUuid(id)) notFound();
  const batch = await prisma.contactImportBatch.findFirst({
    where: { id, ...contactRecordScope(user.role, user.id) },
    include: { rows: { orderBy: { rowNumber: "asc" }, take: 500, select: {
      id: true, rowNumber: true, values: true, status: true, error: true, contactId: true,
    } } },
  });
  if (!batch || !Array.isArray(batch.headers) || !batch.headers.every(h => typeof h === "string")) notFound();
  const headers = batch.headers as string[];
  const isPreview = batch.status === "PREVIEW";
  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <Link href="/admin/my-contacts?view=history" className="text-sm font-semibold text-mulberry-700 hover:underline">← Import History</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-mulberry-600">Contact intake · Batch B</p>
      <h1 className="mt-1 break-words text-2xl font-extrabold text-neutral-900">{batch.filename}</h1>
      <p className="mt-2 text-sm text-neutral-600">Uploaded {batch.createdAt.toLocaleString()} by {batch.ownerSnapshot}. Status: {batch.status === "COMPLETE" ? "Imported" : "Awaiting column confirmation"}.</p>
    </header>
    <div className="grid gap-3 sm:grid-cols-3">
      {[{ label: "File rows", number: batch.totalRows }, { label: "Queued contacts", number: batch.importedRows }, { label: "Invalid rows", number: batch.invalidRows }].map(metric =>
        <div key={metric.label} className="rounded-2xl border border-neutral-200 bg-white p-4"><div className="text-2xl font-bold text-neutral-900">{metric.number}</div><div className="text-xs text-neutral-600">{metric.label}</div></div>)}
    </div>
    {isPreview ? <ContactImportMapping batchId={batch.id} headers={headers} mapping={guessMapping(headers)}
      sample={batch.rows.slice(0, 5).map(row => Array.isArray(row.values) ? row.values.map(String) : [])} total={batch.totalRows} /> : <>
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Imported contacts remain in the unreviewed queue. Rows that failed validation remain accessible under Rejected Imports; correct them there and revalidate without uploading the entire file again. Uploading the exact same file again does not create duplicate records.</p>
      <div className="flex flex-wrap gap-3"><Link href="/admin/my-contacts/rejected-imports" className="rounded-full border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-800">Review rejected imports</Link><Link href="/admin/my-contacts?view=queue" className="rounded-full bg-mulberry-700 px-5 py-2 text-sm font-semibold text-white">View Imported Queue</Link>
        <Link href="/admin/my-contacts/import" className="rounded-full border border-neutral-200 px-5 py-2 text-sm font-semibold text-mulberry-800">Upload another file</Link></div>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600"><tr>
        <th className="px-4 py-3">Spreadsheet row</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Detail</th>
      </tr></thead><tbody className="divide-y divide-neutral-100">
        {batch.rows.map(row => <tr key={row.id}>
          <td className="px-4 py-3">{row.rowNumber}</td><td className="px-4 py-3">{row.status === "IMPORTED" ? "Imported · review required" : "Rejected during import"}</td>
          <td className="px-4 py-3 text-neutral-700">{row.contactId ? <Link className="font-semibold text-mulberry-700 hover:underline" href={`/admin/my-contacts/${row.contactId}`}>View queued contact</Link> : <>{row.error || "Needs correction"} · <Link className="font-semibold text-red-800 underline" href={`/admin/my-contacts/rejected-imports/${row.id}`}>Correct row</Link></>}</td>
        </tr>)}
      </tbody></table></div>
    </>}
  </div>;
}
