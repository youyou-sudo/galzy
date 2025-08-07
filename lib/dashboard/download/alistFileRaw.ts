"use server";
import { db } from "@/lib/kysely";

// sign 计算部分
export const hmacSha256Sign = async (
  path: string,
  expire: number,
  token: string
) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const buf = await crypto.subtle.sign(
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    key,
    new TextEncoder().encode(`${path}:${expire}`)
  );
  return (
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_") +
    ":" +
    expire
  );
};

let alistSettingsCache: { token: string; linkExpiration: number } | null = null;

export const alistDownloadGet = async (path: string) => {
  if (!alistSettingsCache) {
    const [tokenData, linkExpirationData] = await Promise.all([
      db
        .selectFrom("galrc_setting_items")
        .selectAll()
        .where("key", "=", "token")
        .executeTakeFirst(),
      db
        .selectFrom("galrc_setting_items")
        .selectAll()
        .where("key", "=", "link_expiration")
        .executeTakeFirst(),
    ]);

    alistSettingsCache = {
      token: String(tokenData!.value!),
      linkExpiration: Number(linkExpirationData?.value || 1),
    };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const expiration = timestamp + 3600 * alistSettingsCache.linkExpiration;
  const sign = await hmacSha256Sign(path, expiration, alistSettingsCache.token);
  const workers = await db
    .selectFrom("galrc_cloudflare")
    .selectAll()
    .where("state", "=", true)
    .orderBy("requests", "asc")
    .execute();

  if (!workers.length) {
    return {
      success: false,
      message: "！喵～（颤抖～）当前貌似没有可用的节点喵（汗颜）",
      sign: sign,
    };
  }

  const url = `${workers[0].url_endpoint}/${path}?sign=${sign}`;
  return {
    success: true,
    message: "哼哼喵（得意），找到啦～",
    raw_url: url,
    sign: sign,
  };
};
