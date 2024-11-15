import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (process.env.SKIP_PRISMA_BUILD !== "true" ? new PrismaClient() : null);

if (
  process.env.NODE_ENV !== "production" &&
  process.env.SKIP_PRISMA_BUILD !== "true"
) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
