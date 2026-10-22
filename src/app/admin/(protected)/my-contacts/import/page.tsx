import Link from "next/link";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { ContactImportUpload } from "@/components/admin/ContactImportUpload";

export const dynamic = "force-dynamic";
export default async function ContactImportPage() {
  await requireCrmUser();
  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <Link href="/admin/my-contacts?view=queue" className="text-sm font-semibold text-mulberry-700 hover:underline">← Imported Queue</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-mulberry-600">Contact intake · Batch B</p>
      <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Import contact spreadsheet</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600">Private, permission-controlled uploads. Import History records the source file and any row-specific validation errors. Duplicate matching and merging will be reviewed separately in Batch C.</p>
    </header>
    <ContactImportUpload />
  </div>;
}
