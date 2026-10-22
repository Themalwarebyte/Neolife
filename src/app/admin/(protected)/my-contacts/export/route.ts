import { getCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";
import { contactListScope } from "@/lib/contact-intake";
import { CONTACT_EXPORT_LIMIT, csvRows } from "@/lib/contact-processing";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

/** Permission-scoped, bounded exports. The caller never supplies a filename. */
export async function GET(request: Request): Promise<Response> {
  const user = await getCrmUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: PRIVATE_HEADERS });
  if (user.mustChangePassword) return new Response("Password update required", { status: 403, headers: PRIVATE_HEADERS });
  const url = new URL(request.url);
  const all = user.role === "admin" && url.searchParams.get("scope") === "all";
  const view = url.searchParams.get("view") || "main";
  const category = view === "followups" ? "FOLLOWUPS" : "CONTACTS";
  if (!["main", "queue", "archived", "followups"].includes(view)) {
    return new Response("Unsupported export view", { status: 400, headers: PRIVATE_HEADERS });
  }
  const scope = contactListScope(user.role, user.id, all);
  try {
    let rows: Array<Array<string | number | boolean | null | undefined>>;
    if (view === "followups") {
      const tasks = await prisma.contactFollowUp.findMany({
        where: { contact: { is: scope } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: CONTACT_EXPORT_LIMIT + 1,
        select: {
          id: true, status: true, kind: true, note: true, dueAt: true,
          resolutionNote: true, resolvedAt: true, createdAt: true,
          contact: { select: { id: true, firstName: true, lastName: true, ownerSnapshot: true } },
        },
      });
      if (tasks.length > CONTACT_EXPORT_LIMIT) return new Response("Export exceeds 1,000 tasks. Narrow the scope before exporting.", { status: 413, headers: PRIVATE_HEADERS });
      rows = [["Task ID", "Contact ID", "First name", "Last name", "Owner", "Kind", "Status", "Due UTC", "Task details", "Outcome", "Resolved UTC", "Created UTC"]];
      rows.push(...tasks.map(t => [t.id, t.contact.id, t.contact.firstName, t.contact.lastName, t.contact.ownerSnapshot,
        t.kind, t.status, t.dueAt.toISOString(), t.note, t.resolutionNote, t.resolvedAt?.toISOString() || "", t.createdAt.toISOString()]));
    } else {
      const state = view === "queue" ? "IMPORTED_QUEUE" : view === "archived" ? "ARCHIVED" : "MAIN";
      const contacts = await prisma.contact.findMany({
        where: { ...scope, state },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: CONTACT_EXPORT_LIMIT + 1,
        select: {
          id: true, firstName: true, lastName: true, city: true, ownerSnapshot: true,
          state: true, origin: true, consentStatus: true, doNotContact: true,
          queueReviewOutcome: true, createdAt: true,
          methods: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { type: true, value: true } },
        },
      });
      if (contacts.length > CONTACT_EXPORT_LIMIT) return new Response("Export exceeds 1,000 contacts. Narrow the scope before exporting.", { status: 413, headers: PRIVATE_HEADERS });
      rows = [["Contact ID", "First name", "Last name", "City", "Owner", "Status", "Origin", "Consent", "Do Not Contact", "Import review", "Phones", "Emails", "Created UTC"]];
      rows.push(...contacts.map(c => [c.id, c.firstName, c.lastName, c.city, c.ownerSnapshot,
        c.state, c.origin, c.consentStatus, c.doNotContact ? "Yes" : "No", c.queueReviewOutcome,
        c.methods.filter(m => m.type === "PHONE").map(m => m.value).join("; "),
        c.methods.filter(m => m.type === "EMAIL").map(m => m.value).join("; "), c.createdAt.toISOString()]));
    }
    // Persist a single attributable export event before issuing the response.
    await prisma.contactExportAudit.create({ data: {
      actorUserId: user.id, actorSnapshot: user.name,
      scopeAll: all, category, view, rowCount: rows.length - 1,
    } });
    const contents = csvRows(rows);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `neolife-contact-${view}-${date}.csv`;
    return new Response(contents, { status: 200, headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    } });
  } catch {
    return new Response("Could not prepare export. Please try again.", { status: 500, headers: PRIVATE_HEADERS });
  }
}
