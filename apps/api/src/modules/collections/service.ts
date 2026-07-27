import { collectionEntries, collections, db, images, releasesProducers, releasesVn, vn } from '@api/libs'
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

    // Compute entryCount per collection
    const countMap = new Map<number, number>()
    for (const item of items) {
      countMap.set(item.id, 0)
    }

    // Batch count for manual collections
    const manualIds = items
      .filter((i) => i.type === 'manual')
      .map((i) => i.id)
    if (manualIds.length > 0) {
      const manualCounts = await db
        .select({
          collectionId: collectionEntries.collectionId,
          count: count(),
        })
        .from(collectionEntries)
        .where(inArray(collectionEntries.collectionId, manualIds))
        .groupBy(collectionEntries.collectionId)
      for (const row of manualCounts) {
        countMap.set(row.collectionId, row.count)
      }
    }

    // Count distinct VNs for producer collections
    for (const item of items.filter((i) => i.type === 'producer')) {
      const pIds = item.producerIds as string[] | null
      if (pIds && pIds.length > 0) {
        const [result] = await db
          .select({ count: countDistinct(vn.id) })
          .from(releasesProducers)
          .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
          .innerJoin(vn, eq(vn.id, releasesVn.vid))
          .where(inArray(releasesProducers.pid, pIds))
        countMap.set(item.id, result.count)
      }
    }

    const itemsWithCount = items.map((item) => ({
      ...item,
      entryCount: countMap.get(item.id) ?? 0,
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

    if (collection.type === 'manual') {
      // 手动模式：查 collection_entries 关联的 vn
      const entries = await db
        .select({
          id: vn.id,
          alias: vn.alias,
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
      return entries
    }

    // producer 模式：查 producer 关联的游戏
    if (collection.producerIds && (collection.producerIds as string[]).length > 0) {
      const results = await db
        .selectDistinctOn([vn.id], {
          id: vn.id,
          alias: vn.alias,
          imageId: images.id,
          imageWidth: images.width,
          imageHeight: images.height,
          cSexualAvg: images.cSexualAvg,
        })
        .from(releasesProducers)
        .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
        .innerJoin(vn, eq(vn.id, releasesVn.vid))
        .leftJoin(images, eq(images.id, vn.cImage))
        .where(inArray(releasesProducers.pid, collection.producerIds as string[]))
        .limit(limit)
      return results
    }
    return []
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
