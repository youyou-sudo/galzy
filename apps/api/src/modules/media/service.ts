import { db } from '@api/libs'
import { status } from 'elysia'
import { jsonObjectFrom } from 'kysely/helpers/postgres'
import { t } from 'try'
import type { MediaModel } from './model'
import XXH from 'xxhashjs'
import {
  acquireIdempotentKey,
  getIdempotentResult,
  storeIdempotentResult,
} from '@api/libs/redis'

export const Media = {
  async insertmediatoentry({
    entryId,
    media,
    sortOrder,
    cover,
  }: MediaModel.insertmediatoentry) {
    const str = JSON.stringify({ entryId, media, sortOrder, cover })
    const hash = XXH.h32(str, 0xabcd).toString(16)
    const cached = await getIdempotentResult(`insertmediatoentry-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`insertmediatoentry-${hash}`, 60)
    if (!ok) {
      throw status(200, '重复请求')
    }
    // 首先检查是否存在相同 hash 的记录
    const existingMedia = await db
      .selectFrom('galrc_media')
      .select('hash')
      .where('hash', '=', media.hash)
      .executeTakeFirst()

    let mediahash: string

    if (existingMedia) {
      // 如果存在相同 hash 的记录，使用现有记录的 ID
      mediahash = existingMedia.hash
    } else {
      // 如果不存在，则插入新记录
      const insertedMedia = await db
        .insertInto('galrc_media')
        .values(media)
        .returning(['hash'])
        .executeTakeFirstOrThrow()
      mediahash = insertedMedia.hash
    }

    // 检查关联表中是否已存在这个关联
    const existingRelation = await db
      .selectFrom('galrc_other_media')
      .select('id')
      .where('other_id', '=', entryId)
      .where('media_hash', '=', mediahash)
      .executeTakeFirst()

    // 只有在关联不存在时才创建新的关联
    if (!existingRelation) {
      if (cover) {
        await db
          .updateTable('galrc_other_media')
          .where('cover', '=', true)
          .set({ cover: false })
          .returningAll()
          .executeTakeFirst()
      }
      await db
        .insertInto('galrc_other_media')
        .values({
          other_id: entryId,
          media_hash: mediahash,
          sort_order: sortOrder,
          cover: cover,
        })
        .execute()

      await storeIdempotentResult(`insertmediatoentry-${hash}`, '', 60)
    }
  },
  async delemediatoentry({ id, mediahash, name }: MediaModel.delemediatoentry) {
    const str = JSON.stringify({ id, mediahash, name })
    const hash = XXH.h32(str, 0xabcd).toString(16)
    const cached = await getIdempotentResult(`delemediatoentry-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`delemediatoentry-${hash}`, 60)
    if (!ok) {
      throw status(200, '重复请求')
    }
    // 删除 galrc_other_media 中的记录
    await db
      .deleteFrom('galrc_other_media')
      .where('other_id', '=', id)
      .where('media_hash', '=', mediahash)
      .execute()
    const log = await db
      .selectFrom('galrc_other_media')
      .selectAll()
      .where('media_hash', '=', mediahash)
      .executeTakeFirst()
    if (log === null) {
      // 如果图片没有被其他条目使用，则删除 galrc_media 中的记录
      await db.deleteFrom('galrc_media').where('hash', '=', mediahash).execute()

      const targetUrl = `${process.env.OPENLIST_HOST}/api/fs/remove`
      const authToken = process.env.OPENLIST_API_KEY
      await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `${authToken}`,
        },
        body: JSON.stringify({
          name: [name],
          dir: `/upload`,
        }),
      })
    }

    await storeIdempotentResult(`delemediatoentry-${hash}`, '', 60)
  },
  async getMediaByCover({ other, mediahash }: MediaModel.getMediaByCover) {
    const str = JSON.stringify({ other, mediahash })
    const hash = XXH.h32(str, 0xabcd).toString(16)
    const cached = await getIdempotentResult(`getMediaByCover-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`getMediaByCover-${hash}`, 60)
    if (!ok) {
      throw status(200, '重复请求')
    }
    const [, error, media] = t(
      await db.transaction().execute(async (trx) => {
        // 清除当前其他所有封面
        await trx
          .updateTable('galrc_other_media')
          .where('other_id', '=', other)
          .where('cover', '=', true)
          .set({ cover: false })
          .execute()

        // 设置新封面
        const updated = await trx
          .updateTable('galrc_other_media')
          .where('media_hash', '=', mediahash)
          .where('other_id', '=', other)
          .set({ cover: true })
          .returningAll()
          .executeTakeFirst()

        return updated
      }),
    )

    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)

    await storeIdempotentResult(`getMediaByCover-${hash}`, media, 60)
    return media
  },
  async getMedia({ other_id }: MediaModel.getMedia) {
    const str = JSON.stringify({ other_id })
    const hash = XXH.h32(str, 0xabcd).toString(16)
    const cached = await getIdempotentResult(`getMedia-${hash}`)
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(`getMedia-${hash}`, 60)
    if (!ok) {
      throw status(200, '重复请求')
    }
    const [, error, data] = t(
      await db
        .selectFrom('galrc_other_media')
        .where('other_id', '=', Number(other_id))
        .select((media) => [
          'galrc_other_media.cover',
          jsonObjectFrom(
            media
              .selectFrom('galrc_media')
              .selectAll()
              .whereRef(
                'galrc_media.hash',
                '=',
                'galrc_other_media.media_hash',
              ),
          ).as('mediadata'),
        ])
        .execute(),
    )
    if (error)
      throw status(500, `服务出错了喵~，Error:${JSON.stringify(error)}`)

    await storeIdempotentResult(`getMedia-${hash}`, data, 60)
    return data
  },
}
