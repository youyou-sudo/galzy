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
        'raw',
        new TextEncoder().encode(token),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      )
      const buf = await crypto.subtle.sign(
        { name: 'HMAC', hash: 'SHA-256' },
        key,
        new TextEncoder().encode(`/${path}:${expire}`),
      )
      return (
        btoa(String.fromCharCode(...new Uint8Array(buf)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_') +
        ':' +
        expire
      )
    }

    type AlistSettings = {
      token: string
      linkExpiration: number // 小时
    }

    let alistSettingsCache: AlistSettings | null = null

    const loadAlistSettings = async (): Promise<AlistSettings> => {
      const [tokenRow, expirationRow] = await Promise.all([
        db.selectFrom('galrc_setting_items')
          .select('value')
          .where('key', '=', 'token')
          .executeTakeFirst(),
        db.selectFrom('galrc_setting_items')
          .select('value')
          .where('key', '=', 'link_expiration')
          .executeTakeFirst(),
      ])

      if (!tokenRow?.value) {
        throw new Error('缺少 Alist token 配置')
      }

      return {
        token: tokenRow.value as unknown as string,
        linkExpiration: Number(expirationRow?.value) || 1,
      }
    }

    const alistDownloadGet = async (path: string) => {
      if (!alistSettingsCache) {
        alistSettingsCache = await loadAlistSettings()
      }

      const now = Math.floor(Date.now() / 1000)
      const expiration = now + alistSettingsCache.linkExpiration * 3600
      const sign = await hmacSha256Sign(path, expiration, alistSettingsCache.token)

      return {
        success: true,
        message: '哼哼喵（得意），找到啦～',
        raw_url: `${process.env.OPENLIST_HOST}/d/${encodeURIComponent(path)}?sign=${sign}`,
        sign,
      }
    }
    const [, error, res] = t(await alistDownloadGet(path))
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    return res
  },
  async Worker() {
    const [, error, res] = t(
      await db
        .selectFrom('galrc_cloudflare')
        .selectAll()
        .orderBy('id')
        .execute(),
    )
    if (error)
      throw status(401, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    return res
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
