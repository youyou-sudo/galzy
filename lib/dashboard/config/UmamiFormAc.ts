"use server";
import { umamiFormSchema } from "@/components/dashboard/config/UmamiCard-Input";
import { db } from "@/lib/kysely";
import { z } from "zod";

export type UmamiFormSchema = z.infer<typeof umamiFormSchema>;

export const umamiConfigPut = async ({
  key,
  scripturl,
  datawebsiteid,
}: UmamiFormSchema) => {
  const configValue = JSON.stringify({
    scripturl,
    datawebsiteid,
  });
  const log = await db
    .insertInto("galrc_siteConfig")
    .values({
      key,
      config: configValue,
    })
    .onConflict((oc) =>
      oc.column("key").doUpdateSet({
        key,
        config: configValue,
      })
    )
    .execute();
  if (log) {
    return {
      success: true,
      message: "Umami 配置已更新",
    };
  }
  return {
    success: false,
    message: "Umami 配置更新失败",
  };
};

export const umamiConfigGet = async () => {
  const config = await db
    .selectFrom("galrc_siteConfig")
    .selectAll()
    .where("key", "=", "umami")
    .executeTakeFirst();
  if (!config) {
    return {
      success: false,
      message: "Umami 配置未找到",
    };
  }
  return {
    success: true,
    message: "Umami 配置已找到",
    data: config,
  };
};
