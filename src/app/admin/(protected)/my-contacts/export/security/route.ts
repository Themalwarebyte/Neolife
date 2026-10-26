import { auth } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";
import { recordActivityAudit } from "@/lib/activity-audit";
import { getCrmUser } from "@/server/auth/requireCrmUser";
import { hashExportPin, isWeakExportPin } from "@/lib/contact-export-pin";
import { isFourDigitExportPin } from "@/lib/contact-workflow";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const VIEWS = new Set(["main", "queue", "archived", "followups"]);
const PASSWORD_FAILURE_LIMIT = 5;
const PASSWORD_FAILURE_WINDOW_MS = 15 * 60 * 1000;
function destination(request: Request, view: string, scopeAll: boolean, error?: string, setup?: boolean): Response {
  const url = new URL("/admin/my-contacts/export/authorize", request.url);
  url.searchParams.set("view", VIEWS.has(view) ? view : "main");
  if (scopeAll) url.searchParams.set("scope", "all");
  if (error) url.searchParams.set("error", error);
  if (setup) url.searchParams.set("pinSetup", "1");
  return Response.redirect(url, 303);
}
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const configured = process.env.BETTER_AUTH_URL;
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(configured || request.url).origin; } catch { return false; }
}

export async function POST(request: Request): Promise<Response> {
  const user = await getCrmUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: PRIVATE_HEADERS });
  if (user.mustChangePassword) return new Response("Password update required", { status: 403, headers: PRIVATE_HEADERS });
  if (!sameOrigin(request)) return new Response("Invalid request origin", { status: 403, headers: PRIVATE_HEADERS });
  const form = await request.formData();
  const mode = form.get("mode");
  const viewValue = form.get("view");
  const view = typeof viewValue === "string" && VIEWS.has(viewValue) ? viewValue : "main";
  const scopeAll = user.role === "admin" && form.get("scope") === "all";
  const password = form.get("password");
  const pin = form.get("pin");
  const confirm = form.get("pinConfirm");
  if ((mode !== "setup" && mode !== "reset") || typeof password !== "string" || password.length < 1 || password.length > 128 ||
      typeof pin !== "string" || typeof confirm !== "string" ||
      !isFourDigitExportPin(pin) || pin !== confirm) {
    return destination(request, view, scopeAll, "fields");
  }
  if (isWeakExportPin(pin)) return destination(request, view, scopeAll, "fields");
  const existing = await prisma.contactExportCredential.findUnique({ where: { userId: user.id } });
  if (mode === "setup" && existing) return destination(request, view, scopeAll, "fields");
  if (mode === "reset" && !existing) return destination(request, view, scopeAll, "fields");
  let passwordCheck: "verified" | "invalid" | "locked" | "unavailable";
  try {
    passwordCheck = await prisma.$transaction(async tx => {
      // Serialize password checks per account so concurrent requests cannot all
      // pass the failure-count check before any of them records a failed attempt.
      const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE
      `;
      if (lockedUsers.length !== 1) return "unavailable" as const;

      const windowStart = new Date(Date.now() - PASSWORD_FAILURE_WINDOW_MS);
      const recentFailures = await tx.contactExportSecurityEvent.count({
        where: {
          userId: user.id,
          action: "EXPORT_PIN_PASSWORD_VERIFICATION_FAILED",
          createdAt: { gte: windowStart },
        },
      });
      if (recentFailures >= PASSWORD_FAILURE_LIMIT) {
        await tx.contactExportSecurityEvent.create({
          data: {
            userId: user.id,
            actorSnapshot: user.name,
            action: "EXPORT_PIN_PASSWORD_VERIFICATION_THROTTLED",
            detail: mode,
          },
        });
        return "locked" as const;
      }

      try {
        await auth.api.verifyPassword({ body: { password }, headers: request.headers });
      } catch {
        await tx.contactExportSecurityEvent.create({
          data: {
            userId: user.id,
            actorSnapshot: user.name,
            action: "EXPORT_PIN_PASSWORD_VERIFICATION_FAILED",
            detail: mode,
          },
        });
        return "invalid" as const;
      }

      return "verified" as const;
    }, { maxWait: 10000, timeout: 30000 });
  } catch {
    return destination(request, view, scopeAll, "fields");
  }

  if (passwordCheck !== "verified") {
    await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.name, action: passwordCheck === "locked" ? "EXPORT_PIN_PASSWORD_VERIFICATION_THROTTLED" : passwordCheck === "invalid" ? "EXPORT_PIN_PASSWORD_VERIFICATION_FAILED" : "EXPORT_PIN_PASSWORD_VERIFICATION_UNAVAILABLE", entityType: "EXPORT_CREDENTIAL", entitySnapshot: "Contact export PIN", outcome: "FAILURE", details: { mode } });
  }
  if (passwordCheck === "locked") return destination(request, view, scopeAll, "passwordLocked");
  if (passwordCheck === "invalid") return destination(request, view, scopeAll, "password");
  if (passwordCheck === "unavailable") return destination(request, view, scopeAll, "fields");

  const pinHash = await hashExportPin(pin);
  try {
    await prisma.$transaction(async tx => {
      if (mode === "setup") {
        await tx.contactExportCredential.create({ data: { userId: user.id, pinHash } });
        await tx.contactExportSecurityEvent.create({ data: { userId: user.id, actorSnapshot: user.name, action: "EXPORT_PIN_CREATED" } });
      } else {
        await tx.contactExportCredential.update({ where: { userId: user.id }, data: { pinHash, failedAttempts: 0, lockedUntil: null, lastVerifiedAt: new Date() } });
        await tx.contactExportSecurityEvent.create({ data: { userId: user.id, actorSnapshot: user.name, action: "EXPORT_PIN_RESET" } });
      }
    });
  } catch {
    return destination(request, view, scopeAll, "fields");
  }
  await recordActivityAudit({ actorUserId: user.id, actorSnapshot: user.name, action: mode === "setup" ? "EXPORT_PIN_CREATED" : "EXPORT_PIN_RESET", entityType: "EXPORT_CREDENTIAL", entitySnapshot: "Contact export PIN", outcome: "SUCCESS", details: { mode } });
  return destination(request, view, scopeAll, undefined, true);
}
