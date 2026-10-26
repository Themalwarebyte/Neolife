import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { recordActivityAudit } from "../src/lib/activity-audit";

const dbEnabled = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      /test|qa|ci/i.test(url.pathname);
  } catch {
    return false;
  }
})();
const runIfDb = dbEnabled ? describe : describe.skip;

runIfDb("Owner activity audit — isolated PostgreSQL integration", () => {
  const tag = `bf-audit-${randomUUID()}`;
  const actorA = randomUUID().replace(/-/g, "");
  const actorB = randomUUID().replace(/-/g, "");
  const actorDeleted = randomUUID().replace(/-/g, "");
  const actorIds = [actorA, actorB, actorDeleted];

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: actorA, name: `${tag} Actor A`, email: `${actorA}@example.test`, role: "staff" },
        { id: actorB, name: `${tag} Actor B`, email: `${actorB}@example.test`, role: "staff" },
        { id: actorDeleted, name: `${tag} Historical Actor`, email: `${actorDeleted}@example.test`, role: "staff" },
      ],
    });
  });

  afterAll(async () => {
    await prisma.activityAuditEvent.deleteMany({ where: { entitySnapshot: { startsWith: tag } } });
    await prisma.activityAuditEvent.deleteMany({ where: { actorUserId: { in: actorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
    await prisma.$disconnect();
  });

  it("records a successful monitored activity with an actor snapshot", async () => {
    const entitySnapshot = `${tag}:writer`;
    const ok = await recordActivityAudit({
      actorUserId: actorA,
      actorSnapshot: `${tag} Actor A`,
      action: "CONTACT_BULK_ARCHIVE",
      entityType: "CONTACT_BATCH",
      entityId: randomUUID(),
      entitySnapshot,
      outcome: "SUCCESS",
      details: { requestedCount: 3, succeededCount: 3 },
    });
    expect(ok).toBe(true);
    const saved = await prisma.activityAuditEvent.findFirst({ where: { entitySnapshot } });
    expect(saved).toMatchObject({
      actorUserId: actorA,
      actorSnapshot: `${tag} Actor A`,
      action: "CONTACT_BULK_ARCHIVE",
      entityType: "CONTACT_BATCH",
      outcome: "SUCCESS",
    });
    expect(saved?.details).toEqual({ requestedCount: 3, succeededCount: 3 });
  });

  it("supports actor, action, outcome and date filtering plus stable pagination", async () => {
    const start = new Date("2026-10-20T00:00:00.000Z");
    const end = new Date("2026-10-21T00:00:00.000Z");
    await prisma.activityAuditEvent.createMany({
      data: [
        ...Array.from({ length: 55 }, (_, i) => ({
          actorUserId: actorA,
          actorSnapshot: `${tag} Actor A`,
          action: "CONTACT_BULK_ARCHIVE",
          entityType: "CONTACT_BATCH",
          entityId: `${tag}:entity:${i}`,
          entitySnapshot: `${tag}:bulk:${i}`,
          outcome: "SUCCESS",
          details: { requestedCount: i + 1 },
          createdAt: new Date(start.getTime() + i * 1000),
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          actorUserId: actorB,
          actorSnapshot: `${tag} Actor B`,
          action: "CONTACT_BULK_RESTORE",
          entityType: "CONTACT_BATCH",
          entityId: `${tag}:other:${i}`,
          entitySnapshot: `${tag}:other:${i}`,
          outcome: "FAILURE",
          details: { failedCount: i + 1 },
          createdAt: new Date(start.getTime() + i * 1000),
        })),
      ],
    });

    const where = {
      actorUserId: actorA,
      action: "CONTACT_BULK_ARCHIVE",
      outcome: "SUCCESS",
      createdAt: { gte: start, lt: end },
      entitySnapshot: { startsWith: `${tag}:bulk:` },
    };
    const total = await prisma.activityAuditEvent.count({ where });
    const page1 = await prisma.activityAuditEvent.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 0, take: 50,
      select: { id: true, actorUserId: true, action: true, outcome: true, createdAt: true },
    });
    const page2 = await prisma.activityAuditEvent.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 50, take: 50,
      select: { id: true, actorUserId: true, action: true, outcome: true, createdAt: true },
    });
    expect(total).toBe(55);
    expect(page1).toHaveLength(50);
    expect(page2).toHaveLength(5);
    expect(new Set([...page1, ...page2].map((row) => row.id)).size).toBe(55);
    expect([...page1, ...page2].every((row) => row.actorUserId === actorA && row.action === "CONTACT_BULK_ARCHIVE" && row.outcome === "SUCCESS")).toBe(true);
  });

  it("retains actor snapshot and audit row when the user account is deleted", async () => {
    const entitySnapshot = `${tag}:actor-retention`;
    const ok = await recordActivityAudit({
      actorUserId: actorDeleted,
      actorSnapshot: `${tag} Historical Actor`,
      action: "CONTACT_TRANSFER_APPROVED",
      entityType: "CONTACT_TRANSFER",
      entityId: randomUUID(),
      entitySnapshot,
      outcome: "SUCCESS",
      details: { decision: "APPROVE" },
    });
    expect(ok).toBe(true);
    await prisma.user.delete({ where: { id: actorDeleted } });
    const saved = await prisma.activityAuditEvent.findFirst({ where: { entitySnapshot } });
    expect(saved).toMatchObject({ actorUserId: null, actorSnapshot: `${tag} Historical Actor`, action: "CONTACT_TRANSFER_APPROVED" });
  });
});
