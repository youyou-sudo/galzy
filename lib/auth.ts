import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@/prisma/DBClient";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mongodb",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies(), admin()], // make sure this is the last plugin in the array
});
