import { db, sql, MeiliClient } from '@api/libs'
import { cloudflare, siteConfig, alistb, vn, vnTitles, images, tags, tagsVn, releases, releasesVn, releasesTitles, others, otherMedia, media, zhtags } from '@api/libs'
import { acquireLockKv, releaseLockKv } from '@api/libs/redis'
import { VndbSync } from '@api/modules/vndb-sync/service'
import { status } from 'elysia'
import { eq, and, desc, asc, count, lt, gt, gte, lte, like, isNull, isNotNull, inArray, notInArray } from 'drizzle-orm'
import { all } from 'radash'
import { processData } from './lib'

export const CronService = {
  async workerDataPull() {
    const lockKey = 'galzy:lock:cron:workerDataCorn'
    const lockValue = crypto.randomUUID()
    const lockTimeout = 120000

    const lock = await acquireLockKv(lockKey, lockValue, lockTimeout)
    if (!lock) {
      return
    }

    try {
      const data = await db.select().from(cloudflare)

      await all(
        data.map(async (item) => {
          try {
            const today = new Date()
            const yyyy = today.getUTCFullYear()
            const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
            const dd = String(today.getUTCDate()).padStart(2, '0')
            const dateStr = `${yyyy}-${mm}-${dd}`

            const raw = JSON.stringify({
              query: `query getBillingMetrics($accountTag: String!, $datetimeStart: String!, $datetimeEnd: String!, $scriptName: String!) { viewer { accounts(filter: {accountTag: $accountTag}) { workersInvocationsAdaptive(limit: 10, filter: { scriptName: $scriptName, date_geq: $datetimeStart, date_leq: $datetimeEnd }) { sum { duration requests subrequests responseBodySize errors }}}}}`,
              variables: {
                accountTag: item.accountId,
                datetimeStart: dateStr,
                datetimeEnd: dateStr,
                scriptName: item.wokerName,
              },
            })

            const commonHeaders = {
              'X-Auth-Email': item.aEmail,
              'X-Auth-Key': item.aKey,
              Accept: '*/*',
              Host: 'api.cloudflare.com',
            }

            // 并行发送两个请求
            const [res, res2] = await Promise.all([
              fetch('https://api.cloudflare.com/client/v4/graphql', {
                method: 'POST',
                headers: {
                  ...commonHeaders,
                  'Content-Type': 'text/plain',
                },
                body: raw,
                redirect: 'follow',
              }),
              fetch(
                `https://api.cloudflare.com/client/v4/accounts/${item.accountId}/workers/services/${item.wokerName}/environments/production?expand=routes`,
                {
                  method: 'GET',
                  headers: commonHeaders,
                },
              ),
            ])

            // 并行解析 JSON
            const [json, json2] = await Promise.all([res.json(), res2.json()])

            const result =
              json?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0]
                ?.sum ?? {}

            const result2 = json2.result.script.routes[0].pattern ?? {}
            const cleanDomain = result2.replace(/\*$/, '').replace(/\/+$/, '')
            const url = `https://${cleanDomain}`

            await db
              .update(cloudflare)
              .set({
                duration: result.duration ?? 0,
                errors: result.errors ?? 0,
                requests: result.requests ?? 0,
                responseBodySize: result.responseBodySize ?? 0,
                subrequests: result.subrequests ?? 0,
                urlEndpoint: url,
                state: (result.requests ?? 0) < 100000,
                updateTime: new Date(),
              })
              .where(eq(cloudflare.id, item.id))
          } catch (err) {
            console.error(`请求失败: ${item.accountId}, ${err}`)
            // 如果请求出错，直接将 state 设置为 false
            await db
              .update(cloudflare)
              .set({
                state: false,
                updateTime: new Date(),
              })
              .where(eq(cloudflare.id, item.id))
          }
        }),
      )
      await releaseLockKv(lockKey, lockValue)
    } catch (err) {
      console.error('workerDataPull 任务失败', err)
      await releaseLockKv(lockKey, lockValue)
    }
  },

  async alistSyncScript() {
    const lockKey = 'galzy:lock:cron:runAlistData'
    const lockValue = crypto.randomUUID()
    const lockTimeout = 120000

    const lock = await acquireLockKv(lockKey, lockValue, lockTimeout)
    if (!lock) return null

    try {
      const [alistUpInfo, alistUpTime] = await Promise.all([
        fetch(`${process.env.OPENLIST_HOST}/api/admin/index/progress`, {
          method: 'GET',
          headers: {
            Authorization: process.env.OPENLIST_API_KEY,
          },
        }),
        db
          .select()
          .from(siteConfig)
          .where(eq(siteConfig.key, 'alistUpTime'))
          .limit(1)
          .then(r => r[0]),
      ])

      const alistUp = await alistUpInfo.json()

      if (!alistUp) return
      if (alistUp.is_done === false) return
      const lastUpdate = (alistUpTime?.config as { lastUpdate?: number } | undefined)?.lastUpdate
      if ((lastUpdate || 0) === alistUp.last_done_time)
        return console.log(
          'alistUp.last_done_time',
          alistUp.last_done_time,
          'alistUpTime.config.lastUpdate',
          lastUpdate,
        )

      const openlistdatas = await fetch(
        `${process.env.OPENLIST_HOST}/api/fs/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: process.env.OPENLIST_API_KEY,
          },
          body: JSON.stringify({
            parent: '/',
            keywords: '[vndb-',
            scope: 1,
            page: 1,
            per_page: 1000000,
          }),
        },
      )

      const data = await openlistdatas.json()
      const processedData = processData(data.data.content)

      await db.transaction(async (trx) => {
        // 使用 UPSERT 替代全量删除，避免数据丢失
        for (const result of processedData) {
          await trx
            .insert(alistb)
            .values({
              id: result.id,
              vid: result.vid,
              other: result.other != null ? Number(result.other) : null,
              path: result.path,
            })
            .onConflictDoUpdate({
              target: alistb.id,
              set: {
                vid: result.vid,
                other: result.other != null ? Number(result.other) : null,
                path: result.path,
              },
            })
        }

        // 删除不再存在的记录
        const currentIds = processedData.map((r) => r.vid)
        if (currentIds.length > 0) {
          await trx
            .delete(alistb)
            .where(notInArray(alistb.vid, currentIds))
        }

        await trx
          .insert(siteConfig)
          .values({
            key: 'alistUpTime',
            config: JSON.stringify({
              lastUpdate: alistUp.last_done_time,
            }),
          })
          .onConflictDoUpdate({
            target: siteConfig.key,
            set: {
              config: JSON.stringify({
                lastUpdate: alistUp.last_done_time,
              }),
            },
          })
      })
      console.log('alistSyncScript 运行成功喵')
      void VndbSync.syncDelta()
      await releaseLockKv(lockKey, lockValue)
    } catch (e) {
      console.error('alistSyncScript 运行失败喵', e)
    } finally {
      await releaseLockKv(lockKey, lockValue)
    }
  },

  // 提取数据处理逻辑为独立方法，便于优化和测试
  processAlistData(alistData: Array<{ name: string }>) {
    const results: { vid?: string; other?: string; id: string }[] = []
    const idPattern = /\[(vndb-(v\d+)|other-(\w+))\]/g

    for (const item of alistData) {
      const matches = Array.from(item.name.matchAll(idPattern))
      const record: { vid?: string; other?: string } = {}

      for (const match of matches) {
        if (match[2]) record.vid = match[2] // vndb-vxxx
        if (match[3]) record.other = match[3] // other-xxx
      }

      // 只收集至少有一个字段的项
      if (Object.keys(record).length > 0) {
        let id = ''
        if (record.vid && record.other) {
          id = `${record.vid}-${record.other}`
        } else if (record.vid) {
          id = record.vid
        } else if (record.other) {
          id = record.other
        }
        results.push({ ...record, id })
      }
    }

    return results
  },

  deduplicateResults(
    results: Array<{ vid?: string; other?: string; id: string }>,
  ) {
    const dedupedMap = new Map<
      string,
      { vid?: string; other?: string; id: string }
    >()

    for (const item of results) {
      const key = item.vid || crypto.randomUUID()
      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, item)
      }
    }

    return Array.from(dedupedMap.values())
  },

  async meiliSearchAddIndex() {
    try {
      const index = await MeiliClient.index(process.env.MEILISEARCH_INDEXNAME!)

      // 先清空索引，然后并行处理分页数据
      await index.deleteAllDocuments()

      const { totalPages } = await this.getMeiliSearchDataInfo()
      const pageSize = 500

      // 并行处理所有分页，但限制并发数量避免过载
      const concurrencyLimit = 3 // 降低并发数以减少负载
      for (let i = 0; i < totalPages; i += concurrencyLimit) {
        const batch = []
        for (let j = 0; j < concurrencyLimit && i + j < totalPages; j++) {
          batch.push(this.indexPageWithRetry(index, pageSize, i + j))
        }
        await Promise.all(batch)
      }
      await index.updateFilterableAttributes(['released_first'])
      return { code: 200 }
    } catch (e) {
      console.error('meiliSearchAddIndex 运行失败喵', e)
      throw status(500, `meiliSearchAddIndex 运行失败喵 ${e}`)
    }
  },

  async indexPageWithRetry(
    index: any,
    pageSize: number,
    pageIndex: number,
    retries = 3,
  ) {
    for (let i = 0; i < retries; i++) {
      try {
        const { items } = await MeiliSearchData(pageSize, pageIndex)
        if (items.length > 0) {
          await index.addDocuments(items)
        }
        return
      } catch (e) {
        console.error(
          `索引分页 ${pageIndex} 失败 (尝试 ${i + 1}/${retries})`,
          e,
        )
        if (i === retries - 1) throw e
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  },

  async meiliSearchAddTag() {
    try {
      const index = await MeiliClient.index(
        process.env.MEILISEARCH_TAG_INDEXNAME!,
      )
      await index.deleteAllDocuments()

      const { totalPages } = await this.getTagDataInfo()
      const pageSize = 500

      // 并行处理所有分页，限制并发数量
      const concurrencyLimit = 3
      for (let i = 0; i < totalPages; i += concurrencyLimit) {
        const batch = []
        for (let j = 0; j < concurrencyLimit && i + j < totalPages; j++) {
          batch.push(this.indexTagPageWithRetry(index, pageSize, i + j))
        }
        await Promise.all(batch)
      }
      return { code: 200 }
    } catch (e) {
      console.error('meiliSearchAddTag 运行失败喵', e)
      throw status(500, `meiliSearchAddTag 运行失败喵 ${e}`)
    }
  },

  async indexTagPageWithRetry(
    index: any,
    pageSize: number,
    pageIndex: number,
    retries = 3,
  ) {
    for (let i = 0; i < retries; i++) {
      try {
        const { items } = await tagAllGet(pageSize, pageIndex)
        if (items.length > 0) {
          await index.addDocuments(items)
        }
        return
      } catch (e) {
        console.error(
          `标签索引分页 ${pageIndex} 失败 (尝试 ${i + 1}/${retries})`,
          e,
        )
        if (i === retries - 1) throw e
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  },

  // 辅助方法：获取总页数信息
  async getMeiliSearchDataInfo() {
    const totalCountResult = await db
      .select({ count: count() })
      .from(alistb)
      .limit(1)
      .then(r => r[0])

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / 500)

    return { totalCount, totalPages }
  },

  async getTagDataInfo() {
    const totalCountResult = await db
      .select({ count: count() })
      .from(tags)
      .innerJoin(zhtags, eq(tags.id, zhtags.id))
      .where(eq(zhtags.exhibition, true))
      .limit(1)
      .then(r => r[0])

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / 500)

    return { totalCount, totalPages }
  },
}

const MeiliSearchData = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await (db
    .select({
      released_first: sql`(SELECT ${releases.released} FROM ${releasesVn} INNER JOIN ${releases} ON ${releases.id} = ${releasesVn.id} WHERE ${releasesVn.vid} = ${alistb.vid} AND ${releases.released} IS NOT NULL ORDER BY ${releases.released} ASC LIMIT 1)`,
      titles: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT title, latin, lang FROM ${vnTitles} t WHERE t.id = ${vn.id}) t), '[]'::json)`,
      images: sql`(SELECT row_to_json(i.*) FROM (SELECT id, height, width, c_sexual_avg FROM ${images} i WHERE i.id = ${vn.cImage}) i)`,
      vn_releases: sql`COALESCE((SELECT json_agg(row_to_json(rel.*)) FROM (SELECT COALESCE((SELECT json_agg(row_to_json(rt.*)) FROM ${releasesTitles} rt WHERE rt.id = r.id), '[]'::json) AS titles FROM ${releasesVn} rv INNER JOIN ${releases} r ON r.id = rv.id WHERE rv.vid = ${vn.id}) rel), '[]'::json)`,
      other: alistb.other,
      other_datas: sql`(SELECT row_to_json(other_sub.*) FROM (SELECT o.id, ${alistb.other} AS other, o.title, o.alias, COALESCE((SELECT json_agg(row_to_json(om_sub.*)) FROM (SELECT om.*, (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media FROM ${otherMedia} om WHERE om.other_id = o.id) om_sub), '[]'::json) AS other_media FROM ${others} o WHERE o.id = ${alistb.other}) other_sub)`,
      tags: sql`COALESCE((SELECT json_agg(row_to_json(tag.*)) FROM (SELECT DISTINCT z.alias, z.name, z.id FROM ${tagsVn} tv INNER JOIN ${zhtags} z ON tv.tag = z.id WHERE tv.vid = ${vn.id} AND z.exhibition = TRUE) tag), '[]'::json)`,
      alias: vn.alias,
      id: vn.id,
      olang: vn.olang,
    })
    .from(alistb)
    .innerJoin(vn, eq(alistb.vid, vn.id)) as any)
    .orderBy(desc(vn.id))
    .orderBy(desc(alistb.other))
    .limit(pageSize)
    .offset(offset)

  return { items }
}

const tagAllGet = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await db
    .select({
      id: tags.id,
      name: tags.name,
      zh_name: zhtags.name,
      alias: zhtags.alias,
    })
    .from(tags)
    .innerJoin(zhtags, eq(tags.id, zhtags.id))
    .where(eq(zhtags.exhibition, true))
    .limit(pageSize)
    .offset(offset)

  return { items }
}
