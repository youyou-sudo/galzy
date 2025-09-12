import { db } from '@api/libs'
import { status } from 'elysia'
import { t } from 'try'
import type { DownloadModel } from './model'

export const Download = {
  async DownloadGet({ path }: DownloadModel.path) {
    const hmacSha256Sign = async (
      path: string,
      expire: number,
      token: string,
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
        new TextEncoder().encode(`/${path}:${expire}`)
      );
      return (
        btoa(String.fromCharCode(...new Uint8Array(buf)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_") +
        ":" +
        expire
      )
    }
    let alistSettingsCache: { token: string; linkExpiration: number } | null =
      null
    const alistDownloadGet = async (path: string) => {
      if (!alistSettingsCache) {
        const [tokenData, linkExpirationData] = await Promise.all([
          db
            .selectFrom('galrc_setting_items')
            .selectAll()
            .where('key', '=', 'token')
            .executeTakeFirst(),
          db
            .selectFrom('galrc_setting_items')
            .selectAll()
            .where('key', '=', 'link_expiration')
            .executeTakeFirst(),
        ])

        alistSettingsCache = {
          token: String(tokenData?.value),
          linkExpiration: Number(linkExpirationData?.value || 1),
        }
      }
      const timestamp = Math.floor(Date.now() / 1000)
      const expiration = timestamp + 3600 * alistSettingsCache.linkExpiration
      const sign = await hmacSha256Sign(
        path,
        expiration,
        alistSettingsCache.token,
      )
      const url = `http://localhost:5244/d/${path}?sign=${sign}`
      return {
        success: true,
        message: '哼哼喵（得意），找到啦～',
        raw_url: url,
        sign: sign,
      }
    }

    const [, error, res] = await t(alistDownloadGet(path))
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    return res
  },
  async Worker() {
    const [ok, error, res] = await t(
      await db
        .selectFrom('galrc_cloudflare')
        .selectAll()
        .orderBy('id')
        .execute(),
    )
    if (error)
      throw status(401, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    if (ok) return res
  },
  async workerConfigFormPut({
    id,
    a_email,
    a_key,
    account_id,
    woker_name,
    url_endpoint,
  }: DownloadModel.workerConfigForm) {
    if (id) {
      // 修改数据
      await db
        .updateTable('galrc_cloudflare')
        .set({
          a_email,
          a_key,
          account_id,
          woker_name,
          url_endpoint,
        })
        .where('id', '=', Number(id))
        .executeTakeFirst()
    } else {
      // 创建数据
      await db
        .insertInto('galrc_cloudflare')
        .values({
          a_email,
          a_key,
          account_id,
          woker_name,
          url_endpoint,
        })
        .executeTakeFirst()
    }
  },
  async workerConfigFormDel({ id }: DownloadModel.workerConfigFormDel) {
    if (id) {
      await db
        .deleteFrom('galrc_cloudflare')
        .where('id', '=', id)
        .executeTakeFirst()
    } else {
      return status(400, `未提供 ID 喵～`)
    }
  },
  async nodeEnaledAc({ nodeId, boole }: DownloadModel.nodeEnaledAc) {
    await db
      .updateTable('galrc_cloudflare')
      .set({
        enable: boole,
      })
      .where('id', '=', nodeId)
      .execute()
  },
}
