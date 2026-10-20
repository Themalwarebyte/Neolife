import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/server/db/prisma";
import { addFollowUp, completeFollowUp } from "../src/app/admin/(protected)/actions";

/** Real Prisma integration against the existing disposable local test database. */
const { caller } = vi.hoisted(() => ({ caller: { current: null as null | { id: string; role: string } } }));
vi.mock("@/server/auth/requireCrmUser", () => ({
  requireCrmUser: async () => {
    if (!caller.current) throw new Error("UNAUTHENTICATED");
    return caller.current;
  },
  requireAdmin: async () => { throw new Error("FORBIDDEN"); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const runIfDb = process.env.DATABASE_URL ? describe : describe.skip;
const staffA = { id: "Phase2StaffAAAAAAAAAAAAAAAAAAAA", role: "staff" };
const staffB = { id: "Phase2StaffBBBBBBBBBBBBBBBBBBBB", role: "staff" };
const ids: string[] = [];
let a = "";
let b = "";

function data(values: Record<string,string>): FormData {
  const fd = new FormData();
  for (const [key,value] of Object.entries(values)) fd.set(key,value);
  return fd;
}

runIfDb("Phase 2 scheduled follow-up actions", () => {
  beforeAll(async () => {
    // Idempotent fixture cleanup is strictly limited to synthetic test IDs.
    const old = await prisma.lead.findMany({
      where: { phone: { in: ["+254711999901", "+254711999902"] } },
      select: { id: true },
    });
    const oldIds = old.map(row => row.id);
    if (oldIds.length) {
      await prisma.leadEvent.deleteMany({ where: { leadId: { in: oldIds } } });
      await prisma.lead.deleteMany({ where: { id: { in: oldIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [staffA.id, staffB.id] } } });
    for (const u of [staffA,staffB]) {
      await prisma.user.create({
        data: { id:u.id, name:u.id, email:`${u.id.toLowerCase()}@test.local`, role:u.role },
      });
      ids.push(u.id);
    }
    const leadA = await prisma.lead.create({ data: {
      firstName:"Phase2 A", phone:"+254711999901", consent:true, assignedUserId:staffA.id,
    } });
    const leadB = await prisma.lead.create({ data: {
      firstName:"Phase2 B", phone:"+254711999902", consent:true, assignedUserId:staffB.id,
    } });
    a = leadA.id; b=leadB.id;
  });
  afterAll(async () => {
    const leadIds = [a,b].filter(Boolean);
    if (leadIds.length) {
      await prisma.leadEvent.deleteMany({where:{leadId:{in:leadIds}}});
      await prisma.lead.deleteMany({where:{id:{in:leadIds}}});
    }
    if (ids.length) await prisma.user.deleteMany({where:{id:{in:ids}}});
  });

  it("persists a dated task and a follow-up scheduled audit event", async () => {
    caller.current = staffA;
    const dueAt = new Date(Date.now()+86400000).toISOString();
    const result = await addFollowUp(null, data({ id:a, note:"Call tomorrow", dueAtIso:dueAt }));
    expect(result.status).toBe("success");
    const task = await prisma.followUp.findFirst({ where:{leadId:a,note:"Call tomorrow"} });
    expect(task?.dueAt?.toISOString()).toBe(dueAt);
    expect(task?.completedAt).toBeNull();
    expect(await prisma.leadEvent.count({where:{leadId:a,type:"follow_up_scheduled"}})).toBe(1);
  });

  it("does not allow staff to schedule a task on another owner's lead", async () => {
    caller.current = staffB;
    const result = await addFollowUp(null, data({id:a,note:"Illicit task",dueAtIso:""}));
    expect(result.status).toBe("error");
    expect(await prisma.followUp.count({where:{leadId:a,note:"Illicit task"}})).toBe(0);
  });

  it("refuses to complete another staff member's task", async () => {
    const task = await prisma.followUp.findFirstOrThrow({where:{leadId:a,dueAt:{not:null}}});
    caller.current = staffB;
    expect((await completeFollowUp(null,data({followUpId:task.id}))).status).toBe("error");
    expect((await prisma.followUp.findUniqueOrThrow({where:{id:task.id}})).completedAt).toBeNull();
  });

  it("marks the task complete exactly once with an audit event", async () => {
    const task = await prisma.followUp.findFirstOrThrow({where:{leadId:a,dueAt:{not:null}}});
    caller.current = staffA;
    expect((await completeFollowUp(null,data({followUpId:task.id}))).status).toBe("success");
    expect((await completeFollowUp(null,data({followUpId:task.id}))).status).toBe("success");
    expect((await prisma.followUp.findUniqueOrThrow({where:{id:task.id}})).completedAt).not.toBeNull();
    expect(await prisma.leadEvent.count({where:{leadId:a,type:"follow_up_completed"}})).toBe(1);
  });

  it("preserves plain notes as non-tasks", async () => {
    caller.current = staffB;
    expect((await addFollowUp(null,data({id:b,note:"Legacy-style note",dueAtIso:""}))).status).toBe("success");
    const note = await prisma.followUp.findFirstOrThrow({where:{leadId:b,note:"Legacy-style note"}});
    expect(note.dueAt).toBeNull();
    expect((await completeFollowUp(null,data({followUpId:note.id}))).status).toBe("error");
  });
});
