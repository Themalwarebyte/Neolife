import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { crmAnalyticsRangeStart, type CrmAnalyticsRange } from "@/lib/qualification-review";
import { buildCohortAnalytics } from "@/lib/cohort-analytics";

/** Load PII-free cohort summaries within the caller's CRM visibility boundary. */
export async function loadCohortAnalytics(
  user: { id: string; role: string },
  range: CrmAnalyticsRange,
  since: Date = crmAnalyticsRangeStart(range),
  now: Date = new Date(),
) {
  const scope: Prisma.LeadWhereInput = user.role === "admin" ? {} : { assignedUserId: user.id };
  const leads = await prisma.lead.findMany({
    where: { ...scope, createdAt: { gte: since, lte: now } },
    select: { id: true, firstTouchSource: true, utmCampaign: true, status: true },
  });
  const ids = leads.map((lead) => lead.id);

  const [events, scheduledFollowUps] = await Promise.all([
    ids.length > 0
      ? prisma.funnelEvent.findMany({
          where: {
            leadId: { in: ids },
            type: { in: ["lead_qualified", "registration_complete"] },
            createdAt: { lte: now },
          },
          select: { leadId: true, type: true },
        })
      : Promise.resolve([]),
    prisma.followUp.findMany({
      where: {
        createdAt: { gte: since, lte: now },
        dueAt: { not: null },
        lead: scope,
      },
      select: { completedAt: true },
    }),
  ]);

  return buildCohortAnalytics(leads, events, scheduledFollowUps);
}
