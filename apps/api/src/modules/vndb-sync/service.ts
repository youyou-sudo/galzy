import { db } from '@api/libs'
import { acquireLockKv, delKvPattern, releaseLockKv } from '@api/libs/redis'
import { idOrFilter, VndbClient } from '@api/libs/vndb-api'
import type {
  ProducerResult,
  ReleaseResult,
  TagResult,
  VnResult,
} from '@api/libs/vndb-api/types'

const BATCH_SIZE = 100

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
      } catch (err) {
        console.error(`❌ VN batch ${i / BATCH_SIZE + 1} failed:`, err)
      }
    }

    // Step 3: Sync Tags
    try {
      await this.syncTagsByIds([...allTagIds])
      console.log(`✅ Tags synced: ${allTagIds.size} tags`)
    } catch (err) {
      console.error('❌ Tag sync failed:', err)
    }

    // Step 4: Sync Releases and collect producer IDs (smaller batch for API compatibility)
    const RELEASE_BATCH = 10
    const allProducerIds = new Set<string>()
    for (let i = 0; i < vids.length; i += RELEASE_BATCH) {
      const batch = vids.slice(i, i + RELEASE_BATCH)
      try {
        const pids = await this.syncReleaseBatch(batch)
        for (const p of pids) allProducerIds.add(p)
        console.log(
          `📦 Release batch ${Math.floor(i / RELEASE_BATCH) + 1}/${Math.ceil(vids.length / RELEASE_BATCH)} done`,
        )
      } catch (err) {
        console.error(
          `❌ Release batch ${Math.floor(i / RELEASE_BATCH) + 1} failed:`,
          err,
        )
      }
    }

    // Step 5: Sync Producers
    try {
      await this.syncProducersByIds([...allProducerIds])
      console.log(`✅ Producers synced: ${allProducerIds.size} producers`)
    } catch (err) {
      console.error('❌ Producer sync failed:', err)
    }

    await this.invalidateCache()
    console.log('✅ VNDB 全量同步完成')
  },

  async syncProducersFromDb() {
    console.log('🔄 开发者同步开始 (从现有 releases 数据)')
    const rows = await db
      .selectFrom('releases_producers')
      .select('pid')
      .distinct()
      .execute()
    const pids = rows.map((r) => r.pid)
    console.log(`📦 从 releases_producers 找到 ${pids.length} 个开发者 ID`)
    await this.syncProducersByIds(pids)
    await this.invalidateCache()
    console.log('✅ 开发者同步完成')
  },

  async syncDelta() {
    const lockKey = 'vndb-sync-delta'
    const lockVal = crypto.randomUUID()
    if (!(await acquireLockKv(lockKey, lockVal, 600_000))) return
    try {
      const existingIds = new Set(
        (await db.selectFrom('vn').select('id').execute()).map((r) => r.id),
      )
      const newVids = (await this.getAlistbVids()).filter(
        (v) => !existingIds.has(v),
      )
      if (newVids.length === 0) {
        console.log('🔄 VNDB 增量同步: 无新 VN')
        await releaseLockKv(lockKey, lockVal)
        return
      }

      console.log(`🔄 VNDB 增量同步: ${newVids.length} 个新 VN`)

      const allTagIds = new Set<string>()
      const allProducerIds = new Set<string>()

      for (let i = 0; i < newVids.length; i += BATCH_SIZE) {
        const batch = newVids.slice(i, i + BATCH_SIZE)
        const tagIds = await this.syncVnBatch(batch)
        for (const t of tagIds) allTagIds.add(t)
      }

      await this.syncTagsByIds([...allTagIds])

      const RELEASE_BATCH = 10
      for (let i = 0; i < newVids.length; i += RELEASE_BATCH) {
        const batch = newVids.slice(i, i + RELEASE_BATCH)
        const pids = await this.syncReleaseBatch(batch)
        for (const p of pids) allProducerIds.add(p)
      }

      await this.syncProducersByIds([...allProducerIds])
      await this.invalidateCache()
      console.log('✅ VNDB 增量同步完成')
    } finally {
      await releaseLockKv(lockKey, lockVal)
    }
  },

  // ========== Helpers ==========

  async getAlistbVids(): Promise<string[]> {
    const rows = await db
      .selectFrom('galrc_alistb')
      .select('vid')
      .where('vid', 'is not', null)
      .distinct()
      .execute()
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
      for (const vn of results) {
        await db
          .insertInto('vn')
          .values({
            id: vn.id,
            olang: vn.olang as any,
            c_votecount: vn.votecount,
            c_rating: vn.rating == null ? null : Math.round(vn.rating),
            c_average: vn.average == null ? null : Math.round(vn.average),
            length: vn.length as any,
            devstatus: vn.devstatus as any,
            alias: vn.aliases?.[0] ?? null,
            description: vn.description,
            c_image: vn.image?.id ?? null,
            image_url: vn.image?.url ?? null,
            synced_at: new Date(),
          })
          .onConflict((oc) =>
            oc.column('id').doUpdateSet({
              olang: (eb) => eb.ref('excluded.olang'),
              c_votecount: (eb) => eb.ref('excluded.c_votecount'),
              c_rating: (eb) => eb.ref('excluded.c_rating'),
              c_average: (eb) => eb.ref('excluded.c_average'),
              length: (eb) => eb.ref('excluded.length'),
              devstatus: (eb) => eb.ref('excluded.devstatus'),
              alias: (eb) => eb.ref('excluded.alias'),
              description: (eb) => eb.ref('excluded.description'),
              c_image: (eb) => eb.ref('excluded.c_image'),
              image_url: (eb) => eb.ref('excluded.image_url'),
              synced_at: (eb) => eb.ref('excluded.synced_at'),
            }),
          )
          .execute()

        if (vn.titles?.length) {
          await db.deleteFrom('vn_titles').where('id', '=', vn.id).execute()
          await db
            .insertInto('vn_titles')
            .values(
              vn.titles.map((t) => ({
                id: vn.id,
                lang: t.lang as any,
                official: t.official,
                title: t.title,
                latin: t.latin,
                main: t.main,
                synced_at: new Date(),
              })),
            )
            .execute()
        }

        if (vn.image?.id) {
          await db
            .insertInto('images')
            .values({
              id: vn.image.id,
              url: vn.image.url,
              width: vn.image.dims[0],
              height: vn.image.dims[1],
              c_votecount: vn.image.votecount,
              c_sexual_avg: vn.image.sexual,
              c_violence_avg: vn.image.violence,
              c_weight: 0,
              c_sexual_stddev: 0,
              c_violence_stddev: 0,
              synced_at: new Date(),
            })
            .onConflict((oc) =>
              oc.column('id').doUpdateSet({
                url: (eb) => eb.ref('excluded.url'),
                width: (eb) => eb.ref('excluded.width'),
                height: (eb) => eb.ref('excluded.height'),
                c_votecount: (eb) => eb.ref('excluded.c_votecount'),
                c_sexual_avg: (eb) => eb.ref('excluded.c_sexual_avg'),
                c_violence_avg: (eb) => eb.ref('excluded.c_violence_avg'),
                synced_at: (eb) => eb.ref('excluded.synced_at'),
              }),
            )
            .execute()
        }

        if (vn.tags?.length) {
          for (const tag of vn.tags) tagIds.add(tag.id)
          await db.deleteFrom('tags_vn').where('vid', '=', vn.id).execute()
          await db
            .insertInto('tags_vn')
            .values(
              vn.tags.map((t) => ({
                tag: t.id,
                vid: vn.id,
                vote: t.rating,
                spoiler: t.spoiler,
                lie: t.lie,
                ignore: false,
                synced_at: new Date(),
              })),
            )
            .execute()
        }
      }
      console.log(`  → transaction done, sleeping 2s...`)
      await new Promise((r) => setTimeout(r, 2000))
    }
    console.log(`  ← syncVnBatch returning ${tagIds.size} tagIds`)
    return [...tagIds]
  },

  // ========== Tag Sync ==========

  async syncTagsByIds(tagIds: string[]) {
    if (tagIds.length === 0) return

    // Also include tags referenced by galrc_zhtag
    const zhtags = await db.selectFrom('galrc_zhtag').select('id').execute()
    const allIds = [...new Set([...tagIds, ...zhtags.map((z) => z.id)])]

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
            .insertInto('tags')
            .values({
              id: tag.id,
              cat: tag.category,
              name: tag.name,
              alias: tag.aliases?.join(',') ?? null,
              description: tag.description,
              searchable: tag.searchable,
              applicable: tag.applicable,
              synced_at: new Date(),
            })
            .onConflict((oc) =>
              oc.column('id').doUpdateSet({
                cat: (eb) => eb.ref('excluded.cat'),
                name: (eb) => eb.ref('excluded.name'),
                alias: (eb) => eb.ref('excluded.alias'),
                description: (eb) => eb.ref('excluded.description'),
                searchable: (eb) => eb.ref('excluded.searchable'),
                applicable: (eb) => eb.ref('excluded.applicable'),
                synced_at: (eb) => eb.ref('excluded.synced_at'),
              }),
            )
            .execute()
        }
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
          .insertInto('releases')
          .values({
            id: rel.id,
            title: rel.title,
            released: rel.released,
            minage: rel.minage,
            patch: rel.patch,
            freeware: rel.freeware,
            uncensored: rel.uncensored,
            official: rel.official,
            has_ero: rel.has_ero,
            engine: rel.engine,
            voiced: rel.voiced,
            gtin: rel.gtin ? BigInt(rel.gtin) : null,
            catalog: rel.catalog,
            notes: rel.notes,
            synced_at: new Date(),
          })
          .onConflict((oc) =>
            oc.column('id').doUpdateSet({
              title: (eb) => eb.ref('excluded.title'),
              released: (eb) => eb.ref('excluded.released'),
              minage: (eb) => eb.ref('excluded.minage'),
              patch: (eb) => eb.ref('excluded.patch'),
              freeware: (eb) => eb.ref('excluded.freeware'),
              uncensored: (eb) => eb.ref('excluded.uncensored'),
              official: (eb) => eb.ref('excluded.official'),
              has_ero: (eb) => eb.ref('excluded.has_ero'),
              engine: (eb) => eb.ref('excluded.engine'),
              voiced: (eb) => eb.ref('excluded.voiced'),
              gtin: (eb) => eb.ref('excluded.gtin'),
              catalog: (eb) => eb.ref('excluded.catalog'),
              notes: (eb) => eb.ref('excluded.notes'),
              synced_at: (eb) => eb.ref('excluded.synced_at'),
            }),
          )
          .execute()

        if (rel.vns?.length) {
          await db.deleteFrom('releases_vn').where('id', '=', rel.id).execute()
          await db
            .insertInto('releases_vn')
            .values(
              rel.vns.map((v) => ({
                id: rel.id,
                vid: v.id,
                rtype: v.rtype,
                synced_at: new Date(),
              })),
            )
            .execute()
        }

        if (rel.languages?.length) {
          await db
            .deleteFrom('releases_titles')
            .where('id', '=', rel.id)
            .execute()
          await db
            .insertInto('releases_titles')
            .values(
              rel.languages.map((l) => ({
                id: rel.id,
                lang: l.lang as any,
                title: l.title,
                latin: l.latin,
                mtl: l.mtl,
                main: l.main,
              })),
            )
            .execute()
        }

        if (rel.producers?.length) {
          for (const p of rel.producers) producerIds.add(p.id)
          await db
            .deleteFrom('releases_producers')
            .where('id', '=', rel.id)
            .execute()
          await db
            .insertInto('releases_producers')
            .values(
              rel.producers.map((p) => ({
                id: rel.id,
                pid: p.id,
                developer: p.developer,
                publisher: p.publisher,
                synced_at: new Date(),
              })),
            )
            .execute()
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

  async syncProducersByIds(pids: string[]) {
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
            .insertInto('producers')
            .values({
              id: prod.id,
              type: prod.type as any,
              lang: prod.lang as any,
              name: prod.name,
              original: prod.original,
              latin: prod.original,
              alias: prod.aliases?.join(',') ?? null,
              description: prod.description,
              synced_at: new Date(),
            })
            .onConflict((oc) =>
              oc.column('id').doUpdateSet({
                type: (eb) => eb.ref('excluded.type'),
                name: (eb) => eb.ref('excluded.name'),
                original: (eb) => eb.ref('excluded.original'),
                latin: (eb) => eb.ref('excluded.latin'),
                alias: (eb) => eb.ref('excluded.alias'),
                description: (eb) => eb.ref('excluded.description'),
                synced_at: (eb) => eb.ref('excluded.synced_at'),
              }),
            )
            .execute()
        }
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  },
}
