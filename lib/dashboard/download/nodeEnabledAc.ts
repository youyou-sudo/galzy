"use server";

import { db } from "@/lib/kysely";

export const nodeEnaledAc = async (nodeId: number, boole: boolean) => {
  await db
    .updateTable("galrc_cloudflare")
    .set({
      enable: boole,
    })
    .where("id", "=", nodeId)
    .execute();
};
