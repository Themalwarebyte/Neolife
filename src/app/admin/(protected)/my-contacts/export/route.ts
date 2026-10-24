import { getCrmUser } from "@/server/auth/requireCrmUser";
import { prisma } from "@/server/db/prisma";
import { contactListScope } from "@/lib/contact-intake";
import { CONTACT_EXPORT_LIMIT, csvRows } from "@/lib/contact-processing";
import { verifyExportPin } from "@/lib/contact-export-pin";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Pragma": "no-cache" };
const VIEWS = new Set(["main", "queue", "archived", "followups"]);
function authorizeUrl(request: Request, view: string, scopeAll: boolean, error?: string): Response {
  const url = new URL("/admin/my-contacts/export/authorize", request.url);
  url.searchParams.set("view", VIEWS.has(view) ? view : "main");
  if (scopeAll) url.searchParams.set("scope", "all");
  if (error) url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  try { return !!origin && new URL(origin).origin === new URL(process.env.BETTER_AUTH_URL || request.url).origin; } catch { return false; }
}

/** Legacy download links are redirected to the PIN gate; GET never exports contact data. */
export async function GET(request: Request): Promise<Response> {
  const user = await getCrmUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: PRIVATE_HEADERS });
  if (user.mustChangePassword) return new Response("Password update required", { status: 403, headers: PRIVATE_HEADERS });
  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "main";
  const all = user.role === "admin" && url.searchParams.get("scope") === "all";
  return authorizeUrl(request, view, all);
}

/** Authenticated POST: a salted, rate-limited four-digit PIN is required for every CSV download. */
export async function POST(request: Request): Promise<Response> {
  const user = await getCrmUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: PRIVATE_HEADERS });
  if (user.mustChangePassword) return new Response("Password update required", { status: 403, headers: PRIVATE_HEADERS });
  if (!sameOrigin(request)) return new Response("Invalid request origin", { status: 403, headers: PRIVATE_HEADERS });
  const form = await request.formData();
  const viewValue = form.get("view");
  const view = typeof viewValue === "string" && VIEWS.has(viewValue) ? viewValue : "main";
  const all = user.role === "admin" && form.get("scope") === "all";
  const pin = form.get("pin");
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) return authorizeUrl(request, view, all, "pin");

  type PinCheckResult = "missing" | "locked" | "invalid" | "verified";
  let pinCheck: PinCheckResult;

  try {
    pinCheck = await prisma.$transaction(async tx => {
      // Use the same lock order as PIN setup/reset: User, then credential.
      // The user-row lock serializes all attempts for this account. The credential
      // row lock ensures each failed PIN increments the counter from the latest value.
      const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE
      `;
      if (lockedUsers.length !== 1) return "missing" as const;

      const lockedCredentials = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ContactExportCredential" WHERE "userId" = ${user.id} FOR UPDATE
      `;
      if (lockedCredentials.length !== 1) return "missing" as const;

      const credential = await tx.contactExportCredential.findUnique({ where: { userId: user.id } });
      if (!credential) return "missing" as const;

      const now = new Date();
      if (credential.lockedUntil && credential.lockedUntil > now) return "locked" as const;

      const verified = await verifyExportPin(pin, credential.pinHash);
      if (!verified) {
        const attempts = credential.failedAttempts + 1;
        const lockMinutes = Math.min(24 * 60, 15 * (2 ** Math.min(7, Math.max(0, attempts - 5))));
        const lockedUntil = attempts >= 5 ? new Date(now.getTime() + lockMinutes * 60 * 1000) : null;

        await tx.contactExportCredential.update({
          where: { id: credential.id },
          data: { failedAttempts: attempts, lockedUntil },
        });
        await tx.contactExportSecurityEvent.create({
          data: {
            userId: user.id,
            actorSnapshot: user.name,
            action: attempts >= 5 ? "EXPORT_PIN_LOCKED" : "EXPORT_PIN_FAILED",
            detail: `attempt=${attempts}`,
          },
        });
        return attempts >= 5 ? "locked" as const : "invalid" as const;
      }

      await tx.contactExportCredential.update({
        where: { id: credential.id },
        data: { failedAttempts: 0, lockedUntil: null, lastVerifiedAt: new Date() },
      });
      return "verified" as const;
    }, { maxWait: 10000, timeout: 30000 });
  } catch {
    return authorizeUrl(request, view, all, "fields");
  }

  if (pinCheck === "missing") return authorizeUrl(request, view, all, "fields");
  if (pinCheck === "locked") return authorizeUrl(request, view, all, "locked");
  if (pinCheck === "invalid") return authorizeUrl(request, view, all, "pin");

  const category = view === "followups" ? "FOLLOWUPS" : "CONTACTS";
  const scope = contactListScope(user.role, user.id, all);
  let rows: Array<Array<string | number | boolean | null | undefined>>;
  if (view === "followups") {
    const tasks = await prisma.contactFollowUp.findMany({
      where: { contact: { is: scope } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: CONTACT_EXPORT_LIMIT + 1,
      select: { id: true, status: true, kind: true, note: true, dueAt: true, resolutionNote: true,
        resolvedAt: true, createdAt: true,
        contact: { select: { id: true, firstName: true, lastName: true, ownerSnapshot: true } } },
    });
    if (tasks.length > CONTACT_EXPORT_LIMIT) return new Response("Export exceeds 1,000 tasks. Narrow the scope before exporting.", { status: 413, headers: PRIVATE_HEADERS });
    rows = [["Task ID", "Contact ID", "First name", "Last name", "Owner", "Kind", "Status", "Due UTC", "Task details", "Outcome", "Resolved UTC", "Created UTC"]];
    rows.push(...tasks.map(t => [t.id, t.contact.id, t.contact.firstName, t.contact.lastName, t.contact.ownerSnapshot,
      t.kind, t.status, t.dueAt.toISOString(), t.note, t.resolutionNote, t.resolvedAt?.toISOString() || "", t.createdAt.toISOString()]));
  } else {
    const state = view === "queue" ? "IMPORTED_QUEUE" : view === "archived" ? "ARCHIVED" : "MAIN";
    const contacts = await prisma.contact.findMany({
      where: { ...scope, state }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: CONTACT_EXPORT_LIMIT + 1,
      select: { id: true, firstName: true, lastName: true, city: true, ownerSnapshot: true, state: true, origin: true,
        consentStatus: true, doNotContact: true, queueReviewOutcome: true, createdAt: true,
        methods: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { type: true, value: true } } },
    });
    if (contacts.length > CONTACT_EXPORT_LIMIT) return new Response("Export exceeds 1,000 contacts. Narrow the scope before exporting.", { status: 413, headers: PRIVATE_HEADERS });
    rows = [["Contact ID", "First name", "Last name", "City", "Owner", "Status", "Origin", "Consent", "Do Not Contact", "Import review", "Phones", "Emails", "Created UTC"]];
    rows.push(...contacts.map(c => [c.id, c.firstName, c.lastName, c.city, c.ownerSnapshot,
      c.state, c.origin, c.consentStatus, c.doNotContact ? "Yes" : "No", c.queueReviewOutcome,
      c.methods.filter(m => m.type === "PHONE").map(m => m.value).join("; "),
      c.methods.filter(m => m.type === "EMAIL").map(m => m.value).join("; "), c.createdAt.toISOString()]));
  }
  await prisma.contactExportAudit.create({ data: {
    actorUserId: user.id, actorSnapshot: user.name, scopeAll: all, category, view, rowCount: rows.length - 1,
  } });
  await prisma.contactExportSecurityEvent.create({ data: { userId: user.id, actorSnapshot: user.name, action: "CONTACT_EXPORT_AUTHENTICATED", detail: `view=${view};rows=${rows.length - 1}` } });
  const contents = csvRows(rows);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `neolife-contact-${view}-${date}.csv`;
  return new Response(contents, { status: 200, headers: {
    ...PRIVATE_HEADERS, "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  } });
}
