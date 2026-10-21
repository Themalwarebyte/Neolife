/** Database-backed Phase 28B triage. Only call after current CRM authorization. */
import { prisma } from "@/server/db/prisma";
import {
  buildTriageWhere,
  explainTriage,
  TRIAGE_PAGE_SIZE,
  type TriageView,
  type TriageViewer,
  type TriageWindowDays,
  type TriageTotals,
} from "@/lib/crm-triage";

export async function loadTriageTotals(
  viewer: TriageViewer,
  days: TriageWindowDays,
  now: Date = new Date(),
): Promise<TriageTotals> {
  const [all, overdue, review, upcoming, unassigned] = await Promise.all([
    prisma.lead.count({ where: buildTriageWhere(viewer, "all", days, now) }),
    prisma.lead.count({ where: buildTriageWhere(viewer, "overdue", days, now) }),
    prisma.lead.count({ where: buildTriageWhere(viewer, "review", days, now) }),
    prisma.lead.count({ where: buildTriageWhere(viewer, "upcoming", days, now) }),
    viewer.role === "admin" ? prisma.lead.count({ where: buildTriageWhere(viewer, "unassigned", days, now) }) : Promise.resolve(0),
  ]);
  return { all, overdue, review, upcoming, unassigned };
}

export async function loadTriageQueue(
  viewer: TriageViewer,
  view: TriageView,
  days: TriageWindowDays,
  requestedPage: number,
  now: Date = new Date(),
) {
  const totals = await loadTriageTotals(viewer, days, now);
  const total = viewer.role === "admin" || view !== "unassigned" ? totals[view] : 0;
  const pages = Math.max(1, Math.ceil(total / TRIAGE_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pages);
  const records = await prisma.lead.findMany({
    where: buildTriageWhere(viewer, view, days, now),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: TRIAGE_PAGE_SIZE,
    skip: (page - 1) * TRIAGE_PAGE_SIZE,
    select: {
      id: true, firstName: true, lastName: true, status: true,
      interestType: true, assignedUserId: true,
      assignedUser: { select: { name: true } },
      createdAt: true, updatedAt: true,
      events: {
        where: { type: "qualification_reviewed" },
        take: 1,
        select: { id: true },
      },
    },
  });
  const ids = records.map(record => record.id);
  const [overdueDates, upcomingDates] = ids.length > 0 ? await Promise.all([
    prisma.followUp.groupBy({
      by: ["leadId"],
      where: { leadId: { in: ids }, completedAt: null, dueAt: { lt: now } },
      _min: { dueAt: true },
    }),
    prisma.followUp.groupBy({
      by: ["leadId"],
      where: { leadId: { in: ids }, completedAt: null, dueAt: {
        gte: now, lte: new Date(now.getTime() + days * 86_400_000),
      } },
      _min: { dueAt: true },
    }),
  ]) : [[], []];
  const overdueById = new Map(overdueDates.map(row => [row.leadId, row._min.dueAt]));
  const upcomingById = new Map(upcomingDates.map(row => [row.leadId, row._min.dueAt]));
  const leads = records.map(record => ({
    ...record,
    ...explainTriage({
      status: record.status,
      assignedUserId: record.assignedUserId,
      hasQualificationReview: record.events.length > 0,
      overdueAt: overdueById.get(record.id) ?? null,
      upcomingAt: upcomingById.get(record.id) ?? null,
    }, now),
    overdueAt: overdueById.get(record.id) ?? null,
    upcomingAt: upcomingById.get(record.id) ?? null,
  }));
  return { totals, total, page, pages, leads };
}
