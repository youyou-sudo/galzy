"use server";

import { db } from "@/lib/kysely";

export const configFormPut = async ({
  id,
  a_email,
  a_key,
  account_id,
  woker_name,
  url_endpoint,
}: {
  id?: string;
  a_email: string;
  a_key: string;
  account_id: string;
  woker_name: string;
  url_endpoint: string;
}) => {
  if (id) {
    // 修改数据
    await db
      .updateTable("galrc_cloudflare")
      .set({
        a_email,
        a_key,
        account_id,
        woker_name,
        url_endpoint,
      })
      .where("id", "=", Number(id))
      .executeTakeFirst();
  } else {
    // 创建数据
    await db
      .insertInto("galrc_cloudflare")
      .values({
        a_email,
        a_key,
        account_id,
        woker_name,
        url_endpoint,
      })
      .executeTakeFirst();
  }
};
