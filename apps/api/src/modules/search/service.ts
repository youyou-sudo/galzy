import { db, MeiliClient } from '@api/libs'
import { getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { t } from 'try'
import type { SearchModel } from './model'

export const Search = {
  async get({ q, limit, startDate, endDate }: SearchModel.search) {
    const safeQ = q?.replace(/[+\-*/=<>!&|%^$#@~?:;'",()[\]{}\\]/g, '').trim()
    const redisData = await getKv(
      `Search:${safeQ}-${limit}-${startDate}-${endDate}`,
    )

    if (redisData) {
      const parsed = JSON.parse(redisData)
      return parsed as SearchReturn
    }
    const filters: string[] = []

    if (startDate && endDate) {
      filters.push(
        `released_first >= ${startDate} AND released_first <= ${endDate}`,
      )
    }
    const [, error, [index, tagf]] = t(
      await Promise.all([
        MeiliClient.index(process.env.MEILISEARCH_INDEXNAME || '').search(
          safeQ,
          {
            limit: limit || 50,
            filter: filters.length ? filters.join(' AND ') : undefined,
          },
        ),
        MeiliClient.index(process.env.MEILISEARCH_TAG_INDEXNAME || '').search(
          safeQ,
          {
            limit: 1,
          },
        ),
      ]),
    )
    if (error) {
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)
    }
    const topTag = tagf.hits[0]
    const data = {
      hits: index.hits,
      topTag: topTag
        ? (topTag as SearchModel.tagAllReturn['items'][0])
        : undefined,
    }
    void setKv(`Search:${safeQ}-${limit}`, JSON.stringify(data), 60 * 60 * 1)
    type SearchReturn = typeof data
    return data
  },
  async meilisearchEmbeddersUpdate({
    url,
    embeddingApiKey,
    model,
    documentTemplateMaxBytes,
    documentTemplate,
  }: SearchModel.meilisearchEmbeddersUpdate) {
    const task = await MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME!,
    ).updateEmbedders({
      body: {
        source: 'rest',
        url: url,
        headers: { Authorization: embeddingApiKey },
        request: { model: model, input: ['{{text}}', '{{..}}'] },
        documentTemplateMaxBytes: documentTemplateMaxBytes,
        response: {
          data: [
            {
              embedding: '{{embedding}}',
            },
            '{{..}}',
          ],
        },

        documentTemplate: documentTemplate,
      },
    })
    // 保存任务信息到 galrc_siteConfig
    await db
      .insertInto('galrc_siteConfig')
      .values({
        key: `searchTask_${task.taskUid}`,
        config: JSON.stringify({
          taskUid: task.taskUid,
          type: 'embeddersUpdate',
          indexUid: task.indexUid,
          status: task.status,
          enqueuedAt: task.enqueuedAt,
        }),
      })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet({
          config: JSON.stringify({
            taskUid: task.taskUid,
            type: 'embeddersUpdate',
            indexUid: task.indexUid,
            status: task.status,
            enqueuedAt: task.enqueuedAt,
          }),
        }),
      )
      .execute()
    return task
  },
  async meilisearchEmbeddersGet() {
    const indexdata = await MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME!,
    ).getEmbedders()
    return indexdata
  },
  async meilisearchPropertylist() {
    const indexdata = await MeiliClient.index(
      process.env.MEILISEARCH_INDEXNAME!,
    ).getDocuments({ limit: 1 })
    if (indexdata.results && indexdata.results.length > 0) {
      return Object.keys(indexdata.results[0])
    }
    return []
  },
  async meilisearcSearchableAttributeshGet() {
    const index = MeiliClient.index(process.env.MEILISEARCH_INDEXNAME!)

    const searchable = await index.getSearchableAttributes()

    if (
      Array.isArray(searchable) &&
      searchable.length === 1 &&
      searchable[0] === '*'
    ) {
      return await Search.meilisearchPropertylist()
    }
    return searchable
  },
  async meilisearcSearchableAttributeshUpdate({
    fields,
  }: SearchModel.meilisearcSearchableAttributeshUpdate) {
    try {
      const index = MeiliClient.index(process.env.MEILISEARCH_INDEXNAME!)
      const task = await index.updateSearchableAttributes(fields)
      // 保存任务信息到 galrc_siteConfig
      await db
        .insertInto('galrc_siteConfig')
        .values({
          key: `searchTask_${task.taskUid}`,
          config: JSON.stringify({
            taskUid: task.taskUid,
            type: 'searchableAttributesUpdate',
            indexUid: task.indexUid,
            status: task.status,
            enqueuedAt: task.enqueuedAt,
          }),
        })
        .onConflict((oc) =>
          oc.column('key').doUpdateSet({
            config: JSON.stringify({
              taskUid: task.taskUid,
              type: 'searchableAttributesUpdate',
              indexUid: task.indexUid,
              status: task.status,
              enqueuedAt: task.enqueuedAt,
            }),
          }),
        )
        .execute()
      return { code: 200, taskUid: task.taskUid }
    } catch (error) {
      throw status(500, error)
    }
  },
  async getStats() {
    const indexdata = await MeiliClient.getStats()
    return indexdata
  },

  // 获取单个任务的实时进度（从 Meilisearch 拉取最新状态并更新 DB）
  async getTask(uid: number) {
    const task = await MeiliClient.tasks.getTask(uid)
    // 同步更新 galrc_siteConfig
    await db
      .insertInto('galrc_siteConfig')
      .values({
        key: `searchTask_${uid}`,
        config: JSON.stringify(task),
      })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet({
          config: JSON.stringify(task),
        }),
      )
      .execute()
    return task
  },

  // 列出所有 search 相关的任务记录
  async getTasks() {
    const rows = await db
      .selectFrom('galrc_siteConfig')
      .selectAll()
      .where('key', 'like', 'searchTask_%')
      .execute()
    return rows.map((r) => ({
      key: r.key,
      ...(typeof r.config === 'string' ? JSON.parse(r.config) : r.config),
    }))
  },
}
