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
        throw new Error('缺少 openlist token 配置')
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

      const workerList = await this.Worker()

      if (!workerList || workerList.length === 0) {
        throw status(500, '没有可用的 Worker 喵~')
      }

      // 随机选择一个 worker
      const randomWorker = workerList[Math.floor(Math.random() * workerList.length)]

      return {
        success: true,
        message: '哼哼喵（得意），找到啦～',
        raw_url: `${randomWorker.url_endpoint}/${encodeURIComponent(path)}?sign=${sign}`,
        sign,
      }
    }
    const [, error, res] = t(await alistDownloadGet(path))
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    const result = structuredClone(res)
    return result
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
    try {
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
            state: false,
            enable: false,
            duration: 0,
            errors: 0,
            requests: 0,
            responseBodySize: 0,
            subrequests: 0,
            updateTime: null,
          })
          .executeTakeFirst()
      }
    } catch (error) {
      console.log(error)
      throw status(400, `服务出错了喵~，Error:${JSON.stringify(error)}`)
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
