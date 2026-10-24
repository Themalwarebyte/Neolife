import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;
function one(query: Query, key: string) { return typeof query[key] === "string" ? query[key] as string : ""; }
const VIEWS = ["main", "queue", "archived", "followups"] as const;
type ExportView = typeof VIEWS[number];

export default async function ContactExportAuthorizePage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireCrmUser();
  if (user.mustChangePassword) redirect("/admin/change-password");
  const query = await searchParams;
  const view = (VIEWS as readonly string[]).includes(one(query, "view")) ? one(query, "view") as ExportView : "main";
  const all = user.role === "admin" && one(query, "scope") === "all";
  const credential = await prisma.contactExportCredential.findUnique({ where: { userId: user.id }, select: { createdAt: true, lockedUntil: true } });
  const locked = !!credential?.lockedUntil && credential.lockedUntil > new Date();
  const error = one(query, "error");
  const back = `/admin/my-contacts?view=${view}${all ? "&scope=all" : ""}`;
  const hidden = <><input type="hidden" name="view" value={view}/>{all ? <input type="hidden" name="scope" value="all"/> : null}</>;
  return <div className="mx-auto max-w-2xl space-y-6">
    <header><Link href={back} className="text-sm font-semibold text-mulberry-700 hover:underline">← Back to contacts</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-mulberry-600">Secure export</p>
      <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Authenticate before exporting</h1>
      <p className="mt-2 text-sm text-neutral-600">Contact exports contain private information. On first use, verify your account password and create a four-digit export PIN. Future exports require that PIN. Resetting a forgotten PIN requires your current account password.</p>
    </header>
    {one(query, "pinSetup") === "1" ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Export PIN saved. Enter it below to authenticate your first download.</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error === "password" ? "Password verification failed. Check your password and try again." : error === "passwordLocked" ? "PIN setup/reset is temporarily locked after five failed password checks within 15 minutes. Try again after the 15-minute failure window clears." : error === "pin" ? "PIN was incorrect. Repeated failures temporarily lock exports." : error === "locked" ? "Export PIN is temporarily locked after repeated failed attempts. Try again after the lock expires or reset it with your account password." : "The export security request could not be completed. Review the fields and retry."}</p> : null}
    {!credential ? <form method="POST" action="/admin/my-contacts/export/security" className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
      {hidden}<input type="hidden" name="mode" value="setup"/>
      <h2 className="text-lg font-bold text-neutral-900">Set up your export PIN</h2>
      <label className="block text-sm font-semibold text-neutral-800">Current account password<input type="password" name="password" required autoComplete="current-password" maxLength={128} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-neutral-800">New four-digit PIN<input type="password" name="pin" required inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal tracking-widest"/></label>
        <label className="block text-sm font-semibold text-neutral-800">Confirm PIN<input type="password" name="pinConfirm" required inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal tracking-widest"/></label>
      </div>
      <p className="text-xs text-neutral-600">Avoid an easily guessed PIN such as 0000, 1111 or 1234. The PIN is stored only as a salted scrypt hash.</p>
      <button className="rounded-full bg-mulberry-700 px-5 py-3 text-sm font-semibold text-white">Verify password and create PIN</button>
    </form> : <>
      <form method="POST" action="/admin/my-contacts/export" className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        {hidden}<h2 className="text-lg font-bold text-neutral-900">Export {view === "followups" ? "contact follow-ups" : view === "queue" ? "Imported Queue" : view === "archived" ? "archived contacts" : "Main Contacts"}</h2>
        <p className="text-sm text-neutral-600">Export PIN created {credential.createdAt.toLocaleString()}. Maximum 1,000 records per export.</p>
        {locked ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">PIN is locked until {credential.lockedUntil?.toLocaleString()}.</p> : null}
        <label className="block text-sm font-semibold text-neutral-800">Four-digit export PIN<input type="password" name="pin" required inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="one-time-code" disabled={locked} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal tracking-widest"/></label>
        <button disabled={locked} className="rounded-full bg-mulberry-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Authenticate and download CSV</button>
      </form>
      <form method="POST" action="/admin/my-contacts/export/security" className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        {hidden}<input type="hidden" name="mode" value="reset"/>
        <h2 className="text-base font-bold text-neutral-900">Reset export PIN</h2>
        <p className="text-sm text-neutral-600">Forgotten or locked PIN? Verify your current account password to replace it.</p>
        <label className="block text-sm font-semibold text-neutral-800">Current account password<input type="password" name="password" required autoComplete="current-password" maxLength={128} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal"/></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-neutral-800">New PIN<input type="password" name="pin" required inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal tracking-widest"/></label>
          <label className="block text-sm font-semibold text-neutral-800">Confirm PIN<input type="password" name="pinConfirm" required inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-normal tracking-widest"/></label></div>
        <button className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800">Verify password and reset PIN</button>
      </form>
    </>}
  </div>;
}
