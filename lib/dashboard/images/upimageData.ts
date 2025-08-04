"use server";

import { db, Onthermeidia } from "@/lib/kysely";

export async function insertMediaToEntry(
  entryId: number,
  media: Omit<Onthermeidia, "id">,
  sortOrder = 0
) {
  const insertedMedia = await db
    .insertInto("galrc_media")
    .values(media)
    .returning(["id"])
    .executeTakeFirstOrThrow();

  await db
    .insertInto("galrc_other_media")
    .values({
      other_id: entryId,
      media_id: insertedMedia.id,
      sort_order: sortOrder,
    })
    .execute();
}
