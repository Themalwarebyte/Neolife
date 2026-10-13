import { prisma } from "../src/server/db/prisma";

const rows = await prisma.referralCode.findMany({
  select: {
    id: true,
    userId: true,
    publicName: true,
    isActive: true,
    revokedAt: true,
  },
});
console.log(JSON.stringify(rows, null, 1));

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const active = rows.filter((r) => r.isActive && !r.revokedAt);
const counts = new Map<string, number>();
for (const r of active) {
  const k = norm(r.publicName);
  counts.set(k, (counts.get(k) ?? 0) + 1);
}
const collisions = [...counts.entries()].filter(([, c]) => c > 1);
console.log("active-row count:", active.length);
console.log("normalized active collisions:", JSON.stringify(collisions));

const nonNormalized = rows.filter(
  (r) => r.publicName !== norm(r.publicName) && r.publicName.trim().replace(/\s+/g, " ") !== r.publicName,
);
console.log("rows whose publicName contains repeated/edge whitespace:", JSON.stringify(nonNormalized));

await prisma.$disconnect();
