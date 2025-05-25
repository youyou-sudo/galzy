"use server";
import { db } from "@/lib/kysely";

export const workerDataGet = async () => {
  const data = await db
    .selectFrom("galrc_cloudflare")
    .selectAll()
    .orderBy("id")
    .execute();
  return data;
};
