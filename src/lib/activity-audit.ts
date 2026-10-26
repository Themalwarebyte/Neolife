import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

export type AuditQuery = Record<string, string | string[] | undefined>;
export type ActivityAuditFilters = {
  actorId: string;
  action: string;
  outcome: "" | "SUCCESS" | "PARTIAL" | "FAILURE";
  from: string;
  to: string;
  page: number;
};

function single(query: AuditQuery, key: string): string {
  return typeof query[key] === "string" ? query[key].trim() : "";
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseActivityAuditFilters(query: AuditQuery): ActivityAuditFilters {
  const rawPage = Number(single(query, "page"));
  const outcomeRaw = single(query, "outcome");
  const actionRaw = single(query, "action");
  const fromRaw = single(query, "from");
  const toRaw = single(query, "to");
  const actorRaw = single(query, "actor");
  const from = validDate(fromRaw) ? fromRaw : "";
  const to = validDate(toRaw) ? toRaw : "";
  const rangeOkay = !from || !to || from <= to;
  return {
    actorId: actorRaw.length <= 180 && !/[\u0000-\u001f\u007f]/.test(actorRaw) ? actorRaw : "",
    action: /^[A-Z0-9_:-]{1,100}$/.test(actionRaw) ? actionRaw : "",
    outcome: ["SUCCESS", "PARTIAL", "FAILURE"].includes(outcomeRaw) ? outcomeRaw as ActivityAuditFilters["outcome"] : "",
    from: rangeOkay ? from : "",
    to: rangeOkay ? to : "",
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1,
  };
}

export type ActivityAuditInput = {
  actorUserId?: string | null;
  actorSnapshot: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entitySnapshot?: string | null;
  outcome: "SUCCESS" | "PARTIAL" | "FAILURE";
  details?: Prisma.InputJsonValue;
};

/** Best-effort audit writes never roll back an already completed business action. */
export async function recordActivityAudit(input: ActivityAuditInput): Promise<boolean> {
  try {
    await prisma.activityAuditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorSnapshot: input.actorSnapshot.slice(0, 180),
        action: input.action.slice(0, 100),
        entityType: input.entityType.slice(0, 80),
        entityId: input.entityId?.slice(0, 180) ?? null,
        entitySnapshot: input.entitySnapshot?.slice(0, 180) ?? null,
        outcome: input.outcome,
        details: input.details,
      },
    });
    return true;
  } catch (error) {
    // Never log details or payloads; record only the error class.
    console.error("[activity-audit] write failed", error instanceof Error ? error.name : "unknown");
    return false;
  }
}
