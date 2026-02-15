import { db, MeiliClient } from '@api/libs'
import { deacquireLocklKv, releaseLockKv } from '@api/libs/redis'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { all } from 'radash'
import { t } from 'try'

export const CronService = {
  async workerDataPull() {
    const lockKey = 'workerDataCorn'
    const lockValue = crypto.randomUUID()
    const lockTimeout = 120000

    const lock = await deacquireLocklKv(lockKey, lockValue, lockTimeout)
    if (!lock) {
      return
    }

    try {
      const data = await db.selectFrom('galrc_cloudflare').selectAll().execute()

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
                accountTag: item.account_id,
                datetimeStart: dateStr,
                datetimeEnd: dateStr,
                scriptName: item.woker_name,
              },
            })

            const commonHeaders = {
              'X-Auth-Email': item.a_email,
              'X-Auth-Key': item.a_key,
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
                `https://api.cloudflare.com/client/v4/accounts/${item.account_id}/workers/services/${item.woker_name}/environments/production?expand=routes`,
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
              .updateTable('galrc_cloudflare')
              .set({
                duration: result.duration ?? 0,
                errors: result.errors?.toString() ?? '0',
                requests: result.requests?.toString() ?? '0',
                responseBodySize: result.responseBodySize?.toString() ?? '0',
                subrequests: result.subrequests?.toString() ?? '0',
                url_endpoint: url,
                state: (result.requests ?? 0) < 100000,
                updateTime: new Date(),
              })
              .where('id', '=', item.id)
              .execute()
          } catch (err) {
            console.error(`请求失败: ${item.account_id}, ${err}`)
            // 如果请求出错，直接将 state 设置为 false
            await db
              .updateTable('galrc_cloudflare')
              .set({
                state: false,
                updateTime: new Date(),
              })
              .where('id', '=', item.id)
              .execute()
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
    const lockKey = 'runAlistData'
    const lockValue = crypto.randomUUID()
    const lockTimeout = 120000

    const lock = await deacquireLocklKv(lockKey, lockValue, lockTimeout)
    if (!lock) return null

    try {
      // 并行获取两个配置项
      const [, error, [alistUpInfo, alistUpTime]] = t(
        await Promise.all([
          db
            .selectFrom('galrc_setting_items')
            .selectAll()
            .where('key', '=', 'index_progress')
            .executeTakeFirst(),
          db
            .selectFrom('galrc_siteConfig')
            .selectAll()
            .where('key', '=', 'alistUpTime')
            .executeTakeFirst(),
        ]),
      )

      if (error) throw `Error:${JSON.stringify(error)}`

      const parsedValue = JSON.parse(alistUpInfo?.value as unknown as string)
      if (!alistUpInfo) return
      if (parsedValue.is_done === false) return
      if ((alistUpTime?.config.lastUpdate || 0) === parsedValue.last_done_time)
        return

      const [, alistDataError, alistData] = t(
        await db.selectFrom('galrc_search_nodes').select(['name']).execute(),
      )
      if (alistDataError) throw `Error:${JSON.stringify(alistDataError)}`

      // 优化正则处理，使用更高效的方式
      const results = this.processAlistData(alistData)
      const dedupedResults = this.deduplicateResults(results)

      const [, trxError] = t(
        await db.transaction().execute(async (trx) => {
          // 使用 UPSERT 替代全量删除，避免数据丢失
          for (const result of dedupedResults) {
            await trx
              .insertInto('galrc_alistb')
              .values(result)
              .onConflict((oc) =>
                oc.column('id').doUpdateSet({
                  vid: result.vid,
                  other: result.other,
                }),
              )
              .execute()
          }

          // 删除不再存在的记录
          const currentIds = dedupedResults.map((r) => r.id)
          if (currentIds.length > 0) {
            await trx
              .deleteFrom('galrc_alistb')
              .where('id', 'not in', currentIds)
              .execute()
          }

          await trx
            .insertInto('galrc_siteConfig')
            .values({
              key: 'alistUpTime',
              config: JSON.stringify({
                lastUpdate: parsedValue.last_done_time,
              }),
            })
            .onConflict((oc) =>
              oc.column('key').doUpdateSet({
                config: JSON.stringify({
                  lastUpdate: parsedValue.last_done_time,
                }),
              }),
            )
            .execute()
        }),
      )

      if (trxError) throw `Error:${JSON.stringify(trxError)}`
      await releaseLockKv(lockKey, lockValue)
    } catch (e) {
      console.error('alistSyncScript 运行失败喵', e)
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
    } catch (e) {
      console.error('meiliSearchAddIndex 运行失败喵', e)
      throw e
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
    } catch (e) {
      console.error('meiliSearchAddTag 运行失败喵', e)
      throw e
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
      .selectFrom('galrc_alistb')
      .select(({ fn }) => [fn.countAll().as('count')])
      .executeTakeFirst()

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / 500)

    return { totalCount, totalPages }
  },

  async getTagDataInfo() {
    const totalCountResult = await db
      .selectFrom('tags')
      .innerJoin('galrc_zhtag', 'tags.id', 'galrc_zhtag.id')
      .select(({ fn }) => [fn.countAll().as('count')])
      .where('galrc_zhtag.exhibition', '=', true)
      .executeTakeFirst()

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / 500)

    return { totalCount, totalPages }
  },
}

const MeiliSearchData = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await db
    .selectFrom('galrc_alistb')
    .innerJoin('vn', 'galrc_alistb.vid', 'vn.id')
    .select((vneb) => [
      jsonArrayFrom(
        vneb
          .selectFrom('vn_titles')
          .select(['vn_titles.title', 'vn_titles.latin', 'vn_titles.lang'])
          .whereRef('vn_titles.id', '=', 'vn.id'),
      ).as('titles'),
      jsonObjectFrom(
        vneb
          .selectFrom('images')
          .select(['height', 'id', 'width'])
          .whereRef('images.id', '=', 'vn.c_image'),
      ).as('images'),
      jsonArrayFrom(
        vneb
          .selectFrom('releases_vn')
          .innerJoin('releases', 'releases.id', 'releases_vn.id')
          .whereRef('releases_vn.vid', '=', 'vn.id')
          .select((releaseseVn) => [
            jsonArrayFrom(
              releaseseVn
                .selectFrom('releases_titles')
                .select(['releases_titles.id'])
                .select([
                  'releases_titles.title',
                  'releases_titles.latin',
                  'releases_titles.lang',
                ])
                .whereRef(
                  'releases_titles.id',
                  '=',
                  releaseseVn.ref('releases.id'),
                ),
            ).as('titles'),
          ]),
      ).as('vn_releases'),
    ])
    .select((other) => [
      'galrc_alistb.other',
      jsonObjectFrom(
        other
          .selectFrom('galrc_other')
          .whereRef('id', '=', 'galrc_alistb.other')
          .select((other) => [
            'galrc_other.id',
            'galrc_alistb.other',
            'galrc_other.title',
            'galrc_other.alias',
            jsonArrayFrom(
              other
                .selectFrom('galrc_other_media')
                .selectAll()
                .whereRef('galrc_other_media.other_id', '=', 'galrc_other.id')
                .select((om) => [
                  jsonObjectFrom(
                    om
                      .selectFrom('galrc_media')
                      .selectAll()
                      .whereRef(
                        'galrc_media.hash',
                        '=',
                        'galrc_other_media.media_hash',
                      ),
                  ).as('media'),
                ]),
            ).as('other_media'),
          ]),
      ).as('other_datas'),
    ])
    .select((vneb) => [
      jsonArrayFrom(
        vneb
          .selectFrom('tags_vn')
          .whereRef('tags_vn.vid', '=', 'vn.id')
          .innerJoin('galrc_zhtag', 'tags_vn.tag', 'galrc_zhtag.id')
          .where('galrc_zhtag.exhibition', '=', true)
          .distinct()
          .select(['galrc_zhtag.alias', 'galrc_zhtag.name', 'galrc_zhtag.id']),
      ).as('tags'),
    ])
    .select(['vn.alias', 'vn.id', 'vn.olang'])
    .orderBy('vn.id', 'desc')
    .orderBy('galrc_alistb.other', 'desc')
    .limit(pageSize)
    .offset(offset)
    .execute()

  return { items }
}

const tagAllGet = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await db
    .selectFrom('tags')
    .innerJoin('galrc_zhtag', 'tags.id', 'galrc_zhtag.id')
    .select([
      'tags.id',
      'tags.name',
      'galrc_zhtag.name as zh_name',
      'galrc_zhtag.alias',
    ])
    .where('galrc_zhtag.exhibition', '=', true)
    .limit(pageSize)
    .offset(offset)
    .execute()

  return { items }
}
