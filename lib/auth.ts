import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";

import { dbConfig } from "@/lib/kysely";

export const auth = betterAuth({
  database: new Pool(dbConfig),
  user: {
    modelName: "galrc_user",
  },
  session: {
    modelName: "galrc_session",
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    modelName: "galrc_account",
  },
  verification: {
    modelName: "galrc_verification",
  },
  plugins: [nextCookies(), admin()],

  emailAndPassword: {
    enabled: true,
  },
});
