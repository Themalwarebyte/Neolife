import Link from "next/link";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { ManualContactForm } from "@/components/admin/ManualContactForm";

export const dynamic = "force-dynamic";
export default async function NewManualContactPage() {
  await requireCrmUser();
  return <div className="mx-auto max-w-4xl space-y-5">
    <div>
      <Link href="/admin/my-contacts" className="text-sm font-semibold text-mulberry-700 hover:underline">← My Contacts</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-mulberry-600">Personal intake · Batch A</p>
      <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Add a contact</h1>
      <p className="mt-2 text-sm text-neutral-600">This person will be saved in your Main Contacts. The CRM lead pipeline is not affected.</p>
    </div>
    <ManualContactForm />
  </div>;
}
