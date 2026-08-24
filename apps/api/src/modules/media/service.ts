import {
  alistb,
  db,
  deleteCloudreveFiles,
  media as mediaTable,
  otherMedia,
  pathToCloudreveUri,
} from '@api/libs'
import {
  acquireIdempotentKey,
  delKv,
  delKvPattern,
  generateIdempotentHash,
  getIdempotentResult,
  storeIdempotentResult,
} from '@api/libs/redis'
import { S3Client } from 'bun'
import { and, eq, sql } from 'drizzle-orm'
import { status } from 'elysia'
import type { MediaModel } from './model'

async function invalidateOtherCaches(otherId: number) {
  const vids = await db
    .select({ vid: alistb.vid })
    .from(alistb)
    .where(eq(alistb.other, otherId))
  await Promise.all([
    delKv(`galzy:game:info:${otherId}`),
    ...vids.map((r) => delKv(`galzy:game:info:${r.vid}`)),
  ])
  await delKvPattern('galzy:game:list*')
  await delKvPattern('galzy:tag:games:*')
}

// Bun's S3Client reads S3_* or AWS_* env vars automatically.
const config = {
  endpoint: process.env.S3_ENDPOINT,
  bucket: process.env.S3_BUCKET,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION,
}
const s3 = new S3Client(config)

export const Media = {
  async insertmediatoentry({
    entryId,
    media,
    sortOrder,
    cover,
  }: MediaModel.insertmediatoentry) {
    const hash = generateIdempotentHash({ entryId, media, sortOrder, cover })
    const cached = await getIdempotentResult(
      `galzy:idempotent:insertmediatoentry:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:insertmediatoentry:${hash}`,
      60,
    )
    if (!ok) {
      throw status(409, '重复请求')
    }
    // 首先检查是否存在相同 hash 的记录
    const existingMedia = await db
      .select({ hash: mediaTable.hash })
      .from(mediaTable)
      .where(eq(mediaTable.hash, media.hash))
      .limit(1)
      .then((r) => r[0])

    let mediahash: string

    if (existingMedia) {
      // 如果存在相同 hash 的记录，使用现有记录的 ID
      mediahash = existingMedia.hash
    } else {
      // 如果不存在，则插入新记录
      const [insertedMedia] = await db
        .insert(mediaTable)
        .values(media)
        .returning({ hash: mediaTable.hash })
      mediahash = insertedMedia!.hash
    }

    // 检查关联表中是否已存在这个关联
    const existingRelation = await db
      .select({ id: otherMedia.id })
      .from(otherMedia)
      .where(
        and(
          eq(otherMedia.otherId, entryId),
          eq(otherMedia.mediaHash, mediahash),
        ),
      )
      .limit(1)
      .then((r) => r[0])

    // 关联已存在：幂等命中，直接返回成功（不重复插入）
    if (existingRelation) {
      await storeIdempotentResult(
        `galzy:idempotent:insertmediatoentry:${hash}`,
        { success: true },
        60,
      )
      return { success: true }
    }

    await db.transaction(async (trx) => {
      if (cover) {
        await trx
          .update(otherMedia)
          .set({ cover: false })
          .where(
            and(eq(otherMedia.otherId, entryId), eq(otherMedia.cover, true)),
          )
      }
      await trx.insert(otherMedia).values({
        otherId: entryId,
        mediaHash: mediahash,
        sortOrder: sortOrder,
        cover: cover,
      })
    })

    await invalidateOtherCaches(entryId)
    await storeIdempotentResult(
      `galzy:idempotent:insertmediatoentry:${hash}`,
      { success: true },
      60,
    )
    return { success: true }
  },
  async delemediatoentry({ id, mediahash, name }: MediaModel.delemediatoentry) {
    const hash = generateIdempotentHash({ id, mediahash, name })
    const cached = await getIdempotentResult(
      `galzy:idempotent:delemediatoentry:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:delemediatoentry:${hash}`,
      60,
    )
    if (!ok) {
      throw status(409, '重复请求')
    }
    // 删除 galrc_other_media 中的记录
    await db
      .delete(otherMedia)
      .where(
        and(eq(otherMedia.otherId, id), eq(otherMedia.mediaHash, mediahash)),
      )
    const log = await db
      .select({ id: otherMedia.id })
      .from(otherMedia)
      .where(eq(otherMedia.mediaHash, mediahash))
      .limit(1)
      .then((r) => r[0])
    if (log === undefined) {
      // 如果图片没有被其他条目使用，则删除 galrc_media 中的记录
      await db.delete(mediaTable).where(eq(mediaTable.hash, mediahash))

      // 同步删除 Cloudreve 上传目录中的同名文件（best-effort）
      const uploadDir = (process.env.CLOUDREVE_UPLOAD_DIR ?? '/upload').replace(
        /\/+$/,
        '',
      )
      await deleteCloudreveFiles([pathToCloudreveUri(`${uploadDir}/${name}`)])
    }

    await invalidateOtherCaches(id)
    await storeIdempotentResult(
      `galzy:idempotent:delemediatoentry:${hash}`,
      { success: true },
      60,
    )
    return { success: true }
  },
  async getMediaByCover({ other, mediahash }: MediaModel.getMediaByCover) {
    const hash = generateIdempotentHash({ other, mediahash })
    const cached = await getIdempotentResult(
      `galzy:idempotent:getMediaByCover:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:getMediaByCover:${hash}`,
      60,
    )
    if (!ok) {
      throw status(409, '重复请求')
    }
    const mediaResult = await db.transaction(async (trx) => {
      // 清除当前其他所有封面
      await trx
        .update(otherMedia)
        .set({ cover: false })
        .where(and(eq(otherMedia.otherId, other), eq(otherMedia.cover, true)))

      // 设置新封面
      const [updated] = await trx
        .update(otherMedia)
        .set({ cover: true })
        .where(
          and(
            eq(otherMedia.mediaHash, mediahash),
            eq(otherMedia.otherId, other),
          ),
        )
        .returning()

      return updated
    })

    await invalidateOtherCaches(other)
    await storeIdempotentResult(
      `galzy:idempotent:getMediaByCover:${hash}`,
      mediaResult,
      60,
    )
    return mediaResult
  },
  async getMedia({ other_id }: MediaModel.getMedia) {
    const hash = generateIdempotentHash({ other_id })
    const cached = await getIdempotentResult(
      `galzy:idempotent:getMedia:${hash}`,
    )
    if (cached) {
      return cached
    }
    const ok = await acquireIdempotentKey(
      `galzy:idempotent:getMedia:${hash}`,
      60,
    )
    if (!ok) {
      throw status(409, '重复请求')
    }
    const data = await db
      .select({
        cover: otherMedia.cover,
        mediadata: sql`(SELECT row_to_json(m.*) FROM (SELECT * FROM galrc_media WHERE hash = ${sql.identifier('galrc_other_media')}.${sql.identifier('media_hash')} LIMIT 1) m)`,
      })
      .from(otherMedia)
      .where(eq(otherMedia.otherId, Number(other_id)))

    await storeIdempotentResult(`galzy:idempotent:getMedia:${hash}`, data, 60)
    return data
  },
  async uploadAvatar({
    image,
    userId,
  }: {
    image: MediaModel.uploadAvatar['image']
    userId: string
  }) {
    const contentType = image.type || 'image/png'
    const ext = contentType.split('/')[1] || 'png'
    const key = `avatars/${userId}/${image.name}.${ext}`

    // Read file bytes
    const buffer = Buffer.from(await image.arrayBuffer())

    // Upload to S3
    await s3.write(key, buffer)

    const presignedUrl = `${process.env.S3_IMAGEURL}/${key}`

    return { url: presignedUrl }
  },
}
