"use server";

import { db, Onthermeidia } from "@/lib/kysely";
import { jsonObjectFrom } from "kysely/helpers/postgres";

export async function insertMediaToEntry(
  entryId: number,
  media: Omit<Onthermeidia, "id">,
  sortOrder = 0,
  cover: boolean = false
) {
  // 首先检查是否存在相同 hash 的记录
  const existingMedia = await db
    .selectFrom("galrc_media")
    .select("id")
    .where("hash", "=", media.hash)
    .executeTakeFirst();

  let mediaId: number;

  if (existingMedia) {
    // 如果存在相同 hash 的记录，使用现有记录的 ID
    mediaId = existingMedia.id;
  } else {
    // 如果不存在，则插入新记录
    const insertedMedia = await db
      .insertInto("galrc_media")
      .values(media)
      .returning(["id"])
      .executeTakeFirstOrThrow();
    mediaId = insertedMedia.id;
  }

  // 检查关联表中是否已存在这个关联
  const existingRelation = await db
    .selectFrom("galrc_other_media")
    .select("id")
    .where("other_id", "=", entryId)
    .where("media_id", "=", mediaId)
    .executeTakeFirst();

  // 只有在关联不存在时才创建新的关联
  if (!existingRelation) {
    if (cover) {
      await db
        .updateTable("galrc_other_media")
        .where("cover", "=", true)
        .set({ cover: false })
        .returningAll()
        .executeTakeFirst();
    }
    await db
      .insertInto("galrc_other_media")
      .values({
        other_id: entryId,
        media_id: mediaId,
        sort_order: sortOrder,
        cover: cover,
      })
      .execute();
  }
}

export async function deleMediaByEntryId(
  id: number,
  mediaId: number,
  name: string
) {
  // 删除 galrc_other_media 中的记录
  await db
    .deleteFrom("galrc_other_media")
    .where("other_id", "=", id)
    .where("media_id", "=", mediaId)
    .execute();
  const log = await db
    .selectFrom("galrc_other_media")
    .selectAll()
    .where("media_id", "=", id)
    .executeTakeFirst();
  if (log === null) {
    // 如果图片没有被其他条目使用，则删除 galrc_media 中的记录
    await db.deleteFrom("galrc_media").where("id", "=", mediaId).execute();

    const targetUrl = `${process.env.OPENLIST_HOST}/api/fs/remove`;
    const authToken = process.env.OPENLIST_API_KEY;
    await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `${authToken}`,
      },
      body: JSON.stringify({
        name: [name],
        dir: `/upload`,
      }),
    });
  }
}

export async function getMediaByCover(other: number, media_id: string) {
  const media = await db.transaction().execute(async (trx) => {
    // 清除当前其他所有封面
    await trx
      .updateTable("galrc_other_media")
      .where("other_id", "=", other)
      .where("cover", "=", true)
      .set({ cover: false })
      .execute();

    // 设置新封面
    const updated = await trx
      .updateTable("galrc_other_media")
      .where("media_id", "=", Number(media_id))
      .where("other_id", "=", other)
      .set({ cover: true })
      .returningAll()
      .executeTakeFirst();

    return updated;
  });

  return media;
}

export async function getMedia(other_id: string) {
  return await db
    .selectFrom("galrc_other_media")
    .where("other_id", "=", Number(other_id))
    .select((media) => [
      "galrc_other_media.cover",
      jsonObjectFrom(
        media
          .selectFrom("galrc_media")
          .selectAll()
          .whereRef("galrc_media.id", "=", "galrc_other_media.media_id")
      ).as("mediadata"),
    ])
    .execute();
}
