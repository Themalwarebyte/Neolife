import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  // allow global `var __db` for Prisma client in development
  // (avoids hot module replacement creating new client instances)
  var __db: PrismaClient | undefined;
}

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
};

export const prisma = globalThis.__db ?? (globalThis.__db = createPrismaClient());
