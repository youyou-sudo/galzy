import { db, MeiliClient } from '@api/libs'
import { deacquireLocklKv, releaseLockKv } from '@api/libs/redis'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { t } from 'try'

export const CronService = {
  async workerDataPull() {
    const lockKey = 'workerDataCorn'
    const lockValue = crypto.randomUUID()
    const lockTimeout = 10000

    const lock = await deacquireLocklKv(lockKey, lockValue, lockTimeout)
    if (!lock) {
      return
    }

    try {
      const data = await db.selectFrom('galrc_cloudflare').selectAll().execute()
      await Promise.allSettled(
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

            const res = await fetch(
              'https://api.cloudflare.com/client/v4/graphql',
              {
                method: 'POST',
                headers: {
                  'X-Auth-Email': item.a_email,
                  'X-Auth-Key': item.a_key,
                  'Content-Type': 'text/plain',
                  Accept: '*/*',
                  Host: 'api.cloudflare.com',
                },
                body: raw,
                redirect: 'follow',
              },
            )
            const res2 = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${item.account_id}/workers/services/${item.woker_name}/environments/production?expand=routes`,
              {
                method: 'GET',
                headers: {
                  'X-Auth-Email': item.a_email,
                  'X-Auth-Key': item.a_key,
                  Accept: '*/*',
                  Host: 'api.cloudflare.com',
                },
              },
            )
            const json = await res.json()
            const json2 = await res2.json()
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
                state: result.requests?.toString() < 100000,
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
    const lockTimeout = 10000

    const lock = await deacquireLocklKv(lockKey, lockValue, lockTimeout)
    if (lock) return null
    try {
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
      if (alistUpInfo.value.is_done === false) return
      if (alistUpTime?.config.lastUpdate || 0 === parsedValue.last_done_time)
        return

      const [, alistDataError, alistData] = t(
        await db.selectFrom('galrc_search_nodes').select(['name']).execute(),
      )
      if (alistDataError) throw `Error:${JSON.stringify(alistDataError)}`
      const results: { vid?: string; other?: string; id: string }[] = []

      // 正则表达式匹配 vndb、other 的 ID
      const idPattern = /\[(vndb-(v\d+)|other-(\w+))\]/g

      for (const item of alistData) {
        const matches = item.name.matchAll(idPattern)

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

      // 使用 Map 根据 vid 去重（优先保留第一个出现的）
      const dedupedMap = new Map<
        string,
        { vid?: string; other?: string; id: string }
      >()
      for (const item of results) {
        const key = item.vid || crypto.randomUUID() // 没有 vid 时使用 UUID 防止被覆盖
        if (!dedupedMap.has(key)) {
          dedupedMap.set(key, item)
        }
      }

      const dedupedResults = Array.from(dedupedMap.values())

      const [, trxError] = t(
        await db.transaction().execute(async (trx) => {
          await trx.deleteFrom('galrc_alistb').execute()
          await trx.insertInto('galrc_alistb').values(dedupedResults).execute()
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
      const shouldRelease = true
      if (shouldRelease) {
        await releaseLockKv(lockKey, lockValue)
      } else {
        await deacquireLocklKv(lockKey, lockValue, lockTimeout)
      }
    } catch (e) {
      console.error('alistSyncScript 运行失败喵', e)
      await releaseLockKv(lockKey, lockValue)
    }
  },
  async meiliSearchAddIndex() {
    try {
      const index = await MeiliClient.index(process.env.MEILISEARCH_INDEXNAME!)
      console.log('meiliSearchAddIndex', JSON.stringify(index))
      let pageIndex = 0
      const pageSize = 500 // 每批 500 条，根据数据量调
      let hasMore = true
      while (hasMore) {
        const { items, totalPages } = await MeiliSearchData(pageSize, pageIndex)
        // 格式化数据，MeiliSearch 必须有唯一 id

        if (items.length > 0) {
          await index.addDocuments(items)
        }

        pageIndex++
        hasMore = pageIndex < totalPages
      }
    }
    catch (e) {
      console.error('meiliSearchAddIndex 运行失败喵', e)
    }
  },
  async meiliSearchAddTag() {
    const index = await MeiliClient.index(
      process.env.MEILISEARCH_TAG_INDEXNAME!,
    )
    await index.deleteAllDocuments()

    let pageIndex = 0
    const pageSize = 500 // 每批 500 条，根据数据量调
    let hasMore = true

    while (hasMore) {
      const { items, totalPages } = await tagAllGet(pageSize, pageIndex)

      if (items.length > 0) {
        await index.addDocuments(items)
      }

      pageIndex++
      hasMore = pageIndex < totalPages
    }
  },
}

const MeiliSearchData = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize

  const items = await db
    .selectFrom('galrc_alistb')
    .innerJoin('vn', 'galrc_alistb.vid', 'vn.id')
    .select((vneb) => [
      'vn.id',
      jsonArrayFrom(
        vneb
          .selectFrom('vn_titles')
          .selectAll()
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
          .select([
            'releases.notes',
            'releases.engine',
            'releases.olang',
            'releases.id',
          ])
          .whereRef('releases_vn.vid', '=', 'vn.id')
          .select((releaseseVn) => [
            jsonArrayFrom(
              releaseseVn
                .selectFrom('releases_titles')
                .select(['releases_titles.id'])
                .selectAll()
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
          .selectAll()
          .whereRef('id', '=', 'galrc_alistb.other')
          .select((other) => [
            'galrc_alistb.other',
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
          .selectAll()
          .distinct(),
      ).as('tags'),
    ])
    .select(['vn.alias', 'vn.description', 'vn.id', 'vn.olang'])
    .orderBy('vn.id', 'desc')
    .orderBy('galrc_alistb.other', 'desc')
    .limit(pageSize)
    .offset(offset)
    .execute()

  const totalCountResult = await db
    .selectFrom('galrc_alistb')
    .select(({ fn }) => [fn.countAll().as('count')])
    .executeTakeFirst()

  const totalCount = Number(totalCountResult?.count || 0)
  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    items,
    currentPage: pageIndex,
    totalPages,
    totalCount,
  }
}

const tagAllGet = async (pageSize: number, pageIndex: number) => {
  const offset = pageIndex * pageSize;
  const items = await await db
    .selectFrom("tags")
    .innerJoin("galrc_zhtag", "tags.id", "galrc_zhtag.id")
    .select([
      "tags.id",
      "tags.name",
      "tags.description",
      "galrc_zhtag.name as zh_name",
      "galrc_zhtag.description as zh_description",
      "galrc_zhtag.alias",
    ])
    .where("galrc_zhtag.exhibition", "=", true)
    .limit(pageSize)
    .offset(offset)
    .execute();

  const totalCountResult = await db
    .selectFrom("tags")
    .innerJoin("galrc_zhtag", "tags.id", "galrc_zhtag.id")
    .select(({ fn }) => [fn.countAll().as("count")])
    .executeTakeFirst();

  const totalCount = Number(totalCountResult?.count || 0);
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    items,
    currentPage: pageIndex,
    totalPages,
    totalCount,
  };
};
