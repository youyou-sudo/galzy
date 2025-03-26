import { PrismaClient as PrismaClientPostgres } from "@/prisma/DB2Client/alistClient";

const prismaClientSingleton = () => {
  return new PrismaClientPostgres();
};

declare global {
  // eslint-disable-next-line no-var
  var prismaDb2: ReturnType<typeof prismaClientSingleton> | undefined;
}

const prismaDb2 = global.prismaDb2 ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  global.prismaDb2 = prismaDb2;
}

export default prismaDb2;
