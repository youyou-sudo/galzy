import {
  collectionEntries,
  collections,
  db,
  images,
  releasesProducers,
  releasesVn,
  sql,
  vn,
  vnTitles,
} from '@api/libs'
import { and, asc, count, countDistinct, desc, eq, inArray } from 'drizzle-orm'
import { status } from 'elysia'
import type { CollectionModel } from './model'

export const CollectionService = {
  // 获取合集列表（传 status 则按状态过滤，不传则返回全部）
  async list(params: CollectionModel.list) {
    const { page = 1, limit = 20 } = params
    const offset = (page - 1) * limit
    const conditions = params.status
      ? [eq(collections.status, params.status)]
      : []

    const [items, total] = await Promise.all([
      db
        .select()
        .from(collections)
        .where(and(...conditions))
        .orderBy(asc(collections.sortOrder), desc(collections.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(collections)
        .where(and(...conditions)),
    ])

    // Compute entryCount per collection + fetch entries for manual type
    const countMap = new Map<number, number>()
    const entriesMap = new Map<
      number,
      Array<{ vid: string; sortOrder: number }>
    >()
    for (const item of items) {
      countMap.set(item.id, 0)
    }

    // Batch count for manual collections
    const manualIds = items.filter((i) => i.type === 'manual').map((i) => i.id)
    if (manualIds.length > 0) {
      const [manualCounts, allEntries] = await Promise.all([
        db
          .select({
            collectionId: collectionEntries.collectionId,
            count: count(),
          })
          .from(collectionEntries)
          .where(inArray(collectionEntries.collectionId, manualIds))
          .groupBy(collectionEntries.collectionId),
        db
          .select({
            collectionId: collectionEntries.collectionId,
            vid: collectionEntries.vid,
            sortOrder: collectionEntries.sortOrder,
          })
          .from(collectionEntries)
          .where(inArray(collectionEntries.collectionId, manualIds))
          .orderBy(asc(collectionEntries.sortOrder)),
      ])
      for (const row of manualCounts) {
        countMap.set(row.collectionId, row.count)
      }
      for (const entry of allEntries) {
        const list = entriesMap.get(entry.collectionId) ?? []
        list.push({ vid: entry.vid, sortOrder: entry.sortOrder })
        entriesMap.set(entry.collectionId, list)
      }
    }

    // Count distinct VNs for producer collections
    const producerItems = items.filter((i) => i.type === 'producer')
    if (producerItems.length > 0) {
      const producerCounts = await Promise.all(
        producerItems.map(async (item) => {
          const pIds = item.producerIds as string[] | null
          if (pIds && pIds.length > 0) {
            const [result] = await db
              .select({ count: countDistinct(vn.id) })
              .from(releasesProducers)
              .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
              .innerJoin(vn, eq(vn.id, releasesVn.vid))
              .where(inArray(releasesProducers.pid, pIds))
            return { id: item.id, count: result.count }
          }
          return { id: item.id, count: 0 }
        }),
      )
      for (const { id, count } of producerCounts) {
        countMap.set(id, count)
      }
    }

    const itemsWithCount = items.map((item) => ({
      ...item,
      entryCount: countMap.get(item.id) ?? 0,
      entries: entriesMap.get(item.id) ?? [],
    }))

    return { items: itemsWithCount, total: total[0].count, page, limit }
  },

  // 获取合集详情（含条目）
  async getById(id: number) {
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1)
    if (!collection) throw status(404, '合集不存在')

    if (collection.type === 'manual') {
      const entries = await db
        .select()
        .from(collectionEntries)
        .where(eq(collectionEntries.collectionId, id))
        .orderBy(asc(collectionEntries.sortOrder))
      return { ...collection, entries }
    }

    return collection
  },

  // 创建合集
  async create(data: CollectionModel.create) {
    const [result] = await db
      .insert(collections)
      .values({
        title: data.title,
        description: data.description ?? null,
        type: data.type ?? 'manual',
        producerIds: data.producerIds ?? null,
        status: data.status ?? 'published',
      })
      .returning()
    return result
  },

  // 更新合集
  async update(id: number, data: CollectionModel.update) {
    const [existing] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1)
    if (!existing) throw status(404, '合集不存在')

    const [updated] = await db
      .update(collections)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.producerIds !== undefined && {
          producerIds: data.producerIds,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        updatedAt: new Date(),
      })
      .where(eq(collections.id, id))
      .returning()
    return updated
  },

  async preview(id: number, limit: number = 6) {
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1)
    if (!collection) throw status(404, '合集不存在')

    let entries: Array<{
      id: string
      alias: string | null
      olang: string | null
      imageId: string | null
      imageWidth: number | null
      imageHeight: number | null
      cSexualAvg: number | null
    }>

    if (collection.type === 'manual') {
      entries = await db
        .select({
          id: vn.id,
          alias: vn.alias,
          olang: vn.olang,
          imageId: images.id,
          imageWidth: images.width,
          imageHeight: images.height,
          cSexualAvg: images.cSexualAvg,
        })
        .from(collectionEntries)
        .innerJoin(vn, eq(vn.id, collectionEntries.vid))
        .leftJoin(images, eq(images.id, vn.cImage))
        .where(eq(collectionEntries.collectionId, id))
        .orderBy(asc(collectionEntries.sortOrder))
        .limit(limit)
    } else if (
      collection.producerIds &&
      (collection.producerIds as string[]).length > 0
    ) {
      entries = (await db
        .selectDistinctOn([vn.id], {
          id: vn.id,
          alias: vn.alias,
          olang: vn.olang,
          imageId: images.id,
          imageWidth: images.width,
          imageHeight: images.height,
          cSexualAvg: images.cSexualAvg,
        })
        .from(releasesProducers)
        .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
        .innerJoin(vn, eq(vn.id, releasesVn.vid))
        .leftJoin(images, eq(images.id, vn.cImage))
        .where(
          inArray(releasesProducers.pid, collection.producerIds as string[]),
        )
        .limit(limit)) as typeof entries
    } else {
      return []
    }

    if (entries.length === 0) return []

    // Resolve Chinese-preferred titles
    const ids = entries.map((e) => e.id)
    const titleRows = await db
      .select({
        id: vn.id,
        titles: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT lang, title FROM ${vnTitles} t WHERE t.id = ${sql.identifier('vn')}.${sql.identifier('id')}) t), '[]'::json)`,
      })
      .from(vn)
      .where(inArray(vn.id, ids))

    const titleMap = new Map<string, string>()
    for (const r of titleRows) {
      const titles = (r.titles as Array<{ lang: string; title: string }>) ?? []
      const titleObj =
        titles.find((t) => t.lang === 'zh-Hans') ||
        titles.find((t) => t.lang === 'zh') ||
        titles.find(
          (t) => t.lang === (entries.find((e) => e.id === r.id)?.olang ?? null),
        )
      if (titleObj) titleMap.set(r.id, titleObj.title)
    }

    return entries.map((e) => ({
      id: e.id,
      alias: e.alias,
      title: titleMap.get(e.id) ?? e.alias ?? e.id,
      imageId: e.imageId,
      imageWidth: e.imageWidth,
      imageHeight: e.imageHeight,
      cSexualAvg: e.cSexualAvg,
    }))
  },

  // 删除合集
  async delete(id: number) {
    const [existing] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1)
    if (!existing) throw status(404, '合集不存在')

    await db
      .delete(collectionEntries)
      .where(eq(collectionEntries.collectionId, id))
    await db.delete(collections).where(eq(collections.id, id))
  },

  // 更新合集手动条目（批量替换）
  async updateEntries(
    id: number,
    entries: { vid: string; sortOrder: number }[],
  ) {
    const [existing] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1)
    if (!existing) throw status(404, '合集不存在')

    await db
      .delete(collectionEntries)
      .where(eq(collectionEntries.collectionId, id))
    if (entries.length > 0) {
      await db.insert(collectionEntries).values(
        entries.map((e) => ({
          collectionId: id,
          vid: e.vid,
          sortOrder: e.sortOrder,
        })),
      )
    }
  },
}
