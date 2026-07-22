import {
  alistb,
  db,
  images,
  producers,
  releases,
  releasesProducers,
  releasesTitles,
  releasesVn,
  siteConfig,
  tags,
  tagsVn,
  vn,
  vnTitles,
  zhtags,
} from '@api/libs'
import { acquireLockKv, delKvPattern, releaseLockKv } from '@api/libs/redis'
import { idOrFilter, VndbClient } from '@api/libs/vndb-api'
import type {
  ProducerResult,
  ReleaseResult,
  TagResult,
  VnResult,
} from '@api/libs/vndb-api/types'
import { eq, isNotNull } from 'drizzle-orm'

const BATCH_SIZE = 100

interface SyncProgress {
  status: 'idle' | 'running' | 'completed' | 'failed'
  type: 'full' | 'delta' | 'producers' | null
  startedAt: string | null
  completedAt: string | null
  stage: 'vn' | 'tags' | 'releases' | 'producers' | 'cache' | null
  totalItems: number
  processedItems: number
  totalBatches: number
  processedBatches: number
  stageTotal: number
  stageProcessed: number
  errors: number
  logs: Array<{
    time: string
    level: 'info' | 'error' | 'success'
    message: string
  }>
  lastUpdated: string
}

export const VndbSync = {
  async syncFull() {
    const lockKey = 'vndb-sync-full'
    const lockVal = crypto.randomUUID()
    if (!(await acquireLockKv(lockKey, lockVal, 3600_000))) return
    try {
      await this.runFullSync()
    } finally {
      await releaseLockKv(lockKey, lockVal)
    }
  },

  async runFullSync() {
    const vids = await this.getAlistbVids()
    if (vids.length === 0) return

    console.log(`🔄 VNDB 全量同步开始: ${vids.length} 个 VN`)

    await this.updateProgress({
      status: 'running',
      type: 'full',
      startedAt: new Date().toISOString(),
      completedAt: null,
      stage: 'vn',
      totalItems: vids.length,
      processedItems: 0,
      totalBatches: Math.ceil(vids.length / BATCH_SIZE),
      processedBatches: 0,
      errors: 0,
      logs: [
        {
          time: new Date().toISOString(),
          level: 'info',
          message: `全量同步开始: ${vids.length} 个 VN`,
        },
      ],
    })

    // Step 1-2: Sync VNs and collect tag IDs
    const allTagIds = new Set<string>()
    for (let i = 0; i < vids.length; i += BATCH_SIZE) {
      const batch = vids.slice(i, i + BATCH_SIZE)
      try {
        const tagIds = await this.syncVnBatch(batch)
        for (const t of tagIds) allTagIds.add(t)
        console.log(
          `📦 VN batch ${i / BATCH_SIZE + 1}/${Math.ceil(vids.length / BATCH_SIZE)} done`,
        )
        await this.updateProgress({
          processedItems: Math.min(i + BATCH_SIZE, vids.length),
          processedBatches: Math.floor(i / BATCH_SIZE) + 1,
        })
        await this.addLog(
          'info',
          `VN batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vids.length / BATCH_SIZE)} done (${Math.min(i + BATCH_SIZE, vids.length)}/${vids.length})`,
        )
      } catch (err) {
        console.error(`❌ VN batch ${i / BATCH_SIZE + 1} failed:`, err)
        await this.updateProgress({
          errors: (await this.getProgress()).errors + 1,
        })
        await this.addLog(
          'error',
          `VN batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${String(err)}`,
        )
      }
    }

    // Step 3: Sync Tags
    try {
      await this.updateProgress({
        stage: 'tags',
        stageTotal: allTagIds.size,
        stageProcessed: 0,
      })
      await this.addLog('info', `Starting tags sync: ${allTagIds.size} tag IDs`)
      await this.syncTagsByIds([...allTagIds], (processed, total) => {
        void this.updateProgress({
          stageProcessed: processed,
          stageTotal: total,
        })
      })
      console.log(`✅ Tags synced: ${allTagIds.size} tags`)
      await this.updateProgress({
        stage: 'releases',
        stageTotal: 0,
        stageProcessed: 0,
      })
      await this.addLog('success', `Tags synced: ${allTagIds.size} tags`)
    } catch (err) {
      console.error('❌ Tag sync failed:', err)
      await this.addLog('error', `Tag sync failed: ${String(err)}`)
    }

    // Step 4: Sync Releases and collect producer IDs (smaller batch for API compatibility)
    const RELEASE_BATCH = 10
    const releaseBatchCount = Math.ceil(vids.length / RELEASE_BATCH)
    const allProducerIds = new Set<string>()
    await this.updateProgress({
      stage: 'releases',
      stageTotal: releaseBatchCount,
      stageProcessed: 0,
    })
    await this.addLog(
      'info',
      `Starting releases sync: ${releaseBatchCount} batches`,
    )
    for (let i = 0; i < vids.length; i += RELEASE_BATCH) {
      const batch = vids.slice(i, i + RELEASE_BATCH)
      try {
        const pids = await this.syncReleaseBatch(batch)
        for (const p of pids) allProducerIds.add(p)
        console.log(
          `📦 Release batch ${Math.floor(i / RELEASE_BATCH) + 1}/${releaseBatchCount} done`,
        )
        await this.updateProgress({
          stageProcessed: Math.floor(i / RELEASE_BATCH) + 1,
        })
        await this.addLog(
          'info',
          `Release batch ${Math.floor(i / RELEASE_BATCH) + 1}/${releaseBatchCount} done`,
        )
      } catch (err) {
        console.error(
          `❌ Release batch ${Math.floor(i / RELEASE_BATCH) + 1} failed:`,
          err,
        )
        await this.updateProgress({
          errors: (await this.getProgress()).errors + 1,
        })
        await this.addLog(
          'error',
          `Release batch ${Math.floor(i / RELEASE_BATCH) + 1} failed: ${String(err)}`,
        )
      }
    }

    // Step 5: Sync Producers
    try {
      await this.updateProgress({
        stage: 'producers',
        stageTotal: allProducerIds.size,
        stageProcessed: 0,
      })
      await this.addLog(
        'info',
        `Starting producers sync: ${allProducerIds.size} producer IDs`,
      )
      await this.syncProducersByIds([...allProducerIds], (processed, total) => {
        void this.updateProgress({
          stageProcessed: processed,
          stageTotal: total,
        })
      })
      console.log(`✅ Producers synced: ${allProducerIds.size} producers`)
      await this.updateProgress({
        stage: 'cache',
        stageTotal: 0,
        stageProcessed: 0,
      })
      await this.addLog(
        'success',
        `Producers synced: ${allProducerIds.size} producers`,
      )
    } catch (err) {
      console.error('❌ Producer sync failed:', err)
      await this.addLog('error', `Producer sync failed: ${String(err)}`)
    }

    await this.invalidateCache()
    await this.updateProgress({
      status: 'completed',
      completedAt: new Date().toISOString(),
      stage: null,
    })
    await this.addLog('success', 'VNDB 全量同步完成')
    console.log('✅ VNDB 全量同步完成')
  },

  async syncProducersFromDb() {
    console.log('🔄 开发者同步开始 (从现有 releases 数据)')
    await this.updateProgress({
      status: 'running',
      type: 'producers',
      startedAt: new Date().toISOString(),
      completedAt: null,
      stage: 'producers',
      totalItems: 0,
      processedItems: 0,
      totalBatches: 0,
      processedBatches: 0,
      errors: 0,
      logs: [
        {
          time: new Date().toISOString(),
          level: 'info',
          message: '开发者同步开始',
        },
      ],
    })
    const rows = await db
      .selectDistinct({ pid: releasesProducers.pid })
      .from(releasesProducers)
    const pids = rows.map((r) => r.pid).filter((p): p is string => p !== null)
    console.log(`📦 从 releases_producers 找到 ${pids.length} 个开发者 ID`)
    await this.updateProgress({
      totalItems: pids.length,
      stageTotal: pids.length,
      stageProcessed: 0,
    })
    await this.syncProducersByIds(pids, (processed, total) => {
      void this.updateProgress({ stageProcessed: processed, stageTotal: total })
    })
    await this.invalidateCache()
    await this.updateProgress({
      status: 'completed',
      completedAt: new Date().toISOString(),
      stage: null,
    })
    await this.addLog('success', `开发者同步完成: ${pids.length} 个开发者`)
    console.log('✅ 开发者同步完成')
  },

  async syncDelta() {
    const lockKey = 'vndb-sync-delta'
    const lockVal = crypto.randomUUID()
    if (!(await acquireLockKv(lockKey, lockVal, 600_000))) return
    try {
      const existingIds = new Set(
        (await db.select({ id: vn.id }).from(vn)).map((r) => r.id),
      )
      const newVids = (await this.getAlistbVids()).filter(
        (v) => !existingIds.has(v),
      )
      if (newVids.length === 0) {
        console.log('🔄 VNDB 增量同步: 无新 VN')
        return
      }

      console.log(`🔄 VNDB 增量同步: ${newVids.length} 个新 VN`)

      await this.updateProgress({
        status: 'running',
        type: 'delta',
        startedAt: new Date().toISOString(),
        completedAt: null,
        stage: 'vn',
        totalItems: newVids.length,
        processedItems: 0,
        totalBatches: Math.ceil(newVids.length / BATCH_SIZE),
        processedBatches: 0,
        errors: 0,
        logs: [
          {
            time: new Date().toISOString(),
            level: 'info',
            message: `增量同步开始: ${newVids.length} 个新 VN`,
          },
        ],
      })

      const allTagIds = new Set<string>()
      const allProducerIds = new Set<string>()

      for (let i = 0; i < newVids.length; i += BATCH_SIZE) {
        const batch = newVids.slice(i, i + BATCH_SIZE)
        try {
          const tagIds = await this.syncVnBatch(batch)
          for (const t of tagIds) allTagIds.add(t)
          await this.updateProgress({
            processedItems: Math.min(i + BATCH_SIZE, newVids.length),
            processedBatches: Math.floor(i / BATCH_SIZE) + 1,
          })
          await this.addLog(
            'info',
            `VN batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newVids.length / BATCH_SIZE)} done (${Math.min(i + BATCH_SIZE, newVids.length)}/${newVids.length})`,
          )
        } catch (err) {
          console.error(
            `❌ VN batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
            err,
          )
          await this.updateProgress({
            errors: (await this.getProgress()).errors + 1,
          })
          await this.addLog(
            'error',
            `VN batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${String(err)}`,
          )
        }
      }

      try {
        await this.updateProgress({
          stage: 'tags',
          stageTotal: allTagIds.size,
          stageProcessed: 0,
        })
        await this.addLog(
          'info',
          `Starting tags sync: ${allTagIds.size} tag IDs`,
        )
        await this.syncTagsByIds([...allTagIds], (processed, total) => {
          void this.updateProgress({
            stageProcessed: processed,
            stageTotal: total,
          })
        })
        await this.updateProgress({
          stage: 'releases',
          stageTotal: 0,
          stageProcessed: 0,
        })
        await this.addLog('success', `Tags synced: ${allTagIds.size} tags`)
      } catch (err) {
        console.error('❌ Tag sync failed:', err)
        await this.addLog('error', `Tag sync failed: ${String(err)}`)
      }

      const RELEASE_BATCH = 10
      const releaseBatchCount = Math.ceil(newVids.length / RELEASE_BATCH)
      await this.updateProgress({
        stage: 'releases',
        stageTotal: releaseBatchCount,
        stageProcessed: 0,
      })
      await this.addLog(
        'info',
        `Starting releases sync: ${releaseBatchCount} batches`,
      )
      for (let i = 0; i < newVids.length; i += RELEASE_BATCH) {
        const batch = newVids.slice(i, i + RELEASE_BATCH)
        try {
          const pids = await this.syncReleaseBatch(batch)
          for (const p of pids) allProducerIds.add(p)
          await this.updateProgress({
            stageProcessed: Math.floor(i / RELEASE_BATCH) + 1,
          })
          await this.addLog(
            'info',
            `Release batch ${Math.floor(i / RELEASE_BATCH) + 1}/${releaseBatchCount} done`,
          )
        } catch (err) {
          console.error(
            `❌ Release batch ${Math.floor(i / RELEASE_BATCH) + 1} failed:`,
            err,
          )
          await this.updateProgress({
            errors: (await this.getProgress()).errors + 1,
          })
          await this.addLog(
            'error',
            `Release batch ${Math.floor(i / RELEASE_BATCH) + 1} failed: ${String(err)}`,
          )
        }
      }

      try {
        await this.updateProgress({
          stage: 'producers',
          stageTotal: allProducerIds.size,
          stageProcessed: 0,
        })
        await this.addLog(
          'info',
          `Starting producers sync: ${allProducerIds.size} producer IDs`,
        )
        await this.syncProducersByIds(
          [...allProducerIds],
          (processed, total) => {
            void this.updateProgress({
              stageProcessed: processed,
              stageTotal: total,
            })
          },
        )
        await this.updateProgress({
          stage: 'cache',
          stageTotal: 0,
          stageProcessed: 0,
        })
        await this.addLog(
          'success',
          `Producers synced: ${allProducerIds.size} producers`,
        )
      } catch (err) {
        console.error('❌ Producer sync failed:', err)
        await this.addLog('error', `Producer sync failed: ${String(err)}`)
      }

      await this.invalidateCache()
      await this.updateProgress({
        status: 'completed',
        completedAt: new Date().toISOString(),
        stage: null,
      })
      await this.addLog('success', 'VNDB 增量同步完成')
      console.log('✅ VNDB 增量同步完成')
    } finally {
      await releaseLockKv(lockKey, lockVal)
    }
  },

  // ========== Progress Tracking ==========

  async updateProgress(partial: Partial<SyncProgress>) {
    const current = await this.getProgress()
    const updated: SyncProgress = {
      ...current,
      ...partial,
      lastUpdated: new Date().toISOString(),
    }
    await db
      .insert(siteConfig)
      .values({ key: 'vndbSyncProgress', config: updated as any })
      .onConflictDoUpdate({
        target: siteConfig.key,
        set: { config: updated as any },
      })
  },

  async getProgress(): Promise<SyncProgress> {
    const row = await db
      .select({ config: siteConfig.config })
      .from(siteConfig)
      .where(eq(siteConfig.key, 'vndbSyncProgress'))
      .limit(1)
    return (
      (row[0]?.config as SyncProgress) ?? {
        status: 'idle',
        type: null,
        startedAt: null,
        completedAt: null,
        stage: null,
        totalItems: 0,
        processedItems: 0,
        totalBatches: 0,
        processedBatches: 0,
        stageTotal: 0,
        stageProcessed: 0,
        errors: 0,
        logs: [],
        lastUpdated: new Date().toISOString(),
      }
    )
  },

  async addLog(level: SyncProgress['logs'][0]['level'], message: string) {
    const current = await this.getProgress()
    const logs = [
      ...current.logs,
      { time: new Date().toISOString(), level, message },
    ].slice(-100)
    await this.updateProgress({ logs })
  },

  // ========== Helpers ==========

  async getAlistbVids(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ vid: alistb.vid })
      .from(alistb)
      .where(isNotNull(alistb.vid))
    return rows.map((r) => r.vid!)
  },

  async invalidateCache() {
    await delKvPattern('gameList:*').catch(() => {})
    await delKvPattern('gameInfo:*').catch(() => {})
    await delKvPattern('gameTags:*').catch(() => {})
    await delKvPattern('tagGames:*').catch(() => {})
    await delKvPattern('Producer*').catch(() => {})
    await delKvPattern('gameCount').catch(() => {})
  },

  // ========== VN Sync ==========

  async syncVnBatch(vids: string[]): Promise<string[]> {
    console.log(`  → syncVnBatch: ${vids.length} vids`)
    const fields = [
      'id',
      'olang',
      'length',
      'devstatus',
      'description',
      'votecount',
      'rating',
      'average',
      'aliases',
      'titles{lang,title,latin,official,main}',
      'image{id,url,dims,sexual,violence,votecount}',
      'tags{id,rating,spoiler,lie}',
    ].join(',')

    const tagIds = new Set<string>()

    for await (const results of VndbClient.paginateAll<VnResult>(
      'vn',
      fields,
      idOrFilter(vids),
      BATCH_SIZE,
    )) {
      for (const vnData of results) {
        await db
          .insert(vn)
          .values({
            id: vnData.id,
            olang: vnData.olang as any,
            cVotecount: vnData.votecount,
            cRating: vnData.rating == null ? null : Math.round(vnData.rating),
            cAverage:
              vnData.average == null ? null : Math.round(vnData.average),
            length: vnData.length as any,
            devstatus: vnData.devstatus as any,
            alias: vnData.aliases?.[0] ?? null,
            description: vnData.description,
            cImage: vnData.image?.id ?? null,
            imageUrl: vnData.image?.url ?? null,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: vn.id,
            set: {
              olang: vnData.olang as any,
              cVotecount: vnData.votecount,
              cRating: vnData.rating == null ? null : Math.round(vnData.rating),
              cAverage:
                vnData.average == null ? null : Math.round(vnData.average),
              length: vnData.length as any,
              devstatus: vnData.devstatus as any,
              alias: vnData.aliases?.[0] ?? null,
              description: vnData.description,
              cImage: vnData.image?.id ?? null,
              imageUrl: vnData.image?.url ?? null,
              syncedAt: new Date(),
            },
          })

        if (vnData.titles?.length) {
          await db.delete(vnTitles).where(eq(vnTitles.id, vnData.id))
          await db.insert(vnTitles).values(
            vnData.titles.map((t) => ({
              id: vnData.id,
              lang: t.lang as any,
              official: t.official,
              title: t.title,
              latin: t.latin,
              main: t.main,
              syncedAt: new Date(),
            })),
          )
        }

        if (vnData.image?.id) {
          await db
            .insert(images)
            .values({
              id: vnData.image.id,
              url: vnData.image.url,
              width: vnData.image.dims[0],
              height: vnData.image.dims[1],
              cVotecount: vnData.image.votecount,
              cSexualAvg: vnData.image.sexual,
              cViolenceAvg: vnData.image.violence,
              cWeight: 0,
              cSexualStddev: 0,
              cViolenceStddev: 0,
              syncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: images.id,
              set: {
                url: vnData.image.url,
                width: vnData.image.dims[0],
                height: vnData.image.dims[1],
                cVotecount: vnData.image.votecount,
                cSexualAvg: vnData.image.sexual,
                cViolenceAvg: vnData.image.violence,
                syncedAt: new Date(),
              },
            })
        }

        if (vnData.tags?.length) {
          for (const tag of vnData.tags) tagIds.add(tag.id)
          await db.delete(tagsVn).where(eq(tagsVn.vid, vnData.id))
          await db.insert(tagsVn).values(
            vnData.tags.map((t) => ({
              tag: t.id,
              vid: vnData.id,
              vote: t.rating,
              spoiler: t.spoiler,
              lie: t.lie,
              ignore: false,
              syncedAt: new Date(),
            })),
          )
        }
      }
      console.log(`  → transaction done, sleeping 2s...`)
      await new Promise((r) => setTimeout(r, 2000))
    }
    console.log(`  ← syncVnBatch returning ${tagIds.size} tagIds`)
    return [...tagIds]
  },

  // ========== Tag Sync ==========

  async syncTagsByIds(
    tagIds: string[],
    onProgress?: (processed: number, total: number) => void,
  ) {
    if (tagIds.length === 0) return

    // Also include tags referenced by galrc_zhtag
    const zhTagRows = await db.select({ id: zhtags.id }).from(zhtags)
    const allIds = [...new Set([...tagIds, ...zhTagRows.map((z) => z.id)])]

    const fields =
      'id,name,aliases,description,category,searchable,applicable,vn_count'

    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE)
      for await (const results of VndbClient.paginateAll<TagResult>(
        'tag',
        fields,
        idOrFilter(batch),
        BATCH_SIZE,
      )) {
        for (const tag of results) {
          await db
            .insert(tags)
            .values({
              id: tag.id,
              cat: tag.category,
              name: tag.name,
              alias: tag.aliases?.join(',') ?? null,
              description: tag.description,
              searchable: tag.searchable,
              applicable: tag.applicable,
              syncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: tags.id,
              set: {
                cat: tag.category,
                name: tag.name,
                alias: tag.aliases?.join(',') ?? null,
                description: tag.description,
                searchable: tag.searchable,
                applicable: tag.applicable,
                syncedAt: new Date(),
              },
            })
        }
      }
      if (onProgress) {
        try {
          onProgress(Math.min(i + BATCH_SIZE, allIds.length), allIds.length)
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  },

  // ========== Release Sync ==========

  async syncReleaseBatch(vids: string[]): Promise<string[]> {
    console.log(`  → syncReleaseBatch: ${vids.length} vids`)
    const vnFilter =
      vids.length === 1
        ? ['id', '=', vids[0]]
        : ['or', ...vids.map((v) => ['id', '=', v] as [string, string, string])]

    const fields = [
      'id',
      'title',
      'released',
      'minage',
      'patch',
      'freeware',
      'uncensored',
      'official',
      'has_ero',
      'engine',
      'voiced',
      'gtin',
      'catalog',
      'notes',
      'languages{lang,title,latin,mtl,main}',
      'vns{id,rtype}',
      'producers{id,developer,publisher,name,original}',
    ].join(',')

    const producerIds = new Set<string>()

    for await (const results of VndbClient.paginateAll<ReleaseResult>(
      'release',
      fields,
      ['vn', '=', vnFilter],
      BATCH_SIZE,
    )) {
      console.log(`  → release page: ${results.length} results`)
      for (const rel of results) {
        await db
          .insert(releases)
          .values({
            id: rel.id,
            title: rel.title,
            released: rel.released,
            minage: rel.minage,
            patch: rel.patch,
            freeware: rel.freeware,
            uncensored: rel.uncensored,
            official: rel.official,
            hasEro: rel.has_ero,
            engine: rel.engine,
            voiced: rel.voiced,
            gtin: rel.gtin ? Number(rel.gtin) : null,
            catalog: rel.catalog,
            notes: rel.notes,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: releases.id,
            set: {
              title: rel.title,
              released: rel.released,
              minage: rel.minage,
              patch: rel.patch,
              freeware: rel.freeware,
              uncensored: rel.uncensored,
              official: rel.official,
              hasEro: rel.has_ero,
              engine: rel.engine,
              voiced: rel.voiced,
              gtin: rel.gtin ? Number(rel.gtin) : null,
              catalog: rel.catalog,
              notes: rel.notes,
              syncedAt: new Date(),
            },
          })

        if (rel.vns?.length) {
          await db.delete(releasesVn).where(eq(releasesVn.id, rel.id))
          await db.insert(releasesVn).values(
            rel.vns.map((v) => ({
              id: rel.id,
              vid: v.id,
              rtype: v.rtype,
              syncedAt: new Date(),
            })),
          )
        }

        if (rel.languages?.length) {
          await db.delete(releasesTitles).where(eq(releasesTitles.id, rel.id))
          await db.insert(releasesTitles).values(
            rel.languages.map((l) => ({
              id: rel.id,
              lang: l.lang as any,
              title: l.title,
              latin: l.latin,
              mtl: l.mtl,
              main: l.main,
            })),
          )
        }

        if (rel.producers?.length) {
          for (const p of rel.producers) producerIds.add(p.id)
          await db
            .delete(releasesProducers)
            .where(eq(releasesProducers.id, rel.id))
          await db.insert(releasesProducers).values(
            rel.producers.map((p) => ({
              id: rel.id,
              pid: p.id,
              developer: p.developer,
              publisher: p.publisher,
              syncedAt: new Date(),
            })),
          )
        }
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    console.log(
      `  ← syncReleaseBatch returning ${producerIds.size} producerIds`,
    )
    return [...producerIds]
  },

  // ========== Producer Sync ==========

  async syncProducersByIds(
    pids: string[],
    onProgress?: (processed: number, total: number) => void,
  ) {
    if (pids.length === 0) return

    const fields = 'id,name,original,aliases,lang,type,description'

    for (let i = 0; i < pids.length; i += BATCH_SIZE) {
      const batch = pids.slice(i, i + BATCH_SIZE)
      for await (const results of VndbClient.paginateAll<ProducerResult>(
        'producer',
        fields,
        idOrFilter(batch),
        BATCH_SIZE,
      )) {
        for (const prod of results) {
          await db
            .insert(producers)
            .values({
              id: prod.id,
              type: prod.type as any,
              lang: prod.lang as any,
              name: prod.name,
              original: prod.original,
              latin: prod.original,
              alias: prod.aliases?.join(',') ?? null,
              description: prod.description,
              syncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: producers.id,
              set: {
                type: prod.type as any,
                name: prod.name,
                original: prod.original,
                latin: prod.original,
                alias: prod.aliases?.join(',') ?? null,
                description: prod.description,
                syncedAt: new Date(),
              },
            })
        }
      }
      if (onProgress) {
        try {
          onProgress(Math.min(i + BATCH_SIZE, pids.length), pids.length)
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  },
}
