import {
  buildCoverUrl,
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
    const { page = 1, limit = 20, type, includePreview = 0 } = params
    const offset = (page - 1) * limit
    const conditions = []
    if (params.status) conditions.push(eq(collections.status, params.status))
    if (type) conditions.push(eq(collections.type, type))

    const [items, total] = await Promise.all([
      db
        .select({
          id: collections.id,
          title: collections.title,
          description: collections.description,
          type: collections.type,
          producerIds: collections.producerIds,
          status: collections.status,
          sortOrder: collections.sortOrder,
          createdAt: collections.createdAt,
          updatedAt: collections.updatedAt,
        })
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
      const allEntries = await db
        .select({
          collectionId: collectionEntries.collectionId,
          vid: collectionEntries.vid,
          sortOrder: collectionEntries.sortOrder,
        })
        .from(collectionEntries)
        .where(inArray(collectionEntries.collectionId, manualIds))
        .orderBy(asc(collectionEntries.sortOrder))

      // Compute counts per collection from entries (avoids second query)
      const perCollection = new Map<number, number>()
      for (const entry of allEntries) {
        perCollection.set(
          entry.collectionId,
          (perCollection.get(entry.collectionId) ?? 0) + 1,
        )
        const list = entriesMap.get(entry.collectionId) ?? []
        list.push({ vid: entry.vid, sortOrder: entry.sortOrder })
        entriesMap.set(entry.collectionId, list)
      }
      for (const [id, count] of perCollection) {
        countMap.set(id, count)
      }
    }

    // Count distinct VNs for producer collections
    const producerItems = items.filter((i) => i.type === 'producer')
    if (producerItems.length > 0) {
      // Collect all unique pIds across all producer collections
      const allPIds = [
        ...new Set(
          producerItems.flatMap(
            (item) => (item.producerIds as string[] | null) ?? [],
          ),
        ),
      ]
      if (allPIds.length > 0) {
        const rows = await db
          .select({
            pid: releasesProducers.pid,
            count: countDistinct(vn.id),
          })
          .from(releasesProducers)
          .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
          .innerJoin(vn, eq(vn.id, releasesVn.vid))
          .where(inArray(releasesProducers.pid, allPIds))
          .groupBy(releasesProducers.pid)
        // Build pid→count map so each collection can sum its pIds
        const pidCountMap = new Map(rows.map((r) => [r.pid, Number(r.count)]))
        for (const item of producerItems) {
          const pIds = (item.producerIds as string[] | null) ?? []
          const total = pIds.reduce(
            (sum, pid) => sum + (pidCountMap.get(pid) ?? 0),
            0,
          )
          countMap.set(item.id, total)
        }
      }
    }

    const itemsWithCount = items.map((item) => ({
      ...item,
      entryCount: countMap.get(item.id) ?? 0,
      entries: entriesMap.get(item.id) ?? [],
    }))

    // Batch-embed VN previews when requested — avoids N+1 /preview calls
    const previewMap = new Map<
      number,
      Array<{
        id: string
        alias: string | null
        title: string
        imageId: string | null
        imageWidth: number | null
        imageHeight: number | null
        cSexualAvg: number | null
      }>
    >()
    if (includePreview > 0) {
      const vidSet = new Set<string>()
      const perCollection: Map<number, string[]> = new Map()

      // Manual collections: use entriesMap (already populated above)
      for (const item of itemsWithCount) {
        if (item.type === 'manual') {
          const vids = (entriesMap.get(item.id) ?? [])
            .slice(0, includePreview)
            .map((e) => e.vid)
          if (vids.length > 0) {
            perCollection.set(item.id, vids)
            for (const v of vids) vidSet.add(v)
          }
        }
      }

      // Producer collections: batch-query VN ids from releasesProducers
      const pItems = itemsWithCount.filter((i) => i.type === 'producer')
      if (pItems.length > 0) {
        const allPIds = [
          ...new Set(
            pItems.flatMap(
              (item) => (item.producerIds as string[] | null) ?? [],
            ),
          ),
        ]
        if (allPIds.length > 0) {
          const pvRows = await db
            .select({
              pid: releasesProducers.pid,
              vid: releasesVn.vid,
            })
            .from(releasesProducers)
            .innerJoin(releasesVn, eq(releasesVn.id, releasesProducers.id))
            .where(inArray(releasesProducers.pid, allPIds))
          // Group VN ids by pid
          const pidVids = new Map<string, string[]>()
          for (const r of pvRows) {
            if (!r.pid || !r.vid) continue
            const list = pidVids.get(r.pid) ?? []
            list.push(r.vid)
            pidVids.set(r.pid, list)
          }
          // Assign to each producer collection
          for (const item of pItems) {
            const pIds = (item.producerIds as string[] | null) ?? []
            const vids = pIds
              .flatMap((pid) => pidVids.get(pid) ?? [])
              .slice(0, includePreview)
            if (vids.length > 0) {
              perCollection.set(item.id, vids)
              for (const v of vids) vidSet.add(v)
            }
          }
        }
      }

      const allVids = [...vidSet]

      if (allVids.length > 0) {
        // Single batch: VN + image data
        const vnRows = await db
          .select({
            id: vn.id,
            alias: vn.alias,
            olang: vn.olang,
            imageId: images.id,
            imageWidth: images.width,
            imageHeight: images.height,
            cSexualAvg: images.cSexualAvg,
          })
          .from(vn)
          .leftJoin(images, eq(images.id, vn.cImage))
          .where(inArray(vn.id, allVids))

        // Single batch: titles
        const titleRows = await db
          .select({
            id: vn.id,
            titles: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT lang, title FROM ${vnTitles} t WHERE t.id = ${sql.identifier('vn')}.${sql.identifier('id')}) t), '[]'::json)`,
          })
          .from(vn)
          .where(inArray(vn.id, allVids))

        const vnMap = new Map(vnRows.map((r) => [r.id, r]))
        const titleMap = new Map<string, string>()
        for (const r of titleRows) {
          const titles =
            (r.titles as Array<{ lang: string; title: string }>) ?? []
          const best =
            titles.find((t) => t.lang === 'zh-Hans') ??
            titles.find((t) => t.lang === 'zh') ??
            titles.find((t) => t.lang === (vnMap.get(r.id)?.olang ?? null))
          if (best) titleMap.set(r.id, best.title)
        }

        // Assemble previews per collection
        for (const [colId, vids] of perCollection) {
          previewMap.set(
            colId,
            vids.map((vid) => {
              const v = vnMap.get(vid)
              return {
                id: vid,
                alias: v?.alias ?? null,
                title: titleMap.get(vid) ?? v?.alias ?? vid,
                imageId: v?.imageId ?? null,
                imageWidth: v?.imageWidth ?? null,
                imageHeight: v?.imageHeight ?? null,
                imageUrl: v?.imageId
                  ? buildCoverUrl(
                      v.imageId,
                      v?.imageWidth ?? null,
                      v?.imageHeight ?? null,
                    )
                  : null,
                cSexualAvg: v?.cSexualAvg ?? null,
              }
            }),
          )
        }
      }
    }

    const resultItems =
      includePreview > 0
        ? itemsWithCount.map((item) => ({
            ...item,
            previews: previewMap.get(item.id) ?? [],
          }))
        : itemsWithCount

    return { items: resultItems, total: total[0].count, page, limit }
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
      imageUrl: e.imageId
        ? buildCoverUrl(e.imageId, e.imageWidth, e.imageHeight)
        : null,
      cSexualAvg: e.cSexualAvg,
    }))
  },
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
    await db.transaction(async (trx) => {
      await trx
        .delete(collectionEntries)
        .where(eq(collectionEntries.collectionId, id))
      if (entries.length > 0) {
        await trx.insert(collectionEntries).values(
          entries.map((e) => ({
            collectionId: id,
            vid: e.vid,
            sortOrder: e.sortOrder,
          })),
        )
      }
    })
  },
}
